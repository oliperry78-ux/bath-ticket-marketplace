/**
 * Ticket file validation
 *
 * All uploads go through the same pipeline:
 *   1. QR extraction  — required; no QR → rejected.
 *   2. Text extraction:
 *        Images (PNG/JPG/JPEG) → Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)
 *        PDFs with text layer  → pdf-parse getText(); no Vision API call needed.
 *        PDFs without text layer (scanned/image-based) → Vision API OCR on the
 *          embedded page raster images extracted by pdf-parse getImage().
 *   3. Text validation — venue, event name, and date cross-checked against
 *      seller-entered values. Any mismatch → rejected.
 *
 * GOOGLE_CLOUD_VISION_API_KEY is required for:
 *   - All image uploads (PNG/JPG/JPEG).
 *   - PDF uploads whose text layer yields fewer than PDF_TEXT_MIN_LEN characters
 *     (i.e. scanned / image-based PDFs with no embedded text).
 *
 * There is no qr_only fallback. Missing key or unreadable text → rejected.
 */

import { createHash } from 'node:crypto'
import jsQR from 'jsqr'
import sharp from 'sharp'

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

// PDFs whose text layer is shorter than this are treated as image-based
// (scanned) and fall back to Vision API OCR on the embedded page images.
// 100 chars is well above any real ticket's meaningful text; "-- 1 of 1 --"
// and similar pdf-parse artefacts are typically < 20 chars.
const PDF_TEXT_MIN_LEN = 100

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export type ValidationStatus = 'validated'

export interface TicketValidation {
  ticketQrHash: string
  validationStatus: ValidationStatus
  validationNotes: string
}

export interface TicketValidationError {
  error: string
}

// ────────────────────────────────────────────────────────────────────────────
// Shared type for embedded PDF images
// ────────────────────────────────────────────────────────────────────────────

interface EmbeddedImage {
  data: Uint8Array
  width: number
  height: number
  kind: number // 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────

export async function validateTicketFile(
  buffer: Buffer,
  mimeType: string,
  eventName: string,
  venue: string,
  eventDate: string, // YYYY-MM-DD
): Promise<TicketValidation | TicketValidationError> {
  const isPdf = mimeType === 'application/pdf'

  console.log('[TICKET-DEBUG] validateTicketFile called', {
    mimeType,
    fileSizeBytes: buffer.length,
    isPdf,
    hasVisionKey: !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
    eventName,
    venue,
    eventDate,
  })

  // ── 1. QR extraction (required for every file type) ───────────────────────
  const qrData = isPdf
    ? await extractQRFromPdf(buffer)
    : await extractQRFromImage(buffer)

  console.log('[TICKET-DEBUG] QR extraction result:', {
    qrFound: !!qrData,
    qrDataLength: qrData?.length ?? 0,
  })

  if (!qrData) {
    return {
      error:
        'No readable QR code found. Please upload a clearer ticket screenshot or PDF.',
    }
  }

  const ticketQrHash = sha256(qrData)

  // ── 2. Visible text extraction ────────────────────────────────────────────
  let rawText: string | null

  if (isPdf) {
    rawText = await extractPdfText(buffer)
    const pdfTextUsable = !!rawText && rawText.trim().length >= PDF_TEXT_MIN_LEN

    console.log('[TICKET-DEBUG] PDF text layer result:', {
      length: rawText?.length ?? 0,
      usable: pdfTextUsable,
      preview: rawText?.slice(0, 300) ?? null,
    })

    if (!pdfTextUsable) {
      // The PDF has no meaningful text layer (it is image-based / scanned).
      // Fall back to Vision API OCR on the embedded page raster images.
      if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) {
        return {
          error:
            'This PDF appears to be image-based (no text layer). ' +
            'OCR validation requires GOOGLE_CLOUD_VISION_API_KEY to be configured. ' +
            'Please contact the site administrator.',
        }
      }

      console.log(
        '[TICKET-DEBUG] PDF text layer insufficient — falling back to Vision API on embedded page images',
      )
      rawText = await extractTextFromPdfPageOCR(buffer)
    }
  } else {
    // Image upload — Vision API is always required.
    if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      return {
        error:
          'Image text validation is not available because ' +
          'GOOGLE_CLOUD_VISION_API_KEY is not configured. ' +
          'Please contact the site administrator.',
      }
    }
    rawText = await extractTextFromImageOCR(buffer)
  }

  console.log('[TICKET-DEBUG] Final text extraction result:', {
    rawTextLength: rawText?.length ?? 0,
    rawTextPreview: rawText?.slice(0, 300) ?? null,
  })

  const extractedText =
    rawText && rawText.trim().length >= 20
      ? rawText.replace(/\s+/g, ' ').trim()
      : null

  // ── 3. Extracted text is mandatory ───────────────────────────────────────
  if (!extractedText) {
    console.log(
      '[TICKET-DEBUG] Rejecting: no extractable text (rawText length:',
      rawText?.length ?? 0,
      ')',
    )
    return {
      error:
        'No readable text could be extracted from the ticket. ' +
        'Please upload a clearer screenshot or PDF.',
    }
  }

  // ── 4. Validate extracted text against every seller-entered field ─────────
  const textResult = validateText(extractedText, eventName, venue, eventDate)

  console.log(
    '[TICKET-DEBUG] Text validation result:',
    'error' in textResult ? textResult.error : textResult.validationStatus,
  )

  if ('error' in textResult) {
    return textResult
  }

  return { ticketQrHash, ...textResult }
}

