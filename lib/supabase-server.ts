import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates an auth-aware Supabase client for use in Server Components,
 * Server Actions, and Route Handlers. Always call this per-request —
 * never share a single instance across requests.
 *
 * In Server Components the setAll try/catch swallows the error because
 * Next.js does not allow writing cookies during render; the middleware
 * handles session refresh writes instead.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware handles refresh writes.
          }
        },
      },
    }
  )
}
