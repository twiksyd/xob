export type StatusLevel = 'green' | 'yellow' | 'red'

export interface OperationalStatus {
  level: StatusLevel
  message: string
}

// Answers "if I do nothing today, am I safe?" — purely from available Robux
// vs. recent burn rate. Outstanding orders are already reflected here: their
// Robux sits in reserved_robux, which getAvailableRobux() already subtracts,
// so there's no separate term for them.
export function getOperationalStatus(totalAvailableRobux: number, dailyVelocity: number): OperationalStatus {
  if (totalAvailableRobux <= 0) {
    return { level: 'red', message: 'No available inventory left — restock immediately' }
  }
  if (dailyVelocity <= 0) {
    return { level: 'green', message: 'No recent depletion — inventory stable' }
  }
  const days = totalAvailableRobux / dailyVelocity
  if (days >= 7) {
    return { level: 'green', message: `Safe for ~${Math.round(days)} days at current sales pace` }
  }
  if (days >= 3) {
    return { level: 'yellow', message: `Inventory likely needs attention within ${Math.ceil(days)} days` }
  }
  const hours = Math.max(1, Math.round(days * 24))
  return { level: 'red', message: `Inventory risk expected within ${hours} hours` }
}

export type SupplierVerdict = 'HOLD PURCHASES' | 'BUY 1 ACCOUNT' | 'BUY 2 ACCOUNTS' | 'FULL RESTOCK'

export interface SupplierDecision {
  verdict: SupplierVerdict
  message: string
}

const VERDICTS: SupplierVerdict[] = ['HOLD PURCHASES', 'BUY 1 ACCOUNT', 'BUY 2 ACCOUNTS', 'FULL RESTOCK']

function actionLine(verdict: SupplierVerdict): string {
  switch (verdict) {
    case 'HOLD PURCHASES': return 'No purchases needed right now.'
    case 'BUY 1 ACCOUNT': return 'Buying 1 account restores coverage.'
    case 'BUY 2 ACCOUNTS': return 'Buying 2 accounts restores full coverage.'
    case 'FULL RESTOCK': return 'A full restock pass is needed.'
  }
}

// Primarily driven by account coverage (how many accounts are low/depleted),
// with one escalation step if the depletion pace (runwayDays) is outrunning
// what the account snapshot alone suggests. Wallet balance never factors in —
// this is a stock-coverage decision, not an affordability one.
export function getSupplierDecision(criticalAccounts: number, runwayDays: number | null): SupplierDecision {
  const baseTier = Math.min(criticalAccounts, 3)
  const escalate = runwayDays !== null && runwayDays < 3 && baseTier < 3
  const tier = escalate ? baseTier + 1 : baseTier
  const verdict = VERDICTS[tier]

  const coverageLine = criticalAccounts === 0
    ? 'All accounts are within healthy stock levels'
    : `${criticalAccounts} account${criticalAccounts === 1 ? '' : 's'} ${criticalAccounts === 1 ? 'is' : 'are'} low or depleted`

  const message = escalate
    ? `${coverageLine}, but depletion pace is faster than that alone suggests — ${actionLine(verdict)}`
    : `${coverageLine}. ${actionLine(verdict)}`

  return { verdict, message }
}
