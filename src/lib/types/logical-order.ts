import type { RobloxAccount } from '@/lib/types/database'

export type LogicalOrderSource = 'xob' | 'budgetwise'

// One display item within a logical order regardless of origin.
// XOB source: maps from an order_items row.
// BudgetWise source: maps from an orders row (each row = one purchased item).
export interface LogicalOrderItem {
  id: string
  gamepassId: string | null
  gamepassName: string
  gameName: string | null
  isDiscounted: boolean
  robuxAmount: number
  sellingPrice: number
  cost: number
  profit: number
  // For BudgetWise source: per-item account from each underlying orders row.
  // For XOB source: always null (account lives on the header row only).
  robloxAccountId: string | null
  account: RobloxAccount | null
}

// A logical order: one checkout from the buyer's perspective.
// May be backed by one orders row (XOB native) or multiple orders rows
// sharing the same order_number (BudgetWise Store).
export interface LogicalOrder {
  // Stable UI key — order_number for BW groups, orders.id for XOB.
  logicalKey: string
  orderNumber: string | null
  source: LogicalOrderSource
  // Every orders.id that belongs to this logical order.
  underlyingOrderIds: string[]
  // First (earliest) underlying order id — used for single-row RPCs and
  // localStorage keys when all rows share a status.
  primaryOrderId: string
  buyerName: string | null
  buyerRobloxUsername: string | null
  // 'mixed' when BW rows within the same checkout have diverged statuses.
  status: string
  hasMixedStatus: boolean
  // Maps each status → the underlying order IDs that carry it (for mixed-status display).
  statusBreakdown: Record<string, string[]>
  // Earliest created_at across all underlying rows.
  createdAt: string
  robloxAccountId: string | null
  // Joined account from the primary row (null for BW orders).
  account: RobloxAccount | null
  paymentMethod: string
  notes: string | null
  items: LogicalOrderItem[]
  // Pre-summed totals. For XOB: taken from the header row. For BW: summed
  // across all underlying rows (BW already stores per-item extended amounts).
  totalSellingPrice: number
  totalCost: number
  totalProfit: number
  totalRobux: number
}
