import { supabase } from '@/lib/supabase'
import type { Ticket } from '@/lib/supabase'
import Header from './components/Header'
import TicketBrowser from './components/TicketBrowser'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const today = new Date().toISOString().split('T')[0]

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('status', 'available')
    .gte('event_date', today)
    .order('event_date', { ascending: true })

  if (error) {
    console.error('Failed to load tickets:', error.message)
  }

  const safeTickets: Ticket[] = tickets ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-10">
        <section className="text-center flex flex-col items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Find tickets. <span className="text-amber-500">Sell tickets.</span>
          </h1>
          <p className="text-gray-500 text-base sm:text-lg max-w-md">
            The student-run marketplace for University of Bath events — Bath SU, Komedia, Bridge and more.
          </p>
        </section>

        <section>
          <TicketBrowser tickets={safeTickets} />
        </section>
      </main>

      <footer className="mt-auto border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-gray-400">
          Bath Ticket Marketplace — for students, by students
        </div>
      </footer>
    </div>
  )
}
