import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Header from '@/app/components/Header'
import SellForm from './SellForm'

export default async function SellPage() {
  // Double-check auth server-side (middleware is the first guard,
  // this is the second — defence in depth).
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/sell')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">List a ticket</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details below and your ticket will appear in the marketplace instantly.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <SellForm />
        </div>
      </main>
    </div>
  )
}
