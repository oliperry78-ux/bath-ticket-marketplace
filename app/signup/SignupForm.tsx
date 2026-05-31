'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp, type AuthFormState } from '@/app/actions/auth'

const initialState: AuthFormState = { error: null }

export default function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initialState)

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@bath.ac.uk"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition"
        />
        <p className="text-xs text-gray-400">Minimum 6 characters</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
          Log in
        </Link>
      </p>
    </form>
  )
}
