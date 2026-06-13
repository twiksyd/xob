'use client'

import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { RobloxAccount, OrderWithItems } from '@/lib/types/database'
import { formatRobux } from '@/lib/utils/pricing'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { Activity, Package, TrendingDown, Hourglass, Truck, Target, Info } from 'lucide-react'
import {
  ACCOUNT_ROBUX, ACCOUNT_COST, MAX_ACCOUNTS, MAX_INVENTORY,
  VELOCITY_WINDOW_DAYS, TARGET_RUNWAY_DAYS,
} from '@/lib/constants/restock'

interface RestockAdvisorProps {
  accounts: RobloxAccount[]
  completedOrders: OrderWithItems[]
  walletBalance: number
}

type StatusKey = 'restock_now' | 'restock_soon' | 'consider' | 'healthy' | 'overstocked'

const STATUS_META: Record<StatusKey, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  restock_now:  { emoji: '🔴', label: 'Restock Now',         color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.26)' },
  restock_soon: { emoji: '🟠', label: 'Restock Soon',        color: '#fb923c', bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.26)' },
  consider:     { emoji: '🟡', label: 'Consider Restocking', color: '#eab308', bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.26)' },
  healthy:      { emoji: '🟢', label: 'Healthy',             color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.26)' },
  overstocked:  { emoji: '🔵', label: 'Overstocked',         color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.26)' },
}

const FORECAST_MAX_DAYS = 28 // visual scale for the runway forecast bar

function fmtDays(days: number): string {
  if (!Number.isFinite(days) || days >= 99) return '99+'
  return days.toFixed(1)
}

function getActionLabel(status: StatusKey, recommended: number): string {
  switch (status) {
    case 'overstocked':
      return 'Do not purchase additional supplier stock'
    case 'healthy':
      return 'Hold purchases'
    case 'consider':
      return recommended > 0
        ? `Consider buying ${recommended} account${recommended !== 1 ? 's' : ''}`
        : 'Hold purchases — monitor inventory'
    case 'restock_soon':
      return recommended > 0
        ? `Restock soon — buy ${recommended} account${recommended !== 1 ? 's' : ''}`
        : 'Restock soon — wallet can’t cover an account yet'
    case 'restock_now':
      return recommended > 0
        ? `Restock now — buy ${recommended} account${recommended !== 1 ? 's' : ''}`
        : 'Restock now — top up your wallet to buy from the supplier'
  }
}

function getReason(status: StatusKey, runwayDays: number, hasVelocity: boolean, availableInventory: number): string {
  if (!hasVelocity) {
    return availableInventory <= 0
      ? 'Inventory is empty and there is no recent sales history to estimate demand.'
      : 'Not enough recent sales activity to estimate runway — treating current inventory as sufficient for now.'
  }
  const days = fmtDays(runwayDays)
  switch (status) {
    case 'overstocked':
      return `You have approximately ${days} days of inventory — well above your ${TARGET_RUNWAY_DAYS}-day target, so no restock is needed.`
    case 'healthy':
      return `You have approximately ${days} days of inventory remaining — comfortably above your target, so purchases can wait.`
    case 'consider':
      return `Inventory will last approximately ${days} days — getting close to your ${TARGET_RUNWAY_DAYS}-day target window.`
    case 'restock_soon':
      return `Inventory will last only approximately ${days} days — plan to restock soon.`
    case 'restock_now': {
      if (availableInventory <= 0) return 'Inventory is empty — restock as soon as possible.'
      const d = Math.max(1, Math.ceil(runwayDays))
      return `Inventory is projected to run out within ${d} day${d !== 1 ? 's' : ''}.`
    }
  }
}

