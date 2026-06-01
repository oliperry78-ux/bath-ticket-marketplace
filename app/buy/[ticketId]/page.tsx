import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Header from '@/app/components/Header'
import ReserveButton from './ReserveButton'

export const dynamic = 'force-dynamic'

export default async function BuyPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/buy/${ticketId}`)

  // Fetch only available tickets — RLS returns nothing if it's been reserved/sold.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, event_name, venue, event_date, price, seller_id, seller_email, status')
    .eq('id', ticketId)
    .single()

  const isSeller = ticket?.seller_id === user.id
  const isUnavailable = !ticket || ticket.status !== 'available'

  const formattedDate = ticket
    ? new Date(ticket.event_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        {isUnavailable ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Ticket no longer available</h2>
              <p className="mt-1 text-sm text-gray-500">This ticket has already been reserved or sold.</p>
            </div>
            <a href="/" className="text-sm font-medium text-amber-600 hover:text-amber-700">
              ← Back to listings
            </a>
          </div>
        ) : isSeller ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">This is your listing</h2>
              <p className="mt-1 text-sm text-gray-500">You cannot reserve your own ticket.</p>
            </div>
            <a href="/dashboard" className="text-sm font-medium text-amber-600 hover:text-amber-700">
              Go to dashboard →
            </a>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Reserve ticket</h1>
              <p className="mt-1 text-sm text-gray-500">Review the details and confirm your reservation.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 h-2 w-full" />
              <div className="p-6 flex flex-col gap-4">
                <h2 className="text-lg font-bold text-gray-900">{ticket.event_name}</h2>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide">Venue</dt>
                    <dd className="mt-0.5 text-gray-900 font-medium">{ticket.venue}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide">Price</dt>
                    <dd className="mt-0.5 text-amber-600 font-bold text-lg">£{ticket.price.toFixed(2)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide">Date</dt>
                    <dd className="mt-0.5 text-gray-900 font-medium">{formattedDate}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide">Seller</dt>
                    <dd className="mt-0.5 text-gray-900">{ticket.seller_email ?? '—'}</dd>
                  </div>
                </dl>

                <div className="pt-4 border-t border-gray-100">
                  <ReserveButton ticketId={ticket.id} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
