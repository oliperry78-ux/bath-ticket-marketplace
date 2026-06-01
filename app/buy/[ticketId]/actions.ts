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

  // --- Attempt to atomically claim the ticket ---
  // The UPDATE only succeeds if:
  //   • status = 'available'  (USING condition in RLS)
  //   • seller_id != buyer    (prevents self-purchase at DB level)
  //   • new status = 'reserved' (WITH CHECK in RLS)
  const { data: updated, error: updateError } = await supabase
    .from('tickets')
    .update({ status: 'reserved' })
    .eq('id', ticketId)
    .eq('status', 'available')
    .neq('seller_id', user.id)
    .select('id, price, seller_id')

  if (updateError) return { error: updateError.message }

  if (!updated || updated.length === 0) {
    return { error: 'This ticket is no longer available, or you cannot reserve your own listing.' }
  }

  const ticket = updated[0]

  // --- Create order record ---
  const { error: orderError } = await supabase.from('orders').insert({
    ticket_id: ticketId,
    buyer_id: user.id,
    seller_id: ticket.seller_id,
    purchase_price: ticket.price,
    status: 'pending',
  })

  if (orderError) {
    // Best-effort rollback: revert ticket status so it can be reserved again.
    await supabase
      .from('tickets')
      .update({ status: 'available' })
      .eq('id', ticketId)
      .eq('seller_id', ticket.seller_id)
    return { error: `Reservation failed: ${orderError.message}` }
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  redirect(`/buy/${ticketId}/confirmed`)
}
