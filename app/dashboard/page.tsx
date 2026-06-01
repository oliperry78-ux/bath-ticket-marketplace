import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Ticket } from '@/lib/supabase'
import Header from '@/app/components/Header'
import TicketTable from './TicketTable'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/dashboard')

  const [{ data: tickets, error }, { data: reservations }] = await Promise.all([
    supabase
      .from('tickets')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    // SECURITY DEFINER function — joins orders → auth.users to get the buyer
    // email for each pending reservation owned by this seller. auth.users is not
    // in the public schema so PostgREST cannot join it directly; the function
    // handles that internally while enforcing auth.uid() = seller_id.
    supabase.rpc('get_seller_reservations'),
  ])

  if (error) console.error('Dashboard fetch error:', error.message)

  const safeTickets: Ticket[] = tickets ?? []

  type ReservationRow = { ticket_id: string; buyer_email: string }
  const buyerEmails: Record<string, string> = Object.fromEntries(
    ((reservations as ReservationRow[] | null) ?? []).map((r) => [r.ticket_id, r.buyer_email]),
  )
  const counts = {
    available: safeTickets.filter((t) => t.status === 'available').length,
    reserved: safeTickets.filter((t) => t.status === 'reserved').length,
    sold: safeTickets.filter((t) => t.status === 'sold').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
        {/* Page title */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">My Listings</h1>
            <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New listing
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Available', value: counts.available, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Reserved', value: counts.reserved, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Sold', value: counts.sold, color: 'text-gray-600', bg: 'bg-gray-100' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${bg} ${color} text-lg font-bold mb-1`}>
                {value}
              </div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Ticket table */}
        <TicketTable tickets={safeTickets} buyerEmails={buyerEmails} />
      </main>
    </div>
  )
}