export default function RestockAdvisor({ accounts, completedOrders, walletBalance }: RestockAdvisorProps) {
  const a = useMemo(() => {
    const availableInventory = accounts.reduce(
      (s, acc) => s + Math.max(0, getAvailableRobux(acc)), 0
    )

    // ── Sales velocity — rolling window of completed orders ────────────────
    const now = Date.now()
    const windowMs = VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
    let recentRobuxSold = 0
    for (const order of completedOrders) {
      const dateStr = order.completed_at ?? order.created_at
      if (!dateStr) continue
      const elapsed = now - new Date(dateStr).getTime()
      if (elapsed > windowMs || elapsed < 0) continue
      const robux = order.order_items?.length
        ? order.order_items.reduce((s, i) => s + i.robux_amount, 0)
        : (order.robux_amount ?? 0)
      recentRobuxSold += robux
    }
    const avgDailyUsage = recentRobuxSold / VELOCITY_WINDOW_DAYS
    const hasVelocity = avgDailyUsage > 0

    const runwayDays = hasVelocity
      ? availableInventory / avgDailyUsage
      : (availableInventory <= 0 ? 0 : Infinity)

    // ── Inventory Coverage classification (inventory-first) ────────────────
    let status: StatusKey
    if (availableInventory <= 0) status = 'restock_now'
    else if (!hasVelocity) status = 'healthy'
    else if (runwayDays < 3) status = 'restock_now'
    else if (runwayDays < 7) status = 'restock_soon'
    else if (runwayDays < 14) status = 'consider'
    else if (runwayDays < 21) status = 'healthy'
    else status = 'overstocked'

    const runwayWith = (extraAccounts: number) =>
      hasVelocity ? (availableInventory + extraAccounts * ACCOUNT_ROBUX) / avgDailyUsage : Infinity

    // ── Smart restock target — how much inventory we'd like on hand ────────
    const targetInventory = hasVelocity
      ? Math.min(MAX_INVENTORY, avgDailyUsage * TARGET_RUNWAY_DAYS)
      : MAX_INVENTORY
    const inventoryGap = Math.max(0, targetInventory - availableInventory)
    const suggestedPurchase = Math.min(MAX_ACCOUNTS, Math.round(inventoryGap / ACCOUNT_ROBUX))
    const overstockAmount = Math.max(0, availableInventory - targetInventory)

    // ── Wallet affordability — only a tie-breaker, not the driver ──────────
    const canAfford = Math.min(MAX_ACCOUNTS, Math.floor(Math.max(0, walletBalance) / ACCOUNT_COST))

    // Inventory status decides WHETHER to buy; affordability only caps HOW MUCH.
    const recommended = (status === 'healthy' || status === 'overstocked')
      ? 0
      : Math.min(canAfford, Math.max(suggestedPurchase, 1))

    const markerPct = Math.min(100, (Math.min(runwayDays, FORECAST_MAX_DAYS) / FORECAST_MAX_DAYS) * 100)

    return {
      availableInventory, avgDailyUsage, hasVelocity, runwayDays, status, runwayWith,
      canAfford, targetInventory, inventoryGap, suggestedPurchase, overstockAmount, recommended, markerPct,
    }
  }, [accounts, completedOrders, walletBalance])

  const meta = STATUS_META[a.status]
  const actionLabel = getActionLabel(a.status, a.recommended)
  const reason = getReason(a.status, a.runwayDays, a.hasVelocity, a.availableInventory)
  const runwayLabel = Number.isFinite(a.runwayDays) ? `${fmtDays(a.runwayDays)} Days` : '—'

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #fb923c70 40%, #f43f5e50 60%, transparent 95%)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(251,146,60,0.22), rgba(244,63,94,0.14))',
            border: '1px solid rgba(251,146,60,0.30)',
            boxShadow: '0 0 20px rgba(251,146,60,0.20)',
          }}
        >
          <Activity className="w-5 h-5" style={{ color: '#fb923c' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Restock Advisor</p>
          <p className="label-caps mt-0.5">Inventory health &amp; sales velocity</p>
        </div>
      </div>

      {/* ── Inventory Coverage badge ── */}
      <div className="flex justify-center mb-4">
        <span className="text-[13px] font-bold px-5 py-2 rounded-full" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
          {meta.emoji} {meta.label}{Number.isFinite(a.runwayDays) ? ` · ${runwayLabel}` : ''}
        </span>
      </div>

      {/* ── Inventory Runway ── */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Available Inventory" value={formatRobux(a.availableInventory)} icon={Package} color="#22d3ee" />
        <MiniStat label="Avg Daily Usage" value={a.hasVelocity ? formatRobux(Math.round(a.avgDailyUsage)) : '—'} icon={TrendingDown} color="#fb923c" />
        <MiniStat label="Runway" value={runwayLabel} icon={Hourglass} color={meta.color} />
      </div>

      {/* ── Forecast bar ── */}
      <div className="mt-4">
        <div className="relative h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(15,13,42,0.06)' }}>
          <div style={{ width: `${(3 / FORECAST_MAX_DAYS) * 100}%`, background: 'rgba(244,63,94,0.35)' }} />
          <div style={{ width: `${((7 - 3) / FORECAST_MAX_DAYS) * 100}%`, background: 'rgba(251,146,60,0.35)' }} />
          <div style={{ width: `${((14 - 7) / FORECAST_MAX_DAYS) * 100}%`, background: 'rgba(234,179,8,0.35)' }} />
          <div style={{ width: `${((21 - 14) / FORECAST_MAX_DAYS) * 100}%`, background: 'rgba(52,211,153,0.35)' }} />
          <div style={{ width: `${((FORECAST_MAX_DAYS - 21) / FORECAST_MAX_DAYS) * 100}%`, background: 'rgba(56,189,248,0.35)' }} />
          <div
            className="absolute top-0 h-full w-[3px] rounded-full"
            style={{ left: `calc(${a.markerPct}% - 1.5px)`, background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-semibold tabular-nums" style={{ color: 'oklch(0.58 0.010 265)' }}>
          <span>0d</span>
          <span>3d</span>
          <span>7d</span>
          <span>14d</span>
          <span>21d</span>
          <span>{FORECAST_MAX_DAYS}d+</span>
        </div>
      </div>

      {/* ── Insights ── */}
      <div className="mt-5 pt-4 space-y-1.5" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <span className="label-caps">Runway Forecast</span>
        <ul className="space-y-1.5 mt-1.5">
          <InsightLine>
            {a.hasVelocity
              ? <>At your current pace, inventory will last approximately <b>{fmtDays(a.runwayDays)} days</b>.</>
              : <>Not enough recent sales data to estimate runway.</>
            }
          </InsightLine>
          {a.hasVelocity && (
            <InsightLine>
              Buying <b>1 account</b> would extend runway to <b>{fmtDays(a.runwayWith(1))} days</b>.
            </InsightLine>
          )}
          {a.hasVelocity && MAX_ACCOUNTS > 1 && (
            <InsightLine>
              Buying <b>{MAX_ACCOUNTS} accounts</b> (full restock) would extend runway to <b>{fmtDays(a.runwayWith(MAX_ACCOUNTS))} days</b>.
            </InsightLine>
          )}
          {a.status === 'overstocked' && (
            <InsightLine>
              Current inventory exceeds your {TARGET_RUNWAY_DAYS}-day target by <b>{formatRobux(Math.round(a.overstockAmount))}</b> — selling through existing stock is more capital-efficient than buying more.
            </InsightLine>
          )}
        </ul>
      </div>

      {/* ── Supplier Decision Panel ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="label-caps">Supplier Decision Panel</span>
        </div>
        <div className="rounded-2xl p-4" style={{ background: `${meta.color}0a`, border: `1px solid ${meta.color}22` }}>
          <p className="label-caps mb-1">Recommendation</p>
          <p className="text-[16px] font-extrabold leading-snug mb-2" style={{ color: meta.color }}>
            {actionLabel}
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'oklch(0.40 0.018 268)' }}>
            <span className="label-caps" style={{ color: 'oklch(0.50 0.014 265)' }}>Reason: </span>
            {reason}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${meta.color}1a` }}>
            <span className="label-caps">Wallet Affordability</span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.18 0.025 270)' }}>
              Can Afford {a.canAfford} Account{a.canAfford !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Smart Restock Target ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
          <span className="label-caps">Smart Restock Target</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <MiniStat label="Current Inventory" value={formatRobux(a.availableInventory)} icon={Package} color="#22d3ee" />
          <MiniStat label="Target Inventory" value={formatRobux(Math.round(a.targetInventory))} icon={Target} color="#a78bfa" />
          <MiniStat label="Suggested Purchase" value={`${a.suggestedPurchase} Account${a.suggestedPurchase !== 1 ? 's' : ''}`} icon={Activity} color="#fb923c" />
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${a.targetInventory > 0 ? Math.min(100, (a.availableInventory / a.targetInventory) * 100) : 0}%`,
              background: '#22d3ee',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: LucideIcon; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
        <span className="label-caps" style={{ color, opacity: 0.85 }}>{label}</span>
      </div>
      <p className="text-[16px] font-extrabold tabular-nums truncate" style={{ color: 'oklch(0.12 0.028 272)' }}>{value}</p>
    </div>
  )
}

function InsightLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: 'oklch(0.40 0.018 268)' }}>
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#22d3ee' }} />
      <span>{children}</span>
    </li>
  )
}
