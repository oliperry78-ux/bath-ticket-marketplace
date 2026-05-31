'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type FormState = {
  error: string | null
}

export async function createTicket(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  // Verify the caller is authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to list a ticket.' }
  }

  const event_name = (formData.get('event_name') as string)?.trim()
  const venue = (formData.get('venue') as string)?.trim()
  const event_date = formData.get('event_date') as string
  const priceRaw = formData.get('price') as string

  if (!event_name || !venue || !event_date || !priceRaw) {
    return { error: 'All fields are required.' }
  }

  const price = parseFloat(priceRaw)
  if (isNaN(price) || price < 0) {
    return { error: 'Price must be a valid positive number.' }
  }

  const { error } = await supabase.from('tickets').insert({
    event_name,
    venue,
    event_date,
    price,
    status: 'available',
    seller_id: user.id,
  })

  if (error) {
    return { error: `Could not list ticket: ${error.message}` }
  }

  revalidatePath('/')
  redirect('/')
}
