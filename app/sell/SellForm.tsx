'use client'

import { useActionState } from 'react'
import { createTicket, type FormState } from './actions'

const VENUES = ['Komedia', 'Bridge', 'Labs', 'Other']

const initialState: FormState = { error: null }

export default function SellForm() {
  const [state, action, pending] = useActionState(createTicket, initialState)

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event_name" className="text-sm font-medium text-gray-700">
          Event name
        </label>
        <input
          id="event_name"
          name="event_name"
          type="text"
          required
          placeholder="e.g. Wednesday Night Out"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="venue" className="text-sm font-medium text-gray-700">
          Venue
        </label>
        <select
          id="venue"
          name="venue"
          required
          defaultValue=""
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition appearance-none"
        >
          <option value="" disabled>
            Select a venue
          </option>
          {VENUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event_date" className="text-sm font-medium text-gray-700">
          Event date
        </label>
        <input
          id="event_date"
          name="event_date"
          type="date"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className="text-sm font-medium text-gray-700">
          Price (£)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
            £
          </span>
          <input
            id="price"
            name="price"
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
      >
        {pending ? 'Listing ticket…' : 'List ticket'}
      </button>
    </form>
  )
}
