'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeOrders, RAW_FETCH_CAP } from '@/lib/utils/normalize-orders'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { GamepassWithGame, OrderWithDetails, RobloxAccount } from '@/lib/types/database'

const ORDER_SELECT = '*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)'

// A BudgetWise cart can hold more rows than fit under the fetch cap. When the
// cap is hit, any order_number appearing near the boundary may have siblings
// past it, so those numbers are re-fetched in full — otherwise one checkout
// would normalize into two half logical orders.
const BOUNDARY_WINDOW = 20

export interface OrdersData {
  rawOrders: OrderWithDetails[]
  logicalOrders: LogicalOrder[]
  rawById: Map<string, OrderWithDetails>
  accounts: RobloxAccount[]
  gamepasses: GamepassWithGame[]
  loading: boolean
  capped: boolean
  refresh: () => Promise<LogicalOrder[]>
  applyLocalDelete: (orderIds: Set<string>) => void
}

export function useOrdersData(onError: (message: string) => void): OrdersData {
  const supabase = useMemo(() => createClient(), [])
  const [rawOrders, setRawOrders] = useState<OrderWithDetails[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [loading, setLoading] = useState(true)
  const [capped, setCapped] = useState(false)

  const seqRef = useRef(0)
  const rawRef = useRef(rawOrders)
  const errorRef = useRef(onError)
  useEffect(() => {
    rawRef.current = rawOrders
  }, [rawOrders])
  useEffect(() => {
    errorRef.current = onError
  })

  const refresh = useCallback(async (): Promise<LogicalOrder[]> => {
    const requestId = ++seqRef.current
    setLoading(true)
    let next: LogicalOrder[] = []

    try {
      const [ordRes, accRes, gpRes] = await Promise.all([
        supabase
          .from('orders')
          .select(ORDER_SELECT)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(RAW_FETCH_CAP),
        supabase.from('roblox_accounts').select('*').eq('status', 'active'),
        supabase
          .from('gamepasses')
          .select('*, games(*)')
          .order('is_active', { ascending: false })
          .order('name'),
      ])

      if (ordRes.error) {
        if (requestId === seqRef.current) errorRef.current(`Could not load orders: ${ordRes.error.message}`)
      } else if (ordRes.data) {
        let rows = ordRes.data as OrderWithDetails[]
        const isCapped = rows.length >= RAW_FETCH_CAP

        if (isCapped && rows.length > 0) {
          const boundaryNums = new Set(
            rows
              .slice(-BOUNDARY_WINDOW)
              .map(r => r.order_number?.trim())
              .filter((n): n is string => !!n),
          )
          if (boundaryNums.size > 0) {
            const { data: siblings } = await supabase
              .from('orders')
              .select(ORDER_SELECT)
              .in('order_number', Array.from(boundaryNums))
            if (siblings && siblings.length > 0) {
              const seen = new Set(rows.map(r => r.id))
              const extra = (siblings as OrderWithDetails[]).filter(s => !seen.has(s.id))
              if (extra.length > 0) rows = [...rows, ...extra]
            }
          }
        }

        if (requestId !== seqRef.current) return normalizeOrders(rawRef.current)
        setRawOrders(rows)
        setCapped(isCapped)
        next = normalizeOrders(rows)
      }

      if (requestId === seqRef.current) {
        if (accRes.error) errorRef.current(`Could not load accounts: ${accRes.error.message}`)
        else if (accRes.data) setAccounts(accRes.data as RobloxAccount[])

        if (gpRes.error) errorRef.current(`Could not load gamepasses: ${gpRes.error.message}`)
        else if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
      }
    } catch (err) {
      if (requestId === seqRef.current) {
        errorRef.current(
          err instanceof Error ? err.message : 'Could not load the queue — check your connection.',
        )
      }
    } finally {
      if (requestId === seqRef.current) setLoading(false)
    }

    return requestId === seqRef.current ? next : normalizeOrders(rawRef.current)
  }, [supabase])

  // Deferred by a tick so the first paint is the skeleton rather than a
  // synchronous setState cascade inside the mount effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  // Two operators can work the same queue, and BudgetWise writes orders from
  // outside this app entirely, so the queue follows the database rather than
  // this tab's own actions.
  useEffect(() => {
    const channel = supabase
      .channel('xob-ops-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roblox_accounts' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'robux_reservations' }, () => {
        void refresh()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, supabase])

  const applyLocalDelete = useCallback((orderIds: Set<string>) => {
    if (orderIds.size === 0) return
    setRawOrders(prev => prev.filter(row => !orderIds.has(row.id)))
  }, [])

  const logicalOrders = useMemo(() => normalizeOrders(rawOrders), [rawOrders])
  const rawById = useMemo(() => new Map(rawOrders.map(o => [o.id, o])), [rawOrders])

  return {
    rawOrders,
    logicalOrders,
    rawById,
    accounts,
    gamepasses,
    loading,
    capped,
    refresh,
    applyLocalDelete,
  }
}
