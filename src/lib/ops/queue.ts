import type { LogicalOrder, LogicalOrderItem } from '@/lib/types/logical-order'
import { isActiveLogicalOrder } from '@/lib/utils/orders'

/* Operational derivations for the order queue.
 *
 * Every predicate here is a direct port of the rules the previous Orders page
 * enforced — they encode what `complete_logical_order` and
 * `assign_logical_order_account` will accept server-side, so the UI can grey
 * out an action for the same reason the RPC would reject it. Client-side
 * checks never replace the server's: the RPCs re-validate everything. */

// Active orders older than this are surfaced as stalled. Matches the window
// the previous queue used for its "Stalled" filter.
export const STALLED_HOURS = 48

export type QueueState = 'unassigned' | 'ready' | 'awaiting-payment' | 'stalled' | 'working'

export function isUnassigned(lo: LogicalOrder): boolean {
  if (lo.source === 'budgetwise') return lo.items.some(i => i.robloxAccountId === null)
  return lo.robloxAccountId === null
}

export function isFullyAssigned(lo: LogicalOrder): boolean {
  if (lo.source === 'budgetwise') return lo.items.every(i => i.robloxAccountId !== null)
  return lo.robloxAccountId !== null
}

export function isReadyToComplete(lo: LogicalOrder): boolean {
  if (lo.hasMixedStatus || lo.status !== 'paid') return false
  return isFullyAssigned(lo)
}

export function completionBlocker(lo: LogicalOrder): string {
  if (lo.hasMixedStatus) return 'Resolve mixed item statuses before completing this order.'
  if (lo.status !== 'paid') {
    return lo.status === 'pending'
      ? 'Mark this order paid before completing it.'
      : 'This order is not in a completable status.'
  }
  if (lo.source === 'budgetwise' && lo.items.some(i => i.robloxAccountId === null)) {
    return 'Assign every item before completing this order.'
  }
  if (lo.source !== 'budgetwise' && lo.robloxAccountId === null) {
    return 'Assign an account before completing this order.'
  }
  return 'This order is not ready to complete.'
}

export function ageHours(lo: LogicalOrder, nowMs: number): number {
  return (nowMs - new Date(lo.createdAt).getTime()) / 3_600_000
}

export function isStalled(lo: LogicalOrder, nowMs: number): boolean {
  return ageHours(lo, nowMs) > STALLED_HOURS
}

export function queueState(lo: LogicalOrder, nowMs: number): QueueState {
  if (isUnassigned(lo)) return 'unassigned'
  if (isReadyToComplete(lo)) return 'ready'
  if (isStalled(lo, nowMs)) return 'stalled'
  if (lo.status === 'pending' && !lo.hasMixedStatus) return 'awaiting-payment'
  return 'working'
}

// BudgetWise checkouts lead the queue: they are the channel the operator is
// paid to clear, and an unassigned one blocks everything downstream of it.
function priority(lo: LogicalOrder, nowMs: number): number {
  const shop = lo.source === 'budgetwise'
  if (shop && isUnassigned(lo)) return 0
  if (shop && isReadyToComplete(lo)) return 1
  if (isUnassigned(lo)) return 2
  if (isReadyToComplete(lo)) return 3
  if (isStalled(lo, nowMs)) return 4
  if (lo.status === 'pending' && !lo.hasMixedStatus) return 5
  return 6
}

