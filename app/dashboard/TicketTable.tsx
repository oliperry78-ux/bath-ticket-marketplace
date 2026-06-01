'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { Ticket } from '@/lib/supabase'
import { markSold, deleteTicket, type ActionState } from './actions'

const initialState: ActionState = { error: null }

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-50 text-green-700',
  reserved: 'bg-blue-50 text-blue-700',
  sold: 'bg-gray-100 text-gray-500',
}

function FileCell({ ticket }: { ticket: Ticket }) {
  if (ticket.ticket_file_path) {
    return (
      <Link
        href={`/api/ticket-file/${ticket.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline transition-colors"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        View file
      </Link>
    )
  }
  return <span className="text-xs text-gray-400">No file</span>
}

function RowActions({ ticket }: { ticket: Ticket }) {
  const [soldState, soldAction, soldPending] = useActionState(markSold, initialState)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTicket, initialState)

  return (
    <div className="flex items-center gap-2">
      {soldState.error && (
        <span className="text-xs text-red-500">{soldState.error}</span>
      )}
      {deleteState.error && (
        <span className="text-xs text-red-500">{deleteState.error}</span>
      )}

      {ticket.status !== 'sold' && (
        <form action={soldAction}>
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <button
            type="submit"
            disabled={soldPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {soldPending ? 'Updating…' : 'Mark Sold'}
          </button>
        </form>
      )}

      <form action={deleteAction}>
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <button
          type="submit"
          disabled={deletePending}
          onClick={(e) => {
            if (!confirm('Delete this listing? This cannot be undone.')) {
              e.preventDefault()
            }
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {deletePending ? 'Deleting…' : 'Delete'}
        </button>
      </form>
    </div>
  )
}

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-12 h-12 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
        <p className="text-gray-400 font-medium">You have no listings yet.</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="flex flex-col gap-4 sm:hidden">
        {tickets.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-gray-900 text-sm leading-snug">{t.event_name}</span>
              <span className="font-bold text-amber-600 text-sm shrink-0">£{t.price.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>{t.venue}</span>
              <span>{new Date(t.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {t.status}
              </span>
              <FileCell ticket={t} />
            </div>
            <div className="flex justify-end">
              <RowActions ticket={t} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Event', 'Venue', 'Date', 'Price', 'Status', 'Listed', 'File', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{t.event_name}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.venue}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(t.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 font-semibold text-amber-600 whitespace-nowrap">£{t.price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <FileCell ticket={t} />
                </td>
                <td className="px-4 py-3">
                  <RowActions ticket={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
