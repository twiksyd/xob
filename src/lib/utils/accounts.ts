import { RobloxAccount } from '@/lib/types/database'
import { getEffectivePlusRobuxCost } from './pricing'

// Accounts at or below this available-Robux threshold are treated as
// depleted — exhausted inventory that no longer contributes meaningfully
// to fulfillment, forecasting, or restock planning.
export const LOW_STOCK_THRESHOLD = 98

// Accounts above LOW_STOCK_THRESHOLD but below this are "running low" — not yet
// depleted, but worth flagging before they get there. Shared by the recommendation
// engine and the Dashboard's Inventory Health chapter so the two never disagree
// about what counts as "low."
export const RUNNING_LOW_THRESHOLD = 500

export function getAvailableRobux(account: RobloxAccount): number {
  return (account.current_robux ?? 0) - (account.reserved_robux ?? 0)
}

export function isDepleted(account: RobloxAccount): boolean {
  return getAvailableRobux(account) <= LOW_STOCK_THRESHOLD
}

export type AccountHealthTier = 'healthy' | 'low' | 'depleted'

export function classifyAccountHealth(account: RobloxAccount): AccountHealthTier {
  if (isDepleted(account)) return 'depleted'
  if (getAvailableRobux(account) < RUNNING_LOW_THRESHOLD) return 'low'
  return 'healthy'
}

// Rough "orders of runway" an available balance represents, given how much
// Robux a typical recent order consumes. Returns null when there's no recent
// order history to estimate a per-order average from.
export function estimateRunwayOrders(available: number, avgRobuxPerOrder: number): number | null {
  if (avgRobuxPerOrder <= 0) return null
  return Math.max(0, Math.floor(available / avgRobuxPerOrder))
}

export interface RankedAccount extends RobloxAccount {
  available: number
  canAfford: boolean
  depleted: boolean
  tier: number
  score: number
}

// Ranks active accounts for order fulfillment: accounts that can afford the
// order first (tightest fit first, to drain near-empty accounts before fresh
// ones), then accounts with an existing reservation, then everything else,
// depleted last. Shared by AccountSelector (manual picking) and the order
// form's auto-select-on-first-item behavior so the two never disagree on
// what "best" means. robuxRequired is the nominal gamepass amount — each
// Plus account's actual requirement is ~10% lower, so affordability is
// computed per-account rather than against one shared threshold.
export function rankAccountsForOrder(accounts: RobloxAccount[], robuxRequired: number): RankedAccount[] {
  return accounts
    .filter(a => a.status === 'active')
    .map(a => {
      const available = getAvailableRobux(a)
      const required = getEffectivePlusRobuxCost(robuxRequired, a.is_plus_account)
      const canAfford = available >= required
      const depleted = isDepleted(a)
      const hasReservation = (a.reserved_robux ?? 0) > 0
      const tier = canAfford ? 1 : hasReservation ? 2 : depleted ? 4 : 3
      const score = canAfford ? available - required : -1
      return { ...a, available, canAfford, depleted, tier, score }
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      if (a.tier === 1) return a.score - b.score
      return b.available - a.available
    })
}
