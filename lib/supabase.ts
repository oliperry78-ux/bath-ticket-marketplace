import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

export type Ticket = {
  id: string
  event_name: string
  venue: string
  event_date: string
  price: number
  seller_id: string
  ticket_image_url: string | null
  ticket_file_path: string | null
  status: string
  created_at: string
}
