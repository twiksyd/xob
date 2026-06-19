import { OrderWithDetails } from '@/lib/types/database'

// Average Robux consumed per completed order, sampled from the most recent
// orders (assumes the input is already sorted newest-first, same assumption
// the recommendation engine makes). Used to translate a raw available balance
// into "orders of runway" rather than a number nobody can act on.
export function calculateAvgRobuxPerOrder(orders: OrderWithDetails[], sampleSize = 30): number {
  const recentCompleted = orders.filter(o => o.status === 'completed').slice(0, sampleSize)
  if (recentCompleted.length === 0) return 0
  return Math.round(recentCompleted.reduce((s, o) => s + (o.robux_amount ?? 0), 0) / recentCompleted.length)
}

// Robux sold per day, averaged over the last 7 days — the "burn rate" half of
// the Operational Status / Supplier Decision day-of-runway calculations.
export function calculateWeeklyRobuxVelocity(orders: OrderWithDetails[]): number {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recent = orders.filter(o => o.status === 'completed' && new Date(o.created_at) >= sevenDaysAgo)
  const total = recent.reduce((s, o) => s + (o.robux_amount ?? 0), 0)
  return total / 7
}
