import { OrderWithDetails } from '@/lib/types/database'

export const ACTIVE_ORDER_STATUSES = ['pending', 'paid'] as const
export const HISTORY_ORDER_STATUSES = ['completed', 'refunded', 'cancelled'] as const

// Orders sitting in pending/paid longer than this are flagged "Stale" — mirrors
// the threshold used by the recommendation system on the dashboard.
export const STALE_ORDER_HOURS = 6

export function isActiveOrder(order: OrderWithDetails): boolean {
  return (ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status)
}

export function isHistoryOrder(order: OrderWithDetails): boolean {
  return (HISTORY_ORDER_STATUSES as readonly string[]).includes(order.status)
}

export function isStaleOrder(order: OrderWithDetails, now: number): boolean {
  if (!isActiveOrder(order)) return false
  const ageHours = (now - new Date(order.created_at).getTime()) / 3_600_000
  return ageHours >= STALE_ORDER_HOURS
}
