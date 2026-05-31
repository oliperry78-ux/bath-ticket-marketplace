import { supabase } from '@/lib/supabase'
import type { Ticket } from '@/lib/supabase'
import TicketBrowser from './components/TicketBrowser'

export default async function HomePage() {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .order('event_date', { ascending: true })

  if (error) {
    console.error('Failed to load tickets:', error.message)
  }

  const safeTickets: Ticket[] = tickets ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              Bath Ticket Marketplace
            </span>
          </div>
          <span className="hidden sm:block text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
            University of Bath
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-10">
        {/* Hero */}
        <section className="text-center flex flex-col items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Find tickets. <span className="text-amber-500">Sell tickets.</span>
          </h1>
          <p className="text-gray-500 text-base sm:text-lg max-w-md">
            The student-run marketplace for University of Bath events — Bath SU, Komedia, Bridge and more.
          </p>
        </section>

        {/* Ticket browser with search + filters */}
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