export function sortQueue(orders: LogicalOrder[], nowMs: number): LogicalOrder[] {
  return orders
    .filter(isActiveLogicalOrder)
    .sort((a, b) => {
      const pa = priority(a, nowMs)
      const pb = priority(b, nowMs)
      if (pa !== pb) return pa - pb
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

export function assignableItems(lo: LogicalOrder): LogicalOrderItem[] {
  if (lo.source !== 'budgetwise' || !isActiveLogicalOrder(lo)) return []
  return lo.items.filter(item => item.robloxAccountId === null)
}

// What an account must actually hold to take on the unassigned part of this
// order. The reservation RPCs reserve COALESCE(effective_robux_amount,
// robux_amount) per underlying row — for BudgetWise rows that is the nominal
// amount, so the Plus discount is deliberately NOT applied here. Showing a
// smaller number than the server will reserve would let the operator pick an
// account the RPC then rejects.
export function requiredRobux(lo: LogicalOrder): number {
  const pending = assignableItems(lo)
  if (pending.length > 0) return pending.reduce((sum, i) => sum + i.robuxAmount, 0)
  return isUnassigned(lo) ? lo.totalRobux : 0
}

/* ── Bulk finalize classification ───────────────────────────────────────────
   Walks the same status/assignment rules as isReadyToComplete, but also covers
   orders still sitting in `pending` — finalizing is allowed to catch an order
   up through paid → completed in one pass, exactly as clicking the two buttons
   in sequence would. */

export type FinalizeKind =
  | 'ready'
  | 'needs_account'
  | 'already_completed'
  | 'invalid_status'
  | 'other_blocker'

export interface FinalizeCandidate {
  lo: LogicalOrder
  kind: FinalizeKind
  reason: string | null
  steps: string[]
}

export function classifyForFinalize(lo: LogicalOrder): FinalizeCandidate {
  if (lo.hasMixedStatus) {
    return { lo, kind: 'other_blocker', reason: 'Mixed item statuses — resolve individually.', steps: [] }
  }
  if (lo.status === 'completed') {
    return { lo, kind: 'already_completed', reason: 'Already completed.', steps: [] }
  }
  if (lo.status === 'cancelled' || lo.status === 'refunded') {
    return { lo, kind: 'invalid_status', reason: `Order is ${lo.status} — cannot finalize.`, steps: [] }
  }
  if (lo.status !== 'pending' && lo.status !== 'paid') {
    return { lo, kind: 'other_blocker', reason: `Order is ${lo.status} — finalize this one individually.`, steps: [] }
  }
  if (isUnassigned(lo)) {
    return { lo, kind: 'needs_account', reason: 'Missing required account assignment.', steps: [] }
  }
  return {
    lo,
    kind: 'ready',
    reason: null,
    steps: lo.status === 'pending' ? ['paid', 'completed'] : ['completed'],
  }
}

/* ── Display helpers ──────────────────────────────────────────────────────── */

// The operator identifies a ticket by the customer's Facebook name, not by an
// order number — so that is what leads every row, header and dialog.
export function ticketName(lo: LogicalOrder): string {
  return lo.buyerName?.trim() || lo.buyerRobloxUsername?.trim() || 'Unnamed customer'
}

export function ticketRef(lo: LogicalOrder): string {
  return lo.orderNumber ?? `XOB-${lo.primaryOrderId.slice(0, 6).toUpperCase()}`
}

export function relativeAge(nowMs: number, iso: string): string {
  const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

// Items collapsed to "2× Leopard" lines, kept in game order so an operator
// reading down the list works through one Roblox game at a time.
export interface ItemLine {
  key: string
  gamepassName: string
  gameName: string | null
  isDiscounted: boolean
  unitRobux: number
  qty: number
  robux: number
  price: number
  itemIds: string[]
  accountIds: Array<string | null>
}

export function itemLines(items: LogicalOrderItem[]): ItemLine[] {
  const map = new Map<string, ItemLine>()
  for (const item of items) {
    const key = `${item.gamepassId ?? item.gamepassName}__${item.robuxAmount}`
    const existing = map.get(key)
    if (existing) {
      existing.qty += 1
      existing.robux += item.robuxAmount
      existing.price += item.sellingPrice
      existing.itemIds.push(item.id)
      existing.accountIds.push(item.robloxAccountId)
    } else {
      map.set(key, {
        key,
        gamepassName: item.gamepassName,
        gameName: item.gameName,
        isDiscounted: item.isDiscounted,
        unitRobux: item.robuxAmount,
        qty: 1,
        robux: item.robuxAmount,
        price: item.sellingPrice,
        itemIds: [item.id],
        accountIds: [item.robloxAccountId],
      })
    }
  }
  return Array.from(map.values())
}

export function groupLinesByGame(lines: ItemLine[]): Array<{ game: string; lines: ItemLine[] }> {
  const map = new Map<string, ItemLine[]>()
  for (const line of lines) {
    const game = line.gameName ?? 'Other'
    map.set(game, [...(map.get(game) ?? []), line])
  }
  return Array.from(map.entries()).map(([game, lines]) => ({ game, lines }))
}
