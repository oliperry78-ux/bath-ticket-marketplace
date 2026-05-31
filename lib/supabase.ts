import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

export type Ticket = {
  id: string
  title: string
  venue: string
  price: number
  date: string
  description: string | null
  quantity: number
  created_at: string
}
