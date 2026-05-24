export const ROBUX_RATE = 240 // PHP per 1000 Robux

export function calculateCost(robuxAmount: number, rate = ROBUX_RATE): number {
  return (robuxAmount / 1000) * rate
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
  return '₱' + amount.toFixed(2)
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
