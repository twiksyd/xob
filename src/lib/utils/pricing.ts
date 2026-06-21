import { LineItem } from '@/lib/types/database'

export const ROBUX_RATE = 240 // PHP per 1000 Robux

export function calculateCost(robuxAmount: number, rate = ROBUX_RATE): number {
  return (robuxAmount / 1000) * rate
}

// Roblox Plus accounts get ~10% better Robux acquisition economics. This is
// the ONLY place that discount is applied — every cost/profit/inventory-
// value/capital calculation that depends on an account's robux_cost_rate
// must derive its rate through this function instead of reading the raw
// column, so the discount is never silently missed or duplicated.
export const PLUS_ACCOUNT_DISCOUNT = 0.10

export function getEffectiveCostRate(robuxCostRate: number, isPlusAccount: boolean): number {
  return isPlusAccount ? robuxCostRate * (1 - PLUS_ACCOUNT_DISCOUNT) : robuxCostRate
}

export function calculateProfit(yourPrice: number, robuxAmount: number, rate = ROBUX_RATE): number {
  return yourPrice - calculateCost(robuxAmount, rate)
}

export function calculateStatus(profit: number): 'Good' | 'Okay' | 'Bad' {
  if (profit >= 20) return 'Good'
  if (profit >= 5) return 'Okay'
  return 'Bad'
}

export function calculateSuggestedLowerPrice(competitorPrice: number): number {
  return Math.max(0, competitorPrice - 5)
}

export function formatRobux(amount: number): string {
  return amount.toLocaleString() + ' R$'
}

export function formatPHP(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function getStatusColor(status: 'Good' | 'Okay' | 'Bad'): string {
  switch (status) {
    case 'Good': return 'text-emerald-400'
    case 'Okay': return 'text-amber-400'
    case 'Bad': return 'text-red-400'
  }
}

export function getStatusBg(status: 'Good' | 'Okay' | 'Bad'): string {
  switch (status) {
    case 'Good': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'Okay': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'Bad': return 'bg-red-500/20 text-red-400 border-red-500/30'
  }
}

export function computeGamepassFields(
  robuxAmount: number,
  yourPrice: number,
  competitorPrice: number,
  rate = ROBUX_RATE
) {
  const your_cost = calculateCost(robuxAmount, rate)
  const profit = yourPrice - your_cost
  const status = calculateStatus(profit)
  const suggested_lower_price = calculateSuggestedLowerPrice(competitorPrice)
  return { your_cost, profit, status, suggested_lower_price }
}

export interface OrderTotals {
  totalRobux: number
  totalPrice: number
  totalCost: number
  totalProfit: number
}

// Account-level cost basis: when the account has a robux_cost_rate set, cost is
// derived from that rate; otherwise falls back to each line item's own cost.
export function calculateOrderTotals(items: LineItem[], accountRate: number): OrderTotals {
  const totalRobux = items.reduce((sum, item) => sum + item.robux_amount, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.selling_price, 0)
  const totalCost = accountRate > 0
    ? Math.round(items.reduce((sum, item) => sum + (item.robux_amount / 1000) * accountRate, 0) * 100) / 100
    : items.reduce((sum, item) => sum + item.cost, 0)
  const totalProfit = totalPrice - totalCost
  return { totalRobux, totalPrice, totalCost, totalProfit }
}
