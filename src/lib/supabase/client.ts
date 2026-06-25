import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const url = SUPABASE_URL.startsWith('http') ? SUPABASE_URL : 'https://placeholder.supabase.co'
const key = SUPABASE_KEY.startsWith('eyJ') ? SUPABASE_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

// Supabase's REST requests are plain fetch() calls with no explicit
// Cache-Control header, so without this override a browser (or any proxy
// in between) is free to serve a previously-cached response for a later
// request with an identical URL. This is what made a newly-created order
// stay invisible on a second device even after several hard reloads — the
// reload still hit the same cached response instead of the network.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: 'no-store' })
}

export function createClient() {
  return createBrowserClient(url, key, { global: { fetch: noStoreFetch } })
}
