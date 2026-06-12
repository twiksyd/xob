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

export interface OrderItemGroup {
  gamepass_id: string | null
  gamepass_name: string
  game_name: string | null
  unit_robux: number
  unit_price: number
  count: number
  subtotal: number
}

// Groups an order's line items by gamepass + unit price so the inspection UI
// can show "name ×qty — subtotal" instead of one row per unit. Falls back to
// the order's own top-level fields for legacy single-gamepass orders that
// have no order_items rows.
export function groupOrderItems(order: OrderWithDetails): OrderItemGroup[] {
  const items = order.order_items ?? []

  if (items.length === 0) {
    if (!order.gamepass_id && !order.gamepasses) return []
    return [{
      gamepass_id: order.gamepass_id,
      gamepass_name: order.gamepasses?.name ?? 'Gamepass',
      game_name: order.gamepasses?.games?.name ?? null,
      unit_robux: order.robux_amount ?? 0,
      unit_price: order.selling_price ?? 0,
      count: 1,
      subtotal: order.selling_price ?? 0,
    }]
  }

  const map = new Map<string, OrderItemGroup>()
  items.forEach(item => {
    const key = `${item.gamepass_id ?? item.gamepass_name}__${item.selling_price}`
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.subtotal += item.selling_price
    } else {
      map.set(key, {
        gamepass_id: item.gamepass_id,
        gamepass_name: item.gamepass_name,
        game_name: item.game_name,
        unit_robux: item.robux_amount,
        unit_price: item.selling_price,
        count: 1,
        subtotal: item.selling_price,
      })
    }
  })
  return Array.from(map.values())
}