// ────────────────────────────────────────────────────────────────────────────
// QR extraction — images
// ────────────────────────────────────────────────────────────────────────────

async function extractQRFromImage(buffer: Buffer): Promise<string | null> {
  const pipelines = [
    () =>
      sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .ensureAlpha()
        .raw(),
    () =>
      sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .normalise()
        .ensureAlpha()
        .raw(),
    () =>
      sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .grayscale()
        .ensureAlpha()
        .raw(),
  ]

  for (const pipeline of pipelines) {
    try {
      const { data, info } = await pipeline().toBuffer({ resolveWithObject: true })
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: 'attemptBoth',
      })
      if (code?.data) return code.data
    } catch {
      // try next preprocessing variant
    }
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────
// QR extraction — PDFs (via embedded page images)
// ────────────────────────────────────────────────────────────────────────────

async function extractQRFromPdf(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const imageResult = await parser.getImage()
    await parser.destroy()

    for (const page of imageResult.pages) {
      for (const img of page.images) {
        const qr = await tryQRFromEmbeddedImage(img)
        if (qr) return qr
      }
    }
  } catch {
    // PDF had no extractable embedded images (e.g. purely vector).
  }
  return null
}

async function tryQRFromEmbeddedImage(img: EmbeddedImage): Promise<string | null> {
  const runJsQR = (raw: Uint8Array | Buffer, w: number, h: number) => {
    const code = jsQR(new Uint8ClampedArray(raw), w, h, {
      inversionAttempts: 'attemptBoth',
    })
    return code?.data ?? null
  }

  // Attempt 1: treat as compressed JPEG/PNG stream (most common for scanned pages).
  try {
    const { data, info } = await sharp(Buffer.from(img.data))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const qr = runJsQR(data, info.width, info.height)
    if (qr) return qr
  } catch {
    // Not a compressed stream — fall through to raw pixel modes.
  }

  // Attempt 2: raw RGBA (4 bytes/pixel).
  if (img.kind === 3 && img.data.length === img.width * img.height * 4) {
    try {
      return runJsQR(img.data, img.width, img.height)
    } catch {}
  }

  // Attempt 3: raw RGB (3 bytes/pixel) → pad alpha channel.
  if (img.kind === 2 && img.data.length === img.width * img.height * 3) {
    try {
      const rgba = await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels: 3 },
      })
        .ensureAlpha()
        .raw()
        .toBuffer()
      return runJsQR(rgba, img.width, img.height)
    } catch {}
  }

  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Convert an embedded PDF image to a JPEG buffer suitable for Vision API.
