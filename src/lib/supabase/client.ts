import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const url = SUPABASE_URL.startsWith('http') ? SUPABASE_URL : 'https://placeholder.supabase.co'
const key = SUPABASE_KEY.startsWith('eyJ') ? SUPABASE_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

export function createClient() {
  return createBrowserClient(url, key)
}
