import { OrderWithDetails, RobloxAccount, ReservationWithDetails } from '@/lib/types/database'
import { formatRobux, formatPHP } from '@/lib/utils/pricing'
import { getAvailableRobux, estimateRunwayOrders, RUNNING_LOW_THRESHOLD } from '@/lib/utils/accounts'
import { calculateAvgRobuxPerOrder } from '@/lib/utils/velocity'

export interface Recommendation {
  id: string
  headline: string
  reasoning: string
  impact: string
  ifNothing: string
  score: number
  action: {
    label: string
    href?: string
    run?: () => Promise<void> | void
  }
}

interface BuildInput {
  orders: OrderWithDetails[]
  accounts: RobloxAccount[]
  reservations: ReservationWithDetails[]
  onAdvanceOrder?: (order: OrderWithDetails, nextStatus: 'paid' | 'completed') => Promise<void>
}

const STALE_ORDER_HOURS = 6
const STUCK_RESERVATION_HOURS = 48
const OVERCOMMIT_RATIO = 0.7

function ageLabel(hours: number): string {
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * Scores every "thing worth doing" against every other thing worth doing,
 * so the operator gets ONE ranked list instead of N separate alert widgets.
 * Score blends: ₱ value at stake, urgency (how fast waiting makes it worse),
 * and resolvability (one-click items are weighted slightly ahead of "go investigate" items).
 */
export function buildRecommendations({ orders, accounts, reservations, onAdvanceOrder }: BuildInput): Recommendation[] {
  const now = Date.now()
  const candidates: Recommendation[] = []

  const recentCompleted = orders.filter(o => o.status === 'completed').slice(0, 30)
  const avgRobuxPerOrder = calculateAvgRobuxPerOrder(orders)
  const avgSellingPrice = recentCompleted.length
    ? recentCompleted.reduce((s, o) => s + (o.selling_price ?? 0), 0) / recentCompleted.length
    : 0

  // ── Candidate type 1: orders stalled in pending / paid ──────────────────
  for (const order of orders) {
    if (order.status !== 'pending' && order.status !== 'paid') continue
    const ageHours = (now - new Date(order.created_at).getTime()) / 3_600_000
    if (ageHours < STALE_ORDER_HOURS) continue

    const value = order.selling_price ?? 0
    const robux = order.robux_amount ?? 0
    const nextStatus: 'paid' | 'completed' = order.status === 'pending' ? 'paid' : 'completed'
    const actionLabel = order.status === 'pending' ? 'Mark Paid' : 'Mark Completed'
    const age = ageLabel(ageHours)

    candidates.push({
      id: `order-${order.id}`,
      headline: `${actionLabel} — Order ${order.order_number ?? '#' + order.id.slice(0, 6)} for ${order.buyer_name ?? 'a buyer'} (${formatPHP(value)})`,
      reasoning: `It's been sitting in "${order.status}" for ${age} — the longer an order waits at this stage, the more likely the buyer disengages or forgets they ordered.`,
      impact: `${formatPHP(value)} in revenue${order.profit ? ` (${formatPHP(order.profit)} profit)` : ''} is riding on this, and ${formatRobux(robux)} stays reserved and unusable elsewhere until it moves.`,
      ifNothing: `The longer this sits, the higher the chance the buyer disappears and you lose the sale outright — and that ${formatRobux(robux)} stays frozen, unable to back any other order, the whole time.`,
      score: value * 0.5 + ageHours * 4 + 20, // +20: this is a one-click resolution, weight it up
      action: {
        label: actionLabel,
        run: onAdvanceOrder ? () => onAdvanceOrder(order, nextStatus) : undefined,
        href: onAdvanceOrder ? undefined : '/orders',
      },
    })
  }

  // ── Candidate type 2: accounts running low on available Robux ───────────
  // These all resolve the same way ("go restock"), so when several accounts
  // qualify at once, surface ONE consolidated recommendation rather than one
  // per account — a wall of near-identical "restock X" cards is exactly the
  // decision fatigue this list is supposed to prevent.
  const lowAccounts = accounts
    .filter(acc => acc.status === 'active')
    .map(acc => ({ acc, available: getAvailableRobux(acc) }))
    .filter(({ available }) => available < RUNNING_LOW_THRESHOLD)
    .sort((a, b) => a.available - b.available)

  const runwayFor = (available: number) => estimateRunwayOrders(available, avgRobuxPerOrder)

  if (lowAccounts.length === 1) {
    const { acc, available } = lowAccounts[0]
    const runway = runwayFor(available)
    const runwayText = runway !== null
      ? `enough for roughly ${runway} more typical order${runway === 1 ? '' : 's'} (your recent average runs ~${formatRobux(avgRobuxPerOrder)} per order)`
      : `running low, with no recent order history yet to estimate runway from`
    const deficit = RUNNING_LOW_THRESHOLD - available
    const runwayUrgency = runway !== null ? Math.max(0, 5 - runway) * 28 : 40

    candidates.push({
      id: `restock-${acc.id}`,
      headline: `Restock "${acc.username}" — only ${formatRobux(available)} available right now`,
      reasoning: `Available balance has dropped to ${formatRobux(available)}, ${runwayText}.`,
      impact: avgSellingPrice > 0 && runway !== null && runway > 0
        ? `Restocking now protects roughly ${formatPHP(avgSellingPrice * runway)} in sales this account could otherwise still fulfill before running dry.`
        : `Restocking keeps this account able to take new orders without interruption.`,
      ifNothing: `If a buyer is matched to this account and it comes up short mid-sale, you'd have to stall the conversation or scramble to switch accounts — exactly the kind of moment that costs you the sale entirely.`,
      score: deficit * 0.6 + runwayUrgency,
      action: { label: 'View Account', href: '/accounts' },
    })
  } else if (lowAccounts.length > 1) {
    const { acc: worst, available: worstAvailable } = lowAccounts[0]
    const runway = runwayFor(worstAvailable)
    const runwayUrgency = runway !== null ? Math.max(0, 5 - runway) * 28 : 40
    const totalShortfall = lowAccounts.reduce((s, { available }) => s + (RUNNING_LOW_THRESHOLD - available), 0)
    const others = lowAccounts.length - 1

    candidates.push({
      id: 'restock-batch',
      headline: `Restock ${lowAccounts.length} accounts running low — "${worst.username}" is worst, with only ${formatRobux(worstAvailable)} left`,
      reasoning: `${lowAccounts.length} active accounts are now under your ${formatRobux(RUNNING_LOW_THRESHOLD)} comfort threshold, "${worst.username}" furthest along (${formatRobux(worstAvailable)} available, ${runway !== null ? `~${runway} order${runway === 1 ? '' : 's'} of runway left` : 'no recent order history to estimate runway'}).`,
      impact: `One restocking pass across these ${lowAccounts.length} accounts covers a combined shortfall of about ${formatRobux(totalShortfall)} — clearing the whole backlog in one trip instead of reacting account-by-account as each one runs dry.`,
      ifNothing: `Each of these accounts can independently come up short mid-sale — and the more of them run dry, the fewer accounts you have left to fall back on, compounding the risk every day you wait.`,
      score: (RUNNING_LOW_THRESHOLD - worstAvailable) * 0.6 + runwayUrgency + Math.min(others * 6, 60),
      action: { label: 'View Accounts', href: '/accounts' },
    })
  }

  // ── Candidate type 3: accounts over-committed by reservations ───────────
  for (const acc of accounts) {
    if (acc.status !== 'active' || acc.current_robux <= 0) continue
    const reserved = acc.reserved_robux ?? 0
    const ratio = reserved / acc.current_robux
    if (ratio < OVERCOMMIT_RATIO || reserved < 200) continue
    const available = getAvailableRobux(acc)

    candidates.push({
      id: `overcommit-${acc.id}`,
      headline: `"${acc.username}" is over-committed — ${formatRobux(reserved)} of ${formatRobux(acc.current_robux)} is locked in active reservations`,
      reasoning: `${Math.round(ratio * 100)}% of this account's balance is currently tied up in active reservations, leaving only ${formatRobux(available)} actually free to sell.`,
      impact: `Effectively, this account can't safely take on much more — its "balance" looks healthy on paper but most of it is already promised to other orders.`,
      ifNothing: `You risk matching a new buyer to this account, only to discover there isn't enough free Robux to cover them — forcing an awkward mid-sale account swap.`,
      score: ratio * 200,
      action: { label: 'View Reservations', href: '/accounts' },
    })
  }

  // ── Candidate type 4: reservations stuck open far longer than normal ────
  for (const res of reservations) {
    if (res.status !== 'active') continue
    const ageHours = (now - new Date(res.created_at).getTime()) / 3_600_000
    if (ageHours < STUCK_RESERVATION_HOURS) continue
    const age = ageLabel(ageHours)

    candidates.push({
      id: `reservation-${res.id}`,
      headline: `Resolve a stuck hold on "${res.roblox_accounts?.username ?? 'an account'}" — ${formatRobux(res.robux_amount)} has been reserved for ${age}`,
      reasoning: `This reservation (order ${res.orders?.order_number ?? '—'}, currently "${res.orders?.status ?? 'unknown'}") has held Robux for ${age} — well beyond how long orders normally take to move forward.`,
      impact: `${formatRobux(res.robux_amount)} sits frozen — completely unsellable to anyone else — for as long as this stays open.`,
      ifNothing: `That Robux stays locked indefinitely with no upside. Push the order to its next stage, or cancel it outright to free the hold and put that Robux back to work.`,
      score: 95 + ageHours * 1.4,
      action: { label: 'View Order', href: '/orders' },
    })
  }

  return candidates.sort((a, b) => b.score - a.score)
}
