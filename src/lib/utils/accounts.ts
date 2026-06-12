import { RobloxAccount } from '@/lib/types/database'

// Accounts at or below this available-Robux threshold are treated as
// depleted — exhausted inventory that no longer contributes meaningfully
// to fulfillment, forecasting, or restock planning.
export const LOW_STOCK_THRESHOLD = 98

export function getAvailableRobux(account: RobloxAccount): number {
  return (account.current_robux ?? 0) - (account.reserved_robux ?? 0)
}

export function isDepleted(account: RobloxAccount): boolean {
  return getAvailableRobux(account) <= LOW_STOCK_THRESHOLD
}
