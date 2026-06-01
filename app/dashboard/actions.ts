'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type ActionState = { error: string | null }

export async function markSold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketId = formData.get('ticket_id') as string
  if (!ticketId) return { error: 'Missing ticket ID.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'sold' })
    .eq('id', ticketId)
    .eq('seller_id', user.id) // defence-in-depth; RLS enforces this too

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketId = formData.get('ticket_id') as string
  if (!ticketId) return { error: 'Missing ticket ID.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Fetch the file path before deleting the row so we can clean up storage.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('ticket_file_path')
    .eq('id', ticketId)
    .eq('seller_id', user.id)
    .single()

  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId)
    .eq('seller_id', user.id)

  if (error) return { error: error.message }

  // Clean up the storage file if one was attached.
  if (ticket?.ticket_file_path) {
    await supabase.storage
      .from('ticket-files')
      .remove([ticket.ticket_file_path])
  }

  revalidatePath('/dashboard')
  return { error: null }
}
