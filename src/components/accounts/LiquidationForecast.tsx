'use client'

import { useMemo } from 'react'
import { LucideIcon } from 'lucide-react'
import { RobloxAccount, OrderWithItems } from '@/lib/types/database'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { Sparkles, Wallet, Coins, TrendingUp, Target, Info } from 'lucide-react'

interface LiquidationForecastProps {
  accounts: RobloxAccount[]
  selectedIds: Set<string>
  completedOrders: OrderWithItems[]
  walletBalance: number
}

type FlatItem = { gamepassName: string; robux: number; revenue: number; profit: number }

const GAMEPASS_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#e879f9', '#94a3b8']
const TOP_GAMEPASSES = 4

function fmtSigned(amount: number): string {
  return amount < 0 ? `−${formatPHP(Math.abs(amount))}` : formatPHP(amount)
}

export default function LiquidationForecast({ accounts, selectedIds, completedOrders, walletBalance }: LiquidationForecastProps) {
  const f = useMemo(() => {
    const hasSelection = selectedIds.size > 0
    let scopedAccounts = hasSelection ? accounts.filter(a => selectedIds.has(a.id)) : accounts
    if (scopedAccounts.length === 0) scopedAccounts = accounts

    // ── Available inventory per account ──────────────────────────────────
    const accountInventory = scopedAccounts.map(a => ({
      account: a,
      available: Math.max(0, getAvailableRobux(a)),
    }))
    const totalAvailable = accountInventory.reduce((s, x) => s + x.available, 0)

    // ── Historical sales sample (prefer in-scope accounts) ────────────────
    const scopedIds = new Set(scopedAccounts.map(a => a.id))
    let histOrders = hasSelection
      ? completedOrders.filter(o => o.roblox_account_id && scopedIds.has(o.roblox_account_id))
      : completedOrders
    let usedFallback = false
    if (hasSelection && histOrders.length === 0 && completedOrders.length > 0) {
      histOrders = completedOrders
      usedFallback = true
    }

    const items: FlatItem[] = []
    for (const order of histOrders) {
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          items.push({ gamepassName: item.gamepass_name, robux: item.robux_amount, revenue: item.selling_price, profit: item.profit })
        }
      } else if ((order.robux_amount ?? 0) > 0) {
        items.push({ gamepassName: '—', robux: order.robux_amount ?? 0, revenue: order.selling_price ?? 0, profit: order.profit ?? 0 })
      }
    }

    const totalHistRobux = items.reduce((s, i) => s + i.robux, 0)
    const totalHistRevenue = items.reduce((s, i) => s + i.revenue, 0)
    const totalHistProfit = items.reduce((s, i) => s + i.profit, 0)
    const hasHistory = totalHistRobux > 0

    const avgPricePerRobux = hasHistory ? totalHistRevenue / totalHistRobux : 0
    const avgMarginPct = totalHistRevenue !== 0 ? (totalHistProfit / totalHistRevenue) * 100 : 0

    // Weighted std-dev of price-per-robux, used for scenario range
    let stdDevPrice = 0
    if (hasHistory) {
      const variance = items.reduce((s, i) => {
        if (i.robux <= 0) return s
        const ratio = i.revenue / i.robux
        return s + i.robux * (ratio - avgPricePerRobux) ** 2
      }, 0) / totalHistRobux
      stdDevPrice = Math.sqrt(variance)
    }

    // ── Per-account forecast — respects each account's own cost rate ──────
    const accountForecasts = accountInventory.map(({ account, available }) => {
      const costPerRobux = account.robux_cost_rate / 1000
      const revenue = available * avgPricePerRobux
      const profit = available * (avgPricePerRobux - costPerRobux)
      return { account, available, costPerRobux, revenue, profit }
    })

    const estRevenue = accountForecasts.reduce((s, x) => s + x.revenue, 0)
    const estProfit = accountForecasts.reduce((s, x) => s + x.profit, 0)
    const projectedCash = walletBalance + estRevenue

    // ── Scenario breakdown (price ± 1 std-dev) ─────────────────────────────
    function scenarioFor(price: number) {
      const revenue = totalAvailable * price
      const profit = accountForecasts.reduce((s, x) => s + x.available * (price - x.costPerRobux), 0)
      return { revenue, profit, cash: walletBalance + revenue }
    }
    const conservativePrice = Math.max(0, avgPricePerRobux - stdDevPrice)
    const optimisticPrice = avgPricePerRobux + stdDevPrice
    const scenarios = {
      conservative: scenarioFor(conservativePrice),
      expected: scenarioFor(avgPricePerRobux),
      optimistic: scenarioFor(optimisticPrice),
    }

    // ── Gamepass mix ────────────────────────────────────────────────────
    const gamepassTotals = new Map<string, number>()
    for (const i of items) gamepassTotals.set(i.gamepassName, (gamepassTotals.get(i.gamepassName) ?? 0) + i.robux)
    const sortedGamepasses = [...gamepassTotals.entries()].sort((a, b) => b[1] - a[1])
    const gamepassMix = sortedGamepasses.slice(0, TOP_GAMEPASSES).map(([name, robux]) => ({
      name, pct: hasHistory ? (robux / totalHistRobux) * 100 : 0,
    }))
    const otherRobux = sortedGamepasses.slice(TOP_GAMEPASSES).reduce((s, [, robux]) => s + robux, 0)
    if (otherRobux > 0) gamepassMix.push({ name: 'Other', pct: (otherRobux / totalHistRobux) * 100 })

    // ── Average order size → future order count ───────────────────────────
    const orderRobuxValues = histOrders
      .map(o => o.order_items?.length ? o.order_items.reduce((s, i) => s + i.robux_amount, 0) : (o.robux_amount ?? 0))
      .filter(v => v > 0)
    const avgOrderRobux = orderRobuxValues.length > 0
      ? orderRobuxValues.reduce((s, v) => s + v, 0) / orderRobuxValues.length
      : 0
    const futureOrders = avgOrderRobux > 0 ? Math.round(totalAvailable / avgOrderRobux) : 0

    // ── Top profit contributor ─────────────────────────────────────────────
    const sortedContributors = [...accountForecasts].sort((a, b) => b.profit - a.profit)
    const topContributor = sortedContributors[0] ?? null
    const topContributorPct = topContributor && estProfit !== 0 ? (topContributor.profit / estProfit) * 100 : 0

    return {
      hasSelection, scopedAccounts, totalAvailable, hasHistory, usedFallback,
      avgPricePerRobux, avgMarginPct,
      estRevenue, estProfit, projectedCash, scenarios,
      gamepassMix, futureOrders, avgOrderRobux,
      accountForecasts: sortedContributors, topContributor, topContributorPct,
      histOrderCount: histOrders.length,
    }
  }, [accounts, selectedIds, completedOrders, walletBalance])

  if (accounts.length === 0) return null

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #a78bfa70 40%, #22d3ee50 60%, transparent 95%)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(34,211,238,0.14))',
            border: '1px solid rgba(167,139,250,0.30)',
            boxShadow: '0 0 20px rgba(167,139,250,0.20)',
          }}
        >
          <Sparkles className="w-5 h-5" style={{ color: '#a78bfa' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Stock Liquidation Forecast</p>
          <p className="label-caps mt-0.5">
            {f.hasSelection
              ? `Using ${f.scopedAccounts.length} selected account${f.scopedAccounts.length !== 1 ? 's' : ''}`
              : `Across all ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
            {f.hasHistory && ` · based on ${f.histOrderCount} completed order${f.histOrderCount !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {!f.hasHistory ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Current Wallet" value={formatPHP(walletBalance)} icon={Wallet} color="#34d399" />
            <MiniStat label="Available Robux" value={formatRobux(f.totalAvailable)} icon={Coins} color="#a78bfa" />
          </div>
          <p className="text-[12px] mt-4" style={{ color: 'oklch(0.55 0.010 265)' }}>
            Not enough completed-order history yet to forecast future revenue and profit. Complete a few orders to unlock projections.
          </p>
        </>
      ) : (
        <>
          {/* ── Forecast panel ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat label="Current Wallet" value={formatPHP(walletBalance)} icon={Wallet} color="#34d399" />
            <MiniStat label="Available Robux" value={formatRobux(f.totalAvailable)} icon={Coins} color="#a78bfa" />
            <MiniStat label="Est. Revenue" value={formatPHP(f.estRevenue)} icon={TrendingUp} color="#22d3ee" />
            <MiniStat label="Est. Profit" value={fmtSigned(f.estProfit)} icon={Target} color={f.estProfit >= 0 ? '#34d399' : '#f43f5e'} />
          </div>

          {/* ── Primary metric: Projected Total Cash ── */}
          <div
            className="mt-4 rounded-2xl p-5 text-center"
            style={{
              background: f.projectedCash >= 0
                ? 'rgba(34,211,238,0.05) padding-box, linear-gradient(135deg, rgba(34,211,238,0.35), rgba(167,139,250,0.25), rgba(232,121,249,0.18)) border-box'
                : 'rgba(244,63,94,0.05) padding-box, linear-gradient(135deg, rgba(244,63,94,0.30), rgba(245,158,11,0.20)) border-box',
              border: '1px solid transparent',
            }}
          >
            <p className="label-caps mb-1.5">Projected Total Cash After Full Liquidation</p>
            <p
              style={{
                fontSize: '38px', fontWeight: 900, lineHeight: 1,
                color: f.projectedCash >= 0 ? '#22d3ee' : '#f43f5e',
                textShadow: f.projectedCash >= 0 ? '0 0 28px rgba(34,211,238,0.32)' : '0 0 28px rgba(244,63,94,0.30)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtSigned(f.projectedCash)}
            </p>
            <p className="text-[11px] mt-2" style={{ color: 'oklch(0.50 0.014 265)' }}>
              Wallet ({formatPHP(walletBalance)}) + estimated revenue from selling all available inventory
            </p>
          </div>

          {/* ── Scenario breakdown ── */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ScenarioCard label="Conservative" color="#f59e0b" cash={f.scenarios.conservative.cash} profit={f.scenarios.conservative.profit} />
            <ScenarioCard label="Expected" color="#22d3ee" cash={f.scenarios.expected.cash} profit={f.scenarios.expected.profit} highlight />
            <ScenarioCard label="Optimistic" color="#34d399" cash={f.scenarios.optimistic.cash} profit={f.scenarios.optimistic.profit} />
          </div>

          {/* ── Average sales model ── */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="label-caps">Average Sales Model</span>
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'oklch(0.50 0.014 265)' }}>
                <span>
                  <span className="font-bold tabular-nums" style={{ color: 'oklch(0.18 0.025 270)' }}>
                    {formatPHP(f.avgPricePerRobux * 1000)}
                  </span> / 1k R$
                </span>
                <span>
                  <span className="font-bold tabular-nums" style={{ color: 'oklch(0.18 0.025 270)' }}>
                    {f.avgMarginPct.toFixed(1)}%
                  </span> avg margin
                </span>
              </div>
            </div>

            <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(15,13,42,0.06)' }}>
              {f.gamepassMix.map((g, i) => (
                <div
                  key={g.name}
                  style={{ width: `${g.pct}%`, background: GAMEPASS_COLORS[i % GAMEPASS_COLORS.length] }}
                  className="h-full"
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
              {f.gamepassMix.map((g, i) => (
                <span key={g.name} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.45 0.018 268)' }}>
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: GAMEPASS_COLORS[i % GAMEPASS_COLORS.length] }} />
                  {g.name}
                  <span className="tabular-nums" style={{ color: 'oklch(0.58 0.010 265)' }}>{g.pct.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>

          {/* ── Projected profit by account ── */}
          {f.accountForecasts.length > 1 && (
            <div className="mt-5 pt-4 space-y-2.5" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
              <span className="label-caps">Projected Profit by Account</span>
              {f.accountForecasts.slice(0, 5).map(({ account, profit }) => {
                const pct = f.estProfit !== 0 ? (profit / f.estProfit) * 100 : 0
                return (
                  <div key={account.id} className="flex items-center gap-3">
                    <span className="text-[12px] font-semibold w-28 sm:w-36 truncate flex-shrink-0" style={{ color: 'oklch(0.18 0.025 270)' }}>
                      {account.username}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: profit >= 0 ? '#34d399' : '#f43f5e' }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums w-20 text-right flex-shrink-0" style={{ color: profit >= 0 ? '#34d399' : '#f43f5e' }}>
                      {fmtSigned(profit)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Insights ── */}
          <div className="mt-5 pt-4 space-y-1.5" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
            <span className="label-caps">Insights</span>
            <ul className="space-y-1.5 mt-1.5">
              {f.avgOrderRobux > 0 && (
                <InsightLine>
                  At your current average sale size (~{formatRobux(Math.round(f.avgOrderRobux))} per order), this inventory represents approximately{' '}
                  <b>{f.futureOrders}</b> future order{f.futureOrders !== 1 ? 's' : ''}.
                </InsightLine>
              )}
              <InsightLine>
                Current inventory is expected to generate approximately{' '}
                <b style={{ color: f.estProfit >= 0 ? '#34d399' : '#f43f5e' }}>{fmtSigned(f.estProfit)}</b> additional profit.
              </InsightLine>
              {f.accountForecasts.length > 1 && f.topContributor && Math.abs(f.topContributorPct) >= 1 && (
                <InsightLine>
                  Account <b>{f.topContributor.account.username}</b> contributes approximately{' '}
                  <b>{Math.abs(f.topContributorPct).toFixed(0)}%</b> of projected profit.
                </InsightLine>
              )}
              {f.usedFallback && (
                <InsightLine>
                  Selected accounts have no completed sales yet — using overall sales history for this forecast.
                </InsightLine>
              )}
            </ul>
          </div>
        </>
      )}
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

function ScenarioCard({ label, color, cash, profit, highlight }: { label: string; color: string; cash: number; profit: number; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}28`,
        boxShadow: highlight ? `0 0 16px ${color}18` : undefined,
      }}
    >
      <p className="label-caps mb-1" style={{ color, opacity: 0.85 }}>{label}</p>
      <p className="text-[18px] font-extrabold tabular-nums" style={{ color: 'oklch(0.12 0.028 272)' }}>{fmtSigned(cash)}</p>
      <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: profit >= 0 ? '#34d399' : '#f43f5e' }}>
        {fmtSigned(profit)} profit
      </p>
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
