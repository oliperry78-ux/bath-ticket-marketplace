import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Only the owning seller may fetch the file. The .eq('seller_id', user.id)
  // filter is a second defence layer on top of RLS.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('ticket_file_path')
    .eq('id', ticketId)
    .eq('seller_id', user.id)
    .single()

  if (!ticket?.ticket_file_path) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Generate a short-lived signed URL — the raw storage path is never sent to
  // the browser; only this time-limited redirect URL is.
  const { data: signed, error } = await supabase.storage
    .from('ticket-files')
    .createSignedUrl(ticket.ticket_file_path, 3600)

  if (error || !signed?.signedUrl) {
    console.error('Signed URL error:', error?.message)
    return new NextResponse('Could not generate download link', { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
