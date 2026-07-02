/**
 * Ticket file validation
 *
 * Validates uploaded ticket files (PNG/JPG/JPEG/PDF) by:
 *   1. Extracting a QR code — required; no QR → rejected.
 *   2. SHA-256 hashing the QR payload for duplicate prevention.
 *
 * Text/OCR validation is not performed here.
 * validation_status is set to "qr_checked" on success.
 */

import { createHash } from 'node:crypto'
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import jsQR from 'jsqr'
import sharp from 'sharp'

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export type ValidationStatus = 'qr_checked'

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
): Promise<TicketValidation | TicketValidationError> {
  const isPdf = mimeType === 'application/pdf'

  // Extract QR code — required for every file type.
  const qrData = isPdf
    ? await extractQRFromPdf(buffer)
    : await extractQRFromImage(buffer)

  if (!qrData) {
    return {
      error: isPdf
        ? 'We couldn\'t read the QR code from this PDF. Please upload a screenshot (PNG or JPG) of the ticket instead. Screenshot uploads use the same verification process and usually work immediately.'
        : 'No readable QR code found. Please upload a clearer ticket screenshot.',
    }
  }

  return {
    ticketQrHash: sha256(qrData),
    validationStatus: 'qr_checked',
    validationNotes: 'QR code extracted and duplicate check completed.',
  }
}

// ────────────────────────────────────────────────────────────────────────────
// QR extraction — images (PNG/JPG/JPEG)
// ────────────────────────────────────────────────────────────────────────────

async function extractQRFromImage(buffer: Buffer): Promise<string | null> {
  // Try multiple preprocessings to handle low-contrast or large screenshots.
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

  // jsQR found no QR code — try Code 128 barcode (e.g. Fatsoma tickets).
  return tryZXingCode128(buffer)
}

async function tryZXingCode128(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new MultiFormatReader()
    reader.setHints(hints)

    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
    )
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource))
    const result = reader.decode(binaryBitmap)
    return result.getText()
  } catch {
    // ZXing throws NotFoundException when no barcode is found — treat as null.
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// QR extraction — PDFs (via embedded page images)
// ────────────────────────────────────────────────────────────────────────────

// [DEBUG] Temporary Vercel diagnostics — remove before next commit.
const dbg = (msg: string) => console.log(`[PDF-QR-DEBUG] ${msg}`)
const dbgErr = (label: string, err: unknown) =>
  dbg(`${label}: ${err instanceof Error ? err.message : String(err)}`)

async function extractQRFromPdf(buffer: Buffer): Promise<string | null> {
  dbg(`extractQRFromPdf entered — buffer ${buffer.length} bytes`)

  // ── Dynamic import ──────────────────────────────────────────────────────────
  let PDFParse: { new (opts: { data: Uint8Array }): { getImage(): Promise<{ pages: { images: EmbeddedImage[] }[] }>; destroy(): Promise<void> } }
  try {
    const mod = await import('pdf-parse')
    PDFParse = mod.PDFParse
    dbg('import(pdf-parse) succeeded')
  } catch (err) {
    dbgErr('import(pdf-parse) FAILED', err)
    return null
  }

  // ── Parser + getImage ───────────────────────────────────────────────────────
  let imageResult: { pages: { images: EmbeddedImage[] }[] }
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    imageResult = await parser.getImage()
    await parser.destroy()
    dbg(`getImage() succeeded — ${imageResult.pages.length} page(s)`)
  } catch (err) {
    dbgErr('getImage() FAILED', err)
    return null
  }

  // ── Image inventory ─────────────────────────────────────────────────────────
  const totalImages = imageResult.pages.reduce((n, p) => n + p.images.length, 0)
  dbg(`Total embedded images across all pages: ${totalImages}`)
  if (totalImages === 0) {
    dbg('No embedded images — returning null')
    return null
  }

  // ── Per-image scan ──────────────────────────────────────────────────────────
  for (let pi = 0; pi < imageResult.pages.length; pi++) {
    const page = imageResult.pages[pi]
    for (let ii = 0; ii < page.images.length; ii++) {
      const img = page.images[ii]
      dbg(
        `Image [p${pi + 1}/i${ii + 1}]: ` +
        `${img.width}×${img.height} kind=${img.kind} bytes=${img.data.length} ` +
        `(expected RGBA=${img.width * img.height * 4} RGB=${img.width * img.height * 3})`,
      )
      const qr = await tryQRFromEmbeddedImage(img, pi + 1, ii + 1)
      if (qr) {
        dbg(`QR found at [p${pi + 1}/i${ii + 1}] — payload length ${qr.length}`)
        return qr
      }
      dbg(`Image [p${pi + 1}/i${ii + 1}]: no QR`)
    }
  }

  dbg('All images exhausted — returning null')
  return null
}

async function tryQRFromEmbeddedImage(
  img: EmbeddedImage,
  pageNum: number,
  imgNum: number,
): Promise<string | null> {
  const tag = `[p${pageNum}/i${imgNum}]`

  const runJsQR = (raw: Uint8Array | Buffer, w: number, h: number, label: string) => {
    const code = jsQR(new Uint8ClampedArray(raw), w, h, { inversionAttempts: 'attemptBoth' })
    dbg(`  ${tag} jsQR(${label}): ${code?.data ? 'HIT' : 'null'}`)
    return code?.data ?? null
  }

  // Attempt 1: compressed JPEG/PNG stream.
  try {
    const { data, info } = await sharp(Buffer.from(img.data))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    dbg(`  ${tag} Attempt 1 (sharp): decoded ${info.width}×${info.height} ch=${info.channels}`)
    const qr = runJsQR(data, info.width, info.height, 'sharp')
    if (qr) return qr
  } catch (err) {
    dbgErr(`  ${tag} Attempt 1 (sharp) FAILED`, err)
  }

  // Attempt 2: raw RGBA.
  const eligibleRGBA = img.kind === 3 && img.data.length === img.width * img.height * 4
  dbg(`  ${tag} Attempt 2 (raw RGBA): eligible=${eligibleRGBA}`)
  if (eligibleRGBA) {
    try {
      const qr = runJsQR(img.data, img.width, img.height, 'raw-RGBA')
      if (qr) return qr
    } catch (err) {
      dbgErr(`  ${tag} Attempt 2 FAILED`, err)
    }
  }

  // Attempt 3: raw RGB → RGBA.
  const eligibleRGB = img.kind === 2 && img.data.length === img.width * img.height * 3
  dbg(`  ${tag} Attempt 3 (raw RGB→RGBA): eligible=${eligibleRGB}`)
  if (eligibleRGB) {
    try {
      const rgba = await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels: 3 },
      })
        .ensureAlpha()
        .raw()
        .toBuffer()
      const qr = runJsQR(rgba, img.width, img.height, 'raw-RGB->RGBA')
      if (qr) return qr
    } catch (err) {
      dbgErr(`  ${tag} Attempt 3 FAILED`, err)
    }
  }

  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}