//
// pdf-parse delivers embedded images in three possible forms:
//   (a) Compressed stream — the raw bytes are a JPEG or PNG file. Sharp can
//       decode these directly.
//   (b) Raw RGBA (kind=3) — uncompressed 32-bit RGBA pixels.
//   (c) Raw RGB  (kind=2) — uncompressed 24-bit RGB pixels.
//
// We resize to max 1500 px wide and encode as JPEG q95 for Vision API.
// ────────────────────────────────────────────────────────────────────────────

async function embeddedImageToJpeg(img: EmbeddedImage): Promise<Buffer | null> {
  // (a) Compressed JPEG/PNG stream — most common for scanned PDF pages.
  try {
    return await sharp(Buffer.from(img.data))
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer()
  } catch {
    // Not a compressed stream — try raw pixel formats.
  }

  // (b) Raw RGBA_32BPP.
  if (img.kind === 3 && img.data.length === img.width * img.height * 4) {
    try {
      return await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels: 4 },
      })
        .resize({ width: 1500, withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer()
    } catch {}
  }

  // (c) Raw RGB_24BPP.
  if (img.kind === 2 && img.data.length === img.width * img.height * 3) {
    try {
      return await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels: 3 },
      })
        .resize({ width: 1500, withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer()
    } catch {}
  }

  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Vision API — shared HTTP call
//
// Accepts a JPEG buffer that has already been preprocessed (resized to ≤1500 px,
// q95). Returns the full OCR text string or null on any error.
// ────────────────────────────────────────────────────────────────────────────

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string }
    textAnnotations?: Array<{ description: string }>
    error?: { code: number; message: string }
  }>
}

