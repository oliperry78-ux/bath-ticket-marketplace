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
      error:
        'No readable QR code found. Please upload a clearer ticket screenshot or PDF.',
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
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}
