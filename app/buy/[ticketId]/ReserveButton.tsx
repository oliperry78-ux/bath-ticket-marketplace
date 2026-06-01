'use client'

import { useActionState } from 'react'
import { reserveTicket, type ReserveState } from './actions'

const initialState: ReserveState = { error: null }

export default function ReserveButton({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(reserveTicket, initialState)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="ticket_id" value={ticketId} />

      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
      >
        {pending ? 'Confirming…' : 'Confirm Reservation'}
      </button>
      <p className="text-xs text-center text-gray-400">
        No payment is taken now. The seller will contact you to arrange transfer.
      </p>
    </form>
  )
}
