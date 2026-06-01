'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ReserveState = { error: string | null }

export async function reserveTicket(
  _prev: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const ticketId = formData.get('ticket_id') as string
  if (!ticketId) return { error: 'Missing ticket ID.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to reserve a ticket.' }

  // Delegate the entire reservation to a SECURITY DEFINER Postgres function.
  // This avoids the buyer needing direct UPDATE access on the tickets table
  // (which triggers RLS policy conflicts), while keeping RLS fully enabled.
  // The function acquires a row-level lock, validates auth.uid() server-side,
  // updates the ticket status, and inserts the order — all atomically.
  const { data: result, error: rpcError } = await supabase.rpc('reserve_ticket', {
    p_ticket_id: ticketId,
  })

  if (rpcError) return { error: rpcError.message }

  const rpcResult = result as { error?: string; success?: boolean } | null
  if (rpcResult?.error) return { error: rpcResult.error }

  revalidatePath('/')
  revalidatePath('/dashboard')
  redirect(`/buy/${ticketId}/confirmed`)
}
