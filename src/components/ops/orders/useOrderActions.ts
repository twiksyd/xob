'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { RobloxAccount } from '@/lib/types/database'

/* Every financial mutation in the console goes through here.
 *
 * The rules this file must not drift from:
 *   • Status changes go through transition_order per underlying row — never a
 *     direct .update() on the status column. transition_order is what writes
 *     the wallet_transactions row, the transactions row and the savings
 *     allocation; a plain UPDATE silently skips all three.
 *   • Completion goes through claim_logical_order + complete_logical_order,
 *     which complete every row of a BudgetWise checkout in one transaction.
 *   • Reserved Robux is only ever moved by the assignment RPCs. Nothing here
 *     writes roblox_accounts.reserved_robux / current_robux directly.
 */

export interface StatusResult {
  ok: boolean
  succeeded: number
  failed: Array<{ id: string; message: string }>
  message?: string
}

export interface ItemAssignResult {
  itemId: string
  gamepassName: string
  accountId: string | null
  ok: boolean
  error: string | null
}

export interface DeleteResult {
  logicalKey: string
  ok: boolean
  deletedRows: number
  totalRows: number
  error: string | null
}

export type StatusOptions = { silent?: boolean; refresh?: boolean }

interface Deps {
  refresh: () => Promise<LogicalOrder[]>
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }
}

