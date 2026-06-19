'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * String-valued page state (active tab, filter, period…) that's synced to a URL
 * query param instead of living only in memory. Gives every view using it, for
 * free: deep linking (open the URL, land on the right view), working back/forward
 * (the URL is the single source of truth, read fresh on every render — no local
 * state that can drift out of sync with it), and refresh-safe state.
 *
 * The param is omitted from the URL entirely when its value equals `defaultValue`,
 * so default views keep a clean URL (e.g. `/accounts`, not `/accounts?tab=accounts`).
 */
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
  validValues?: readonly T[]
): [T, (value: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const raw = searchParams.get(key)
  const value: T = raw && (!validValues || (validValues as readonly string[]).includes(raw))
    ? (raw as T)
    : defaultValue

  const update = useCallback((next: T) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === defaultValue) params.delete(key)
    else params.set(key, next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams, key, defaultValue])

  return [value, update]
}
