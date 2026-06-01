'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Ticket } from '@/lib/supabase'

const VENUES = ['All', 'Komedia', 'Bridge', 'Labs']
const DATE_FILTERS = ['All', 'Today', 'Tomorrow', 'This Week'] as const
type DateFilter = (typeof DATE_FILTERS)[number]

function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const formattedDate = new Date(ticket.event_date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      <div className="bg-gradient-to-br from-yellow-400 to-amber-500 h-2 w-full" />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 flex-1">
            {ticket.event_name}
          </h3>
          <span className="shrink-0 text-lg font-bold text-amber-600">
            £{ticket.price.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {ticket.venue}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formattedDate}
          </span>
        </div>

        {ticket.seller_email && (
          <p className="text-xs text-gray-400 truncate">
            Sold by {ticket.seller_email}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
            available
          </span>
          <Link
            href={`/buy/${ticket.id}`}
            className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            Buy →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function TicketBrowser({ tickets }: { tickets: Ticket[] }) {
  const [search, setSearch] = useState('')
  const [activeVenue, setActiveVenue] = useState('All')
  const [activeDate, setActiveDate] = useState<DateFilter>('All')

  const filtered = useMemo(() => {
    const today = new Date()
    const todayStr = localDateStr(today)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const tomorrowStr = localDateStr(tomorrow)
    const weekLater = new Date(today)
    weekLater.setDate(today.getDate() + 7)
    const weekLaterStr = localDateStr(weekLater)

    return tickets.filter((t) => {
      const matchesVenue = activeVenue === 'All' || t.venue === activeVenue

      const matchesSearch =
        search.trim() === '' ||
        t.event_name.toLowerCase().includes(search.toLowerCase()) ||
        t.venue.toLowerCase().includes(search.toLowerCase())

      const matchesDate =
        activeDate === 'All' ||
        (activeDate === 'Today' && t.event_date === todayStr) ||
        (activeDate === 'Tomorrow' && t.event_date === tomorrowStr) ||
        (activeDate === 'This Week' &&
          t.event_date >= todayStr &&
          t.event_date <= weekLaterStr)

      return matchesVenue && matchesSearch && matchesDate
    })
  }, [tickets, search, activeVenue, activeDate])

  const filterPillClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border ${
      active
        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
        : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600'
    }`

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search events, venues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
        />
      </div>

      {/* Venue filters */}
      <div className="flex flex-wrap gap-2">
        {VENUES.map((venue) => (
          <button
            key={venue}
            onClick={() => setActiveVenue(venue)}
            className={filterPillClass(activeVenue === venue)}
          >
            {venue}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-2">
        {DATE_FILTERS.map((df) => (
          <button
            key={df}
            onClick={() => setActiveDate(df)}
            className={filterPillClass(activeDate === df)}
          >
            {df}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-12 h-12 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <p className="text-gray-400 font-medium">
            {tickets.length === 0 ? 'No tickets currently listed' : 'No tickets match your search'}
          </p>
          {tickets.length > 0 && (
            <button
              onClick={() => { setSearch(''); setActiveVenue('All'); setActiveDate('All') }}
              className="mt-3 text-sm text-amber-500 hover:text-amber-600 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'} available
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
