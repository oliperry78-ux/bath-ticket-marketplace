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

  // Verify ownership explicitly before any writes.
  // (The .eq('seller_id') on the UPDATE below is defence-in-depth, but an
  // explicit fetch gives us a clear "not found" error rather than a silent 0-row update.)
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', ticketId)
    .eq('seller_id', user.id)
    .single()

  if (!ticket) return { error: 'Ticket not found or you do not own it.' }

  // Mark the ticket itself as sold.
  const { error: ticketError } = await supabase
    .from('tickets')
    .update({ status: 'sold' })
    .eq('id', ticketId)
    .eq('seller_id', user.id)

  if (ticketError) return { error: ticketError.message }

  // Move any pending reservation order to 'completed'.
  // This is best-effort: if the orders RLS policy does not permit the seller to
  // update orders yet, the ticket is still correctly marked sold. Add a Supabase
  // RLS policy "Sellers can update orders for their own tickets" if you need this
  // to be enforced atomically:
  //   CREATE POLICY "sellers_update_own_orders" ON public.orders
  //   FOR UPDATE USING (auth.uid() = seller_id);
  await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('ticket_id', ticketId)
    .eq('status', 'pending')

  revalidatePath('/dashboard')
  revalidatePath('/')
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

  // Verify ownership and fetch the file path in one query.
  // If this returns no row the ticket either doesn't exist or belongs to
  // someone else — either way we stop here.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('ticket_file_path')
    .eq('id', ticketId)
    .eq('seller_id', user.id)
    .single()

  if (!ticket) return { error: 'Ticket not found or you do not own it.' }

  // Delete linked orders first so the FK constraint (orders_ticket_id_fkey)
  // is satisfied before we remove the parent ticket row.
  // Ownership of the ticket was already verified above, so deleting its orders
  // is safe. If the orders RLS policy does not permit sellers to delete orders,
  // this will silently delete 0 rows and the ticket delete below will still
  // fail with the FK error. In that case add:
  //   CREATE POLICY "sellers_delete_own_orders" ON public.orders
  //   FOR DELETE USING (auth.uid() = seller_id);
  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .eq('ticket_id', ticketId)

  if (ordersError) return { error: `Could not remove linked orders: ${ordersError.message}` }

  // Delete the ticket row.
  const { error: ticketError } = await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId)
    .eq('seller_id', user.id)

  if (ticketError) return { error: ticketError.message }

  // Clean up the uploaded file from Storage.
  if (ticket.ticket_file_path) {
    await supabase.storage
      .from('ticket-files')
      .remove([ticket.ticket_file_path])
  }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { error: null }
}
