import type { OrderWithDetails, OrderItem } from '@/lib/types/database'
import type { LogicalOrder, LogicalOrderItem, LogicalOrderSource } from '@/lib/types/logical-order'

// Maximum raw orders rows fetched before normalization. A BudgetWise cart can
// hold many items; 500 raw rows yields ~100 five-item BW groups, or 500 XOB
// single orders. If the DB has more than this many rows you will see a "capped"
// warning in the UI — a proper server-side RPC or view will be needed for
// accounts with very large order histories.
export const RAW_FETCH_CAP = 500

// BudgetWise Store always generates order numbers with a "BW-" prefix.
// This prefix is the only reliable way to distinguish a BW single-item order
// (one row, no siblings) from a legacy XOB order that also has no order_items.
function isBudgetWiseRef(n: string): boolean {
  return n.startsWith('BW-')
}

// ── Item converters ───────────────────────────────────────────────────────────

function fromBwRow(order: OrderWithDetails): LogicalOrderItem {
  return {
    id: order.id,
    gamepassId: order.gamepass_id,
    // BW rows carry gamepass/game data via the join — use it for names.
    gamepassName: order.gamepasses?.name ?? '—',
    gameName: order.gamepasses?.games?.name ?? null,
    isDiscounted: order.gamepasses?.games?.is_discounted ?? false,
    robuxAmount: order.robux_amount ?? 0,
    // BW already stores extended totals (your_price × quantity) in these columns.
    sellingPrice: order.selling_price ?? 0,
    cost: order.cost ?? 0,
    profit: order.profit ?? 0,
    // Per-item account: each BW row has its own roblox_account_id assignment.
    robloxAccountId: order.roblox_account_id,
    account: order.roblox_accounts ?? null,
  }
}