export function useOrderActions({ refresh, toast }: Deps) {
  const supabase = useMemo(() => createClient(), [])
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const inFlight = useRef<Set<string>>(new Set())

  // Kept in a ref so the mutation callbacks below never list `toast` as a
  // dependency — they must stay referentially stable across renders.
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })

  /* ── Status ─────────────────────────────────────────────────────────── */

  const setStatus = useCallback(
    async (lo: LogicalOrder, newStatus: string, options: StatusOptions = {}): Promise<StatusResult> => {
      const silent = options.silent ?? false
      const doRefresh = options.refresh ?? true

      if (!lo.hasMixedStatus && lo.status === newStatus) {
        return { ok: true, succeeded: 0, failed: [] }
      }
      if (inFlight.current.has(lo.logicalKey)) {
        const message = 'Order is already updating.'
        return {
          ok: false,
          succeeded: 0,
          failed: lo.underlyingOrderIds.map(id => ({ id, message })),
          message,
        }
      }

      inFlight.current.add(lo.logicalKey)
      setBusyKey(lo.logicalKey)

      const finish = () => {
        inFlight.current.delete(lo.logicalKey)
        setBusyKey(null)
      }

      // Completion: one atomic RPC covers every row of the logical order.
      if (newStatus === 'completed') {
        const { error: claimError } = await supabase.rpc('claim_logical_order', {
          p_order_id: lo.primaryOrderId,
        })
        if (claimError) {
          finish()
          const message = `Could not claim order: ${claimError.message}`
          if (!silent) toastRef.current.error(message)
          return { ok: false, succeeded: 0, failed: lo.underlyingOrderIds.map(id => ({ id, message })), message }
        }

        const { error } = await supabase.rpc('complete_logical_order', { p_order_id: lo.primaryOrderId })
        finish()
        if (error) {
          const message = `Could not complete order: ${error.message}`
          if (!silent) toastRef.current.error(message)
          if (doRefresh) await refresh()
          return { ok: false, succeeded: 0, failed: lo.underlyingOrderIds.map(id => ({ id, message })), message }
        }
        if (!silent) toastRef.current.success('Order completed.')
        if (doRefresh) await refresh()
        return { ok: true, succeeded: lo.underlyingOrderIds.length, failed: [] }
      }

      // Claim before any forward transition, but never when reversing an order
      // out of the queue (cancel/refund) or when it is already completed.
      const shouldClaim = lo.status !== 'completed' && newStatus !== 'cancelled' && newStatus !== 'refunded'
      if (shouldClaim) {
        const { error: claimError } = await supabase.rpc('claim_logical_order', {
          p_order_id: lo.primaryOrderId,
        })
        if (claimError) {
          finish()
          const message = `Could not claim order: ${claimError.message}`
          if (!silent) toastRef.current.error(message)
          return { ok: false, succeeded: 0, failed: lo.underlyingOrderIds.map(id => ({ id, message })), message }
        }
      }

      const results = await Promise.all(
        lo.underlyingOrderIds.map(async id => {
          try {
            const { error } = await supabase.rpc('transition_order', {
              p_order_id: id,
              p_new_status: newStatus,
            })
            return { id, message: error?.message ?? null }
          } catch (err) {
            return { id, message: err instanceof Error ? err.message : 'Unknown transition error' }
          }
        }),
      )

      const failed = results
        .filter((r): r is { id: string; message: string } => r.message !== null)
        .map(r => ({ id: r.id, message: r.message }))
      const succeeded = results.length - failed.length
      const failedRows = failed.map(f => f.id.slice(0, 8)).join(', ')
      const message =
        failed.length === 0
          ? undefined
          : succeeded === 0
            ? `Could not update order status: ${failed[0].message}`
            : `Only ${succeeded}/${results.length} rows were marked ${newStatus}. Failed: ${failedRows}. ${failed[0].message}`

      if (!silent) {
        if (failed.length > 0) toastRef.current.error(message ?? 'Could not update order status.')
        else toastRef.current.success(`Order marked ${newStatus}.`)
      }

      finish()
      if (doRefresh) await refresh()
      return { ok: failed.length === 0, succeeded, failed, message }
    },
    [supabase, refresh],
  )

  /* ── Assignment ─────────────────────────────────────────────────────────
     Whole-order assignment uses assign_logical_order_account, which validates
     aggregate Robux availability and assigns every row of the checkout inside
     one transaction. The per-item path below is for corrections, where items
     of one checkout deliberately land on different accounts. */

  const assignWholeOrder = useCallback(
    async (lo: LogicalOrder, account: RobloxAccount): Promise<{ ok: boolean; error: string | null }> => {
      setBusyKey(lo.logicalKey)
      try {
        const { error } = await supabase.rpc('assign_logical_order_account', {
          p_order_id: lo.primaryOrderId,
          p_account_id: account.id,
        })
        if (error) return { ok: false, error: error.message }
        return { ok: true, error: null }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not assign account.' }
      } finally {
        setBusyKey(null)
      }
    },
    [supabase],
  )

  /* Per-item assignment. Each transition uses the one RPC that is correct for
     it — using the wrong one corrupts reserved_robux:
       null → account : assign_order_account   (atomic assign + reserve)
       A → B          : reassign_order_account (atomic, moves the reservation)
       account → null : release_order_reservation, then null the orders row
       unchanged      : no call at all */
  const saveItemAssignments = useCallback(
    async (
      order: LogicalOrder,
      assignments: Record<string, string | null>,
      accounts: RobloxAccount[],
    ): Promise<ItemAssignResult[]> => {
      // Combined per-account check before touching the database: several items
      // of the same checkout can target one account, and each item would pass
      // on its own while the total does not fit. Reservations this save is
      // about to release count back as headroom.
      const required = new Map<string, number>()
      for (const item of order.items) {
        const target = assignments[item.id]
        if (!target) continue
        if (target === item.robloxAccountId) continue
        required.set(target, (required.get(target) ?? 0) + item.robuxAmount)
      }

      const errors = new Map<string, string>()
      for (const [accountId, need] of required) {
        const account = accounts.find(a => a.id === accountId)
        if (!account) continue
        const freed = order.items
          .filter(i => i.robloxAccountId === accountId && assignments[i.id] !== accountId)
          .reduce((sum, i) => sum + i.robuxAmount, 0)
        const effective = (account.current_robux ?? 0) - (account.reserved_robux ?? 0) + freed
        if (effective < need) {
          errors.set(
            accountId,
            `${account.username} needs ${need.toLocaleString()} R$ but only ${effective.toLocaleString()} R$ is effectively available.`,
          )
        }
      }

      if (errors.size > 0) {
        return order.items.map(item => {
          const target = assignments[item.id] ?? null
          const error = target ? (errors.get(target) ?? null) : null
          return {
            itemId: item.id,
            gamepassName: item.gamepassName,
            accountId: target,
            ok: !error,
            error,
          }
        })
      }

      const results: ItemAssignResult[] = []
      for (const item of order.items) {
        const next = assignments[item.id] ?? null
        const prev = item.robloxAccountId ?? null
        const base = { itemId: item.id, gamepassName: item.gamepassName, accountId: next }

        if (next === prev) {
          results.push({ ...base, ok: true, error: null })
          continue
        }

        if (next === null) {
          const released = await supabase.rpc('release_order_reservation', { p_order_id: item.id })
          if (released.error) {
            results.push({ ...base, ok: false, error: released.error.message })
            continue
          }
          const cleared = await supabase.from('orders').update({ roblox_account_id: null }).eq('id', item.id)
          results.push({ ...base, ok: !cleared.error, error: cleared.error?.message ?? null })
          continue
        }

        if (prev !== null) {
          const res = await supabase.rpc('reassign_order_account', {
            p_order_id: item.id,
            p_new_account_id: next,
          })
          results.push({ ...base, ok: !res.error, error: res.error?.message ?? null })
          continue
        }

        const res = await supabase.rpc('assign_order_account', {
          p_order_id: item.id,
          p_account_id: next,
        })
        results.push({ ...base, ok: !res.error, error: res.error?.message ?? null })
      }

      return results
    },
    [supabase],
  )

  /* ── Removal ─────────────────────────────────────────────────────────── */

  // cancel_logical_order is history-preserving: it cancels every row of the
  // checkout, releases reservations and records who removed it and why. This
  // is the normal way an order leaves the queue.
  const removeFromQueue = useCallback(
    async (lo: LogicalOrder, reason: string): Promise<{ ok: boolean; error: string | null }> => {
      setBusyKey(lo.logicalKey)
      try {
        const { error } = await supabase.rpc('cancel_logical_order', {
          p_order_id: lo.primaryOrderId,
          p_reason: reason,
        })
        if (error) return { ok: false, error: error.message }
        return { ok: true, error: null }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not remove order.' }
      } finally {
        setBusyKey(null)
      }
    },
    [supabase],
  )

  // Hard delete, one row at a time through delete_order. A row that is already
  // gone counts as deleted so a retry after a partial failure can finish.
  const deleteOrder = useCallback(
    async (lo: LogicalOrder): Promise<DeleteResult> => {
      let deletedRows = 0
      let error: string | null = null

      for (const id of lo.underlyingOrderIds) {
        const { error: rpcError } = await supabase.rpc('delete_order', { p_order_id: id })
        if (rpcError) {
          const { data, error: lookupError } = await supabase
            .from('orders')
            .select('id')
            .eq('id', id)
            .maybeSingle()
          if (!lookupError && data === null) {
            deletedRows += 1
            continue
          }
          error = rpcError.message
          break
        }
        deletedRows += 1
      }

      const ok = error === null && deletedRows === lo.underlyingOrderIds.length
      return {
        logicalKey: lo.logicalKey,
        ok,
        deletedRows,
        totalRows: lo.underlyingOrderIds.length,
        error: ok
          ? null
          : (error ?? `Only ${deletedRows}/${lo.underlyingOrderIds.length} rows were deleted.`),
      }
    },
    [supabase],
  )

  return {
    busyKey,
    setStatus,
    assignWholeOrder,
    saveItemAssignments,
    removeFromQueue,
    deleteOrder,
  }
}
