import { RobloxAccount, CapitalEvent } from '@/lib/types/database'
import { getAvailableRobux } from './accounts'
import { formatPHP } from './pricing'
import { FIXED_CAPITAL } from '@/lib/constants/restock'

// Unsold Robux is valued at each account's own cost rate (₱ per 1k R$), not
// its selling price — this is what makes inventory a real asset instead of
// "money already spent". Shared by every Capital* dashboard card so the
// numbers always agree. Roblox Plus does not change this — it only reduces
// Robux spent during order fulfillment, not the account's cost basis.
export function calculateInventoryValue(accounts: RobloxAccount[]): number {
  return accounts.reduce(
    (sum, a) => sum + Math.max(0, getAvailableRobux(a)) * (a.robux_cost_rate / 1000),
    0
  )
}

export function calculateBusinessValue(accounts: RobloxAccount[], walletBalance: number): number {
  return walletBalance + calculateInventoryValue(accounts)
}

export function fmtSigned(amount: number): string {
  return amount < 0 ? `−${formatPHP(Math.abs(amount))}` : formatPHP(amount)
}

// Same 🟢/🟡/🔴 funding classification used by the Capital Safety purchase
// simulator, factored out so the automatic capital event created on account
// creation stays in sync with the manual "Record This Purchase" path.
export function classifyPurchase(businessValueBefore: number, cost: number): Pick<
  CapitalEvent,
  'funding_source' | 'profit_used' | 'capital_used' | 'business_value_after' | 'protected_capital_remaining'
> {
  const availableProfit = Math.max(0, businessValueBefore - FIXED_CAPITAL)
  const capitalUsed = Math.max(0, cost - availableProfit)
  const profitUsed = cost - capitalUsed

  let fundingSource: CapitalEvent['funding_source']
  if (capitalUsed === 0) fundingSource = 'profit'
  else if (capitalUsed < cost) fundingSource = 'mixed'
  else fundingSource = 'capital'

  return {
    funding_source: fundingSource,
    profit_used: profitUsed,
    capital_used: capitalUsed,
    business_value_after: businessValueBefore - cost,
    protected_capital_remaining: FIXED_CAPITAL - capitalUsed,
  }
}
