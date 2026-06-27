'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateTicketFile } from '@/lib/ticket-validation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type FormState = {
  error: string | null
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function createTicket(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to list a ticket.' }
  }

  // ── Validate text fields ──────────────────────────────────────────────────
  const event_name = (formData.get('event_name') as string)?.trim()
  const venue = (formData.get('venue') as string)?.trim()
  const event_date = formData.get('event_date') as string
  const priceRaw = formData.get('price') as string

  if (!event_name || !venue || !event_date || !priceRaw) {
    return { error: 'All fields are required.' }
  }

  const price = parseFloat(priceRaw)
  if (isNaN(price) || price < 0) {
    return { error: 'Price must be a valid positive number.' }
  }

  // ── Validate file type and size ───────────────────────────────────────────
  const file = formData.get('ticket_file') as File | null

  if (!file || file.size === 0) {
    return { error: 'A ticket file is required.' }
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'File must be a PDF, PNG, JPG, or JPEG.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: 'File must be smaller than 10 MB.' }
  }

  // ── Validate ticket content (QR + text) BEFORE any upload ─────────────────
  // Reading the buffer here means we reject invalid tickets without touching
  // storage, avoiding orphaned files and unnecessary upload bandwidth.
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const validation = await validateTicketFile(fileBuffer, file.type)

  if ('error' in validation) {
    return { error: validation.error }
  }

  // ── Duplicate detection ───────────────────────────────────────────────────
  // The unique index on ticket_qr_hash prevents the DB insert from succeeding
  // for a duplicate, but we check here first to give a friendly error message.
  const { data: duplicate } = await supabase
    .from('tickets')
    .select('id')
    .eq('ticket_qr_hash', validation.ticketQrHash)
    .maybeSingle()

  if (duplicate) {
    return { error: 'This ticket has already been listed.' }
  }

  // ── Upload file to Storage ────────────────────────────────────────────────
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${user.id}/${uniqueName}`

  const { error: uploadError } = await supabase.storage
    .from('ticket-files')
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) {
    return { error: `Could not upload file: ${uploadError.message}` }
  }

  // ── Insert ticket row ─────────────────────────────────────────────────────
  const { error: dbError } = await supabase.from('tickets').insert({
    event_name,
    venue,
    event_date,
    price,
    status: 'available',
    seller_id: user.id,
    seller_email: user.email,
    ticket_file_path: storagePath,
    ticket_qr_hash: validation.ticketQrHash,
    validation_status: validation.validationStatus,
    validation_notes: validation.validationNotes,
  })

  if (dbError) {
    // Roll back the storage upload so orphaned files don't accumulate.
    await supabase.storage.from('ticket-files').remove([storagePath])
    return { error: `Could not list ticket: ${dbError.message}` }
  }

  revalidatePath('/')
  redirect('/')
}