async function callVisionAPI(jpegBuffer: Buffer, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: jpegBuffer.toString('base64') },
              // DOCUMENT_TEXT_DETECTION is optimised for dense text layouts
              // (tickets, screenshots, forms) and populates fullTextAnnotation.
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      },
    )

    console.log('[TICKET-DEBUG] Vision API HTTP status:', res.status)

    if (!res.ok) {
      const body = await res.text()
      console.error('[TICKET-DEBUG] Vision API HTTP error body:', body)
      return null
    }

    const data = (await res.json()) as VisionResponse
    const response = data.responses[0]

    if (response?.error) {
      console.error('[TICKET-DEBUG] Vision API application error:', response.error)
      return null
    }

    // fullTextAnnotation.text is populated by DOCUMENT_TEXT_DETECTION.
    // textAnnotations[0].description is the safety-net used by TEXT_DETECTION.
    const text =
      response?.fullTextAnnotation?.text ??
      response?.textAnnotations?.[0]?.description ??
      null

    console.log('[TICKET-DEBUG] Vision API text result:', {
      fullTextAnnotationPresent: !!response?.fullTextAnnotation,
      textAnnotationsCount: response?.textAnnotations?.length ?? 0,
      resolvedTextLength: text?.length ?? 0,
      resolvedTextPreview: text?.slice(0, 300) ?? null,
    })

    return text
  } catch (err) {
    console.error('[TICKET-DEBUG] Vision API request threw:', err)
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Text extraction — PNG/JPG/JPEG images via Vision API
// ────────────────────────────────────────────────────────────────────────────

async function extractTextFromImageOCR(buffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) return null

  // Resize to max 1500 px wide; JPEG q95 preserves enough detail for OCR.
  const imageData = await sharp(buffer)
    .resize({ width: 1500, withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer()

  console.log('[TICKET-DEBUG] Sending image to Vision API:', {
    originalBytes: buffer.length,
    compressedBytes: imageData.length,
  })

  return callVisionAPI(imageData, apiKey)
}

// ────────────────────────────────────────────────────────────────────────────
// Text extraction — image-based PDFs via Vision API on embedded page images
//
// How it works:
//   pdf-parse's getImage() walks the PDF's XObject table and extracts every
//   embedded raster image stream. For a scanned/image-based PDF each page is
//   stored as one large raster (JPEG or PNG) embedded in the file — these are
//   the exact pixels the reader displays. No PDF rendering engine is involved;
//   we read the already-rasterized data directly out of the file.
//
//   embeddedImageToJpeg() re-encodes whichever raw format pdf-parse returns
//   into a 1500-px JPEG, then callVisionAPI() sends it to DOCUMENT_TEXT_DETECTION.
//   We return the OCR text from the first image that yields ≥20 characters.
// ────────────────────────────────────────────────────────────────────────────

async function extractTextFromPdfPageOCR(buffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) return null

  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const imageResult = await parser.getImage()
    await parser.destroy()

    let imageIndex = 0
    for (const page of imageResult.pages) {
      for (const img of page.images) {
        const jpegBuf = await embeddedImageToJpeg(img)
        if (!jpegBuf) {
          imageIndex++
          continue
        }

        console.log('[TICKET-DEBUG] Sending PDF embedded image to Vision API:', {
          imageIndex,
          jpegBytes: jpegBuf.length,
          imgWidth: img.width,
          imgHeight: img.height,
          imgKind: img.kind,
        })

        const text = await callVisionAPI(jpegBuf, apiKey)

        if (text && text.trim().length >= 20) {
          console.log('[TICKET-DEBUG] PDF page OCR succeeded:', {
            imageIndex,
            textLength: text.length,
            textPreview: text.slice(0, 300),
          })
          return text
        }

        imageIndex++
      }
    }

    console.log('[TICKET-DEBUG] PDF page OCR: no image yielded usable text (images tried:', imageIndex, ')')
  } catch (err) {
    console.error('[TICKET-DEBUG] PDF image extraction for OCR failed:', err)
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Text extraction — text-layer PDFs via pdf-parse
// ────────────────────────────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text ?? null
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Text validation — same logic for all sources
// ────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

// Every field (venue, event name, date) must be present.
// A single failure returns a specific rejection error; there is no partial-match path.
function validateText(
  text: string,
  eventName: string,
  venue: string,
  eventDate: string,
): { validationStatus: 'validated'; validationNotes: string } | { error: string } {
  const lower = text.toLowerCase()

  // ── Venue ────────────────────────────────────────────────────────────────
  const skipVenue = venue.toLowerCase() === 'other'

  if (!skipVenue && !lower.includes(venue.toLowerCase())) {
    return {
      error:
        `Venue mismatch: "${venue}" was not found in the ticket text. ` +
        'Please check that the venue you entered matches the ticket.',
    }
  }

  // ── Event name ───────────────────────────────────────────────────────────
  if (!lower.includes(eventName.toLowerCase())) {
    return {
      error:
        `Event name mismatch: "${eventName}" was not found in the ticket text. ` +
        'Please check that the event name you entered matches the ticket.',
    }
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  // Require the year AND either the full month name, its 3-letter abbreviation,
  // or the zero-padded numeric month to appear in the text.
  const date = new Date(eventDate)
  const year = date.getFullYear().toString()
  const monthFull = MONTH_NAMES[date.getMonth()]                     // e.g. "june"
  const monthAbbr = monthFull.slice(0, 3)                           // e.g. "jun"
  const monthNum  = String(date.getMonth() + 1).padStart(2, '0')   // e.g. "06"

  const yearFound  = lower.includes(year)
  const monthFound =
    lower.includes(monthFull) ||
    lower.includes(monthAbbr) ||
    lower.includes(monthNum)

  if (!yearFound || !monthFound) {
    return {
      error:
        `Date mismatch: the event date (${eventDate}) was not confirmed in the ticket text. ` +
        'Please ensure the date on your ticket matches what you entered.',
    }
  }

  // ── All fields matched ───────────────────────────────────────────────────
  const notes = [
    skipVenue ? 'Venue check skipped (Other).' : `Venue "${venue}" confirmed.`,
    `Event name "${eventName}" confirmed.`,
    `Date confirmed (${year}, ${monthFull}).`,
  ].join(' ')

  return { validationStatus: 'validated', validationNotes: notes }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}
