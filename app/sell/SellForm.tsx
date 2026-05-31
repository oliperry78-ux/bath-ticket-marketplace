'use client'

import { useActionState, useState } from 'react'
import { createTicket, type FormState } from './actions'

const VENUES = ['Komedia', 'Bridge', 'Labs', 'Other']

const initialState: FormState = { error: null }

export default function SellForm() {
  const [state, action, pending] = useActionState(createTicket, initialState)
  const [fileName, setFileName] = useState<string | null>(null)

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
          <option value="" disabled>Select a venue</option>
          {VENUES.map((v) => (
            <option key={v} value={v}>{v}</option>
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

      {/* File upload */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ticket_file" className="text-sm font-medium text-gray-700">
          Ticket file <span className="text-gray-400 font-normal">(PDF, PNG, JPG — max 10 MB)</span>
        </label>
        <label
          htmlFor="ticket_file"
          className={`relative flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            fileName
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/50'
          }`}
        >
          {fileName ? (
            <>
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-amber-700 text-center break-all">{fileName}</span>
              <span className="text-xs text-amber-500">Click to change</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">Choose a file</span> or drag and drop
              </span>
              <span className="text-xs text-gray-400">PDF, PNG, JPG up to 10 MB</span>
            </>
          )}
          <input
            id="ticket_file"
            name="ticket_file"
            type="file"
            required
            accept=".pdf,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
      >
        {pending ? 'Uploading and listing…' : 'List ticket'}
      </button>
    </form>
  )
}