function fromOrderItem(oi: OrderItem): LogicalOrderItem {
  return {
    id: oi.id,
    gamepassId: oi.gamepass_id ?? null,
    gamepassName: oi.gamepass_name,
    gameName: oi.game_name ?? null,
    // order_items rows don't carry the game's discounted flag; leave false.
    // The Action Center card reads directly from the join on the header row for
    // the single-item case, so discounted styling is preserved there.
    isDiscounted: false,
    robuxAmount: oi.robux_amount,
    sellingPrice: oi.selling_price,
    cost: oi.cost,
    profit: oi.profit,
    // XOB items: account lives on the parent order row, not per order_item.
    robloxAccountId: null,
    account: null,
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────

function computeStatus(rows: OrderWithDetails[]): {
  status: string
  hasMixedStatus: boolean
  statusBreakdown: Record<string, string[]>
} {
  const breakdown: Record<string, string[]> = {}
  for (const row of rows) {
    breakdown[row.status] = [...(breakdown[row.status] ?? []), row.id]
  }
  const statuses = Object.keys(breakdown)
  return {
    status: statuses.length === 1 ? statuses[0] : 'mixed',
    hasMixedStatus: statuses.length > 1,
    statusBreakdown: breakdown,
  }
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeBW(orderNumber: string, group: OrderWithDetails[]): LogicalOrder {
  const sorted = [...group].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const first = sorted[0]
  const { status, hasMixedStatus, statusBreakdown } = computeStatus(sorted)
  return {
    logicalKey: orderNumber,
    orderNumber,
    source: 'budgetwise' as LogicalOrderSource,
    underlyingOrderIds: sorted.map(o => o.id),
    primaryOrderId: first.id,
    buyerName: first.buyer_name,
    buyerRobloxUsername: first.buyer_roblox_username,
    status,
    hasMixedStatus,
    statusBreakdown,
    createdAt: first.created_at,
    robloxAccountId: first.roblox_account_id,
    account: first.roblox_accounts ?? null,
    paymentMethod: first.payment_method,
    notes: first.notes,
    items: sorted.map(fromBwRow),
    // Sum across all rows — BW stores per-item extended amounts in each row.
    totalSellingPrice: sorted.reduce((s, o) => s + (o.selling_price ?? 0), 0),
    totalCost:         sorted.reduce((s, o) => s + (o.cost         ?? 0), 0),
    totalProfit:       sorted.reduce((s, o) => s + (o.profit       ?? 0), 0),
    totalRobux:        sorted.reduce((s, o) => s + (o.robux_amount ?? 0), 0),
  }
}

function normalizeXob(order: OrderWithDetails): LogicalOrder {
  const oi = order.order_items ?? []
  const items: LogicalOrderItem[] = oi.length > 0
    ? oi.map(fromOrderItem)
    : [
        // Legacy XOB orders pre-dating order_items — fall back to the header row.
        {
          id: `${order.id}_item`,
          gamepassId: order.gamepass_id,
          gamepassName: order.gamepasses?.name ?? '—',
          gameName: order.gamepasses?.games?.name ?? null,
          isDiscounted: order.gamepasses?.games?.is_discounted ?? false,
          robuxAmount: order.robux_amount ?? 0,
          sellingPrice: order.selling_price ?? 0,
          cost: order.cost ?? 0,
          profit: order.profit ?? 0,
          robloxAccountId: null,
          account: null,
        },
      ]

  return {
    logicalKey: order.id,
    orderNumber: order.order_number,
    source: 'xob' as LogicalOrderSource,
    underlyingOrderIds: [order.id],
    primaryOrderId: order.id,
    buyerName: order.buyer_name,
    buyerRobloxUsername: order.buyer_roblox_username,
    status: order.status,
    hasMixedStatus: false,
    statusBreakdown: { [order.status]: [order.id] },
    createdAt: order.created_at,
    robloxAccountId: order.roblox_account_id,
    account: order.roblox_accounts ?? null,
    paymentMethod: order.payment_method,
    notes: order.notes,
    items,
    // XOB header row already carries aggregate totals — use them directly.
    totalSellingPrice: order.selling_price ?? items.reduce((s, i) => s + i.sellingPrice, 0),
    totalCost:         order.cost          ?? items.reduce((s, i) => s + i.cost,         0),
    totalProfit:       order.profit        ?? items.reduce((s, i) => s + i.profit,        0),
    totalRobux:        order.robux_amount  ?? items.reduce((s, i) => s + i.robuxAmount,   0),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Collapses a flat array of orders rows into logical orders:
//   • Multiple rows sharing a non-empty order_number → one BudgetWise logical order
//   • Single row with a BW-prefixed order_number and no order_items → BW single
//   • Everything else (XOB header row with optional order_items, no order_number) → XOB
//
// Grouping key: order_number only. Never group by buyer name, username,
// timestamp, product, or status.
export function normalizeOrders(raw: OrderWithDetails[]): LogicalOrder[] {
  const byOrderNumber = new Map<string, OrderWithDetails[]>()
  const withoutNumber: OrderWithDetails[] = []

  for (const order of raw) {
    const num = order.order_number?.trim()
    if (num) {
      const group = byOrderNumber.get(num) ?? []
      group.push(order)
      byOrderNumber.set(num, group)
    } else {
      withoutNumber.push(order)
    }
  }

  const result: LogicalOrder[] = []

  for (const [orderNumber, group] of byOrderNumber) {
    if (group.length > 1 || isBudgetWiseRef(orderNumber)) {
      // Multiple rows sharing an order_number → BudgetWise checkout.
      // Single BW-prefixed row → BudgetWise single-item checkout.
      result.push(normalizeBW(orderNumber, group))
    } else {
      // Single row with an order_number that is NOT a BW prefix →
      // treat as XOB (the DB may auto-assign a number via trigger).
      result.push(normalizeXob(group[0]))
    }
  }

  for (const order of withoutNumber) {
    result.push(normalizeXob(order))
  }

  return result
}

// ── Display helpers ───────────────────────────────────────────────────────────

export interface LogicalItemGroup {
  gamepassId: string | null
  gamepassName: string
  gameName: string | null
  unitRobux: number
  unitPrice: number
  count: number
  subtotal: number
}

// Groups a logical order's items by (gamepassId + unitPrice) so the inspect
// dialog can show "name ×qty — subtotal" when the same gamepass appears twice.
export function groupLogicalItems(items: LogicalOrderItem[]): LogicalItemGroup[] {
  const map = new Map<string, LogicalItemGroup>()
  for (const item of items) {
    const key = `${item.gamepassId ?? item.gamepassName}__${item.sellingPrice}`
    const existing = map.get(key)
    if (existing) {
      existing.count   += 1
      existing.subtotal += item.sellingPrice
    } else {
      map.set(key, {
        gamepassId:   item.gamepassId,
        gamepassName: item.gamepassName,
        gameName:     item.gameName,
        unitRobux:    item.robuxAmount,
        unitPrice:    item.sellingPrice,
        count:        1,
        subtotal:     item.sellingPrice,
      })
    }
  }
  return Array.from(map.values())
}

// Groups items by game name for compact card display.
export function groupItemsByGame(
  items: LogicalOrderItem[],
): Array<{ gameName: string; items: LogicalOrderItem[] }> {
  const map = new Map<string, LogicalOrderItem[]>()
  for (const item of items) {
    const g = item.gameName ?? 'Unknown'
    map.set(g, [...(map.get(g) ?? []), item])
  }
  return Array.from(map.entries()).map(([gameName, items]) => ({ gameName, items }))
}
