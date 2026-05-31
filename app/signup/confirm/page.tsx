import Link from 'next/link'

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            We sent you a confirmation link. Click it to activate your account, then come back to log in.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          Go to login
        </Link>
      </div>
    </div>
  )
}
