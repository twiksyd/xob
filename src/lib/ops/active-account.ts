'use client'

import { useCallback, useEffect, useState } from 'react'

/* The active fulfillment account — the one the Orders work area spends from.
 *
 * It is per-device operator preference rather than business state, so it lives
 * in localStorage and never in the database. Orders and Accounts share this
 * hook so choosing an account on either page is immediately in force on the
 * other. */

const KEY = 'xob-ops-active-account'

export function useActiveAccount(): [string | null, (id: string) => void] {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Read after mount so the server and client agree on the first render, and
  // off the effect's synchronous path so it does not cascade a second render
  // before paint.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setActiveId(window.localStorage.getItem(KEY))
      } catch {
        /* a blocked storage just means no remembered account */
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const choose = useCallback((id: string) => {
    setActiveId(id)
    try {
      window.localStorage.setItem(KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  return [activeId, choose]
}
