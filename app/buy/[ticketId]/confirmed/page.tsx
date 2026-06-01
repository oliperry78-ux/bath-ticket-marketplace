import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify this user actually has a pending order for this ticket.
  const { data: order } = await supabase
    .from('orders')
    .select('id, purchase_price, created_at, tickets(event_name, venue, event_date, seller_email)')
    .eq('ticket_id', ticketId)
    .eq('buyer_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!order) redirect('/')

  type TicketRow = {
    event_name: string
    venue: string
    event_date: string
    seller_email: string | null
  }

  // Supabase infers joined relations as arrays; normalise to a single object.
  const ticketsRaw = order.tickets
  const ticket: TicketRow | null =
    Array.isArray(ticketsRaw)
      ? (ticketsRaw[0] as TicketRow) ?? null
      : (ticketsRaw as TicketRow | null)

  const formattedDate = ticket
    ? new Date(ticket.event_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Reservation confirmed!</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Your spot is held. Contact the seller to arrange payment and ticket transfer.
          </p>
        </div>

        {ticket && (
          <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left">
            <p className="font-semibold text-gray-900">{ticket.event_name}</p>
            <div className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
              <span>{ticket.venue} · {formattedDate}</span>
              <span>Price: <strong className="text-amber-600">£{order.purchase_price.toFixed(2)}</strong></span>
              {ticket.seller_email && (
                <span>Seller: <strong className="text-gray-700">{ticket.seller_email}</strong></span>
              )}
            </div>
          </div>
        )}

        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          Back to marketplace
        </Link>
      </div>
    </div>
  )
}
