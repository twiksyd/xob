'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { LucideIcon } from 'lucide-react'
import { RobloxAccount } from '@/lib/types/database'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import {
  PackagePlus, Wallet, Banknote, ShoppingCart, Gauge, ShieldCheck, TrendingUp, Package, Info,
} from 'lucide-react'
import { ACCOUNT_COST, ACCOUNT_ROBUX, MAX_ACCOUNTS, FIXED_CAPITAL, MAX_INVENTORY } from '@/lib/constants/restock'

interface CapitalReadinessTrackerProps {
  accounts: RobloxAccount[]
  walletBalance: number
}

function getPurchasingStatus(canBuy: number) {
  if (canBuy === 0) return { label: 'Not Ready', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.22)' }
  if (canBuy === MAX_ACCOUNTS) return { label: 'Ready for Full Restock', color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.26)' }
  return { label: `Ready for ${canBuy} Account${canBuy > 1 ? 's' : ''}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)' }
}

function primaryBannerStyle(canBuy: number): CSSProperties {
  if (canBuy === MAX_ACCOUNTS) {
    return { background: 'rgba(52,211,153,0.05) padding-box, linear-gradient(135deg, rgba(52,211,153,0.35), rgba(34,211,238,0.22)) border-box', border: '1px solid transparent' }
  }
  if (canBuy > 0) {
    return { background: 'rgba(245,158,11,0.05) padding-box, linear-gradient(135deg, rgba(245,158,11,0.32), rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }
  }
  return { background: 'rgba(244,63,94,0.05) padding-box, linear-gradient(135deg, rgba(244,63,94,0.28), rgba(245,158,11,0.16)) border-box', border: '1px solid transparent' }
}

export default function CapitalReadinessTracker({ accounts, walletBalance }: CapitalReadinessTrackerProps) {
  const [protectedMode, setProtectedMode] = useState(true)

  const c = useMemo(() => {
    const currentInventory = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
    const inventoryCapacityPct = (currentInventory / MAX_INVENTORY) * 100

    const safeWallet = Math.max(0, walletBalance)
    const currentCapital = Math.min(safeWallet, FIXED_CAPITAL)
    const profitAboveCapital = Math.max(0, walletBalance - FIXED_CAPITAL)
    const capitalRecoveryPct = (currentCapital / FIXED_CAPITAL) * 100

    const availableCapital = protectedMode ? currentCapital : safeWallet
    const canBuy = Math.min(MAX_ACCOUNTS, Math.floor(availableCapital / ACCOUNT_COST))
    const remainder = availableCapital - canBuy * ACCOUNT_COST
    const neededForNext = canBuy < MAX_ACCOUNTS ? ACCOUNT_COST - remainder : 0
    const utilizationPct = (availableCapital / FIXED_CAPITAL) * 100
    const inventoryGainRobux = canBuy * ACCOUNT_ROBUX

    let opportunity: 'full' | 'partial' | null = null
    if (availableCapital >= FIXED_CAPITAL) opportunity = 'full'
    else if (availableCapital >= ACCOUNT_COST) opportunity = 'partial'

    return {
      currentInventory, inventoryCapacityPct,
      currentCapital, profitAboveCapital, capitalRecoveryPct,
      availableCapital, canBuy, neededForNext, utilizationPct, inventoryGainRobux,
      opportunity,
    }
  }, [accounts, walletBalance, protectedMode])

  const status = getPurchasingStatus(c.canBuy)

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #34d39970 40%, #22d3ee50 60%, transparent 95%)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.22), rgba(34,211,238,0.14))',
              border: '1px solid rgba(52,211,153,0.30)',
              boxShadow: '0 0 20px rgba(52,211,153,0.20)',
            }}
          >
            <PackagePlus className="w-5 h-5" style={{ color: '#34d399' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Capital Readiness Tracker</p>
            <p className="label-caps mt-0.5">
              Supplier restock · {MAX_ACCOUNTS} accounts × {formatPHP(ACCOUNT_COST)} = {formatPHP(FIXED_CAPITAL)}
            </p>
          </div>
        </div>

        {/* Protected Capital Mode toggle */}
        <button
          type="button"
          onClick={() => setProtectedMode(p => !p)}
          className="flex items-center gap-2 h-8 px-3 rounded-xl text-[11px] font-bold flex-shrink-0 transition-all"
          style={protectedMode
            ? { background: 'rgba(167,139,250,0.10)', color: '#6d28d9', border: '1px solid rgba(167,139,250,0.26)' }
            : { background: 'rgba(15,13,42,0.04)', color: 'oklch(0.50 0.014 265)', border: '1px solid rgba(15,13,42,0.09)' }
          }
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Protected Capital Mode: {protectedMode ? 'On' : 'Off'}
        </button>
      </div>

      {/* ── Command Center banner ── */}
      {c.opportunity && (
        <div
          className="mb-4 rounded-xl px-4 py-2.5 flex items-center gap-2 text-[12px] font-bold"
          style={c.opportunity === 'full'
            ? { background: 'rgba(52,211,153,0.10)', color: '#047857', border: '1px solid rgba(52,211,153,0.26)' }
            : { background: 'rgba(245,158,11,0.08)', color: '#92400e', border: '1px solid rgba(245,158,11,0.22)' }
          }
        >
          {c.opportunity === 'full' ? '🚀 Full Supplier Restock Available' : '💰 Restock Opportunity Available'}
        </div>
      )}

      {/* ── Mini stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Wallet Balance" value={formatPHP(walletBalance)} icon={Wallet} color="#34d399" />
        <MiniStat label="Available Capital" value={formatPHP(c.availableCapital)} icon={Banknote} color="#22d3ee" />
        <MiniStat label="Capital Recovery" value={`${c.capitalRecoveryPct.toFixed(0)}%`} icon={ShieldCheck} color="#a78bfa" />
        <MiniStat label="Profit Above Capital" value={formatPHP(c.profitAboveCapital)} icon={TrendingUp} color="#f59e0b" />
      </div>

      {/* ── Primary metric: purchasing power ── */}
      <div className="mt-4 rounded-2xl p-5 text-center" style={primaryBannerStyle(c.canBuy)}>
        <p className="label-caps mb-1.5">Purchasing Power</p>
        <p style={{ fontSize: '38px', fontWeight: 900, lineHeight: 1, color: status.color, textShadow: `0 0 28px ${status.color}50`, fontVariantNumeric: 'tabular-nums' }}>
          {c.canBuy} / {MAX_ACCOUNTS}
        </p>
        <p className="text-[13px] mt-2 font-bold" style={{ color: 'oklch(0.18 0.025 270)' }}>
          {c.canBuy === MAX_ACCOUNTS
            ? `Can Buy: Full Restock (${formatRobux(MAX_INVENTORY)})`
            : c.canBuy > 0
              ? `Can Buy: ${c.canBuy} Account${c.canBuy > 1 ? 's' : ''} (${formatRobux(c.canBuy * ACCOUNT_ROBUX)})`
              : `Need ${formatPHP(c.neededForNext)} more for Account #1`
          }
        </p>
        {c.canBuy > 0 && c.canBuy < MAX_ACCOUNTS && (
          <p className="text-[11px] mt-1" style={{ color: 'oklch(0.50 0.014 265)' }}>
            Need {formatPHP(c.neededForNext)} more to unlock Account #{c.canBuy + 1}
          </p>
        )}
      </div>

      {/* ── Segmented progress bar ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label-caps">Account Funding Progress</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.18 0.025 270)' }}>
            {c.canBuy} / {MAX_ACCOUNTS} Accounts Ready
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: MAX_ACCOUNTS }).map((_, i) => {
            const segFill = Math.max(0, Math.min(1, (c.availableCapital - i * ACCOUNT_COST) / ACCOUNT_COST))
            const filled = segFill >= 1
            return (
              <div key={i} className="flex-1">
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${segFill * 100}%`, background: filled ? '#34d399' : '#f59e0b' }}
                  />
                </div>
                <p className="text-center text-[9px] mt-1 font-bold tabular-nums" style={{ color: filled ? '#34d399' : 'oklch(0.62 0.010 265)' }}>
                  {i + 1}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Purchasing status badge ── */}
      <div className="mt-3 flex justify-center">
        <span className="text-[12px] font-bold px-4 py-1.5 rounded-full" style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
          {status.label}
        </span>
      </div>

      {/* ── Protected Capital Mode breakdown ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="label-caps">Protected Capital Mode</span>
          <span className="text-[11px]" style={{ color: 'oklch(0.50 0.014 265)' }}>
            Keeps your {formatPHP(FIXED_CAPITAL)} restock fund separate from profit already earned
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Fixed Capital" value={formatPHP(FIXED_CAPITAL)} icon={ShieldCheck} color="#a78bfa" />
          <MiniStat label="Current Capital" value={formatPHP(c.currentCapital)} icon={Banknote} color="#22d3ee" />
          <MiniStat label="Profit Above Capital" value={formatPHP(c.profitAboveCapital)} icon={TrendingUp} color="#34d399" />
          <MiniStat label="Capital Recovery" value={`${c.capitalRecoveryPct.toFixed(0)}%`} icon={Gauge} color="#f59e0b" />
        </div>
      </div>

      {/* ── Inventory capacity ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="label-caps">Inventory Capacity</span>
          <span className="text-[11px]" style={{ color: 'oklch(0.50 0.014 265)' }}>
            Helps decide whether restocking is necessary right now
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <MiniStat label="Current Inventory" value={formatRobux(c.currentInventory)} icon={Package} color="#22d3ee" />
          <MiniStat label="Maximum Inventory" value={formatRobux(MAX_INVENTORY)} icon={ShoppingCart} color="#a78bfa" />
          <MiniStat label="Inventory Capacity" value={`${c.inventoryCapacityPct.toFixed(0)}%`} icon={Gauge} color={c.inventoryCapacityPct >= 90 ? '#34d399' : '#f59e0b'} />
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, c.inventoryCapacityPct)}%`, background: c.inventoryCapacityPct >= 90 ? '#34d399' : '#22d3ee' }}
          />
        </div>
      </div>

      {/* ── Insights ── */}
      <div className="mt-5 pt-4 space-y-1.5" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <span className="label-caps">Restock Insights</span>
        <ul className="space-y-1.5 mt-1.5">
          {c.canBuy > 0 && (
            <InsightLine>
              You currently have enough capital to buy <b>{c.canBuy} account{c.canBuy > 1 ? 's' : ''}</b> ({formatRobux(c.canBuy * ACCOUNT_ROBUX)}).
            </InsightLine>
          )}
          {c.canBuy < MAX_ACCOUNTS && (
            <InsightLine>
              You need <b>{formatPHP(c.neededForNext)}</b> more to unlock Account #{c.canBuy + 1}.
            </InsightLine>
          )}
          <InsightLine>
            Current capital utilization: <b>{c.utilizationPct.toFixed(0)}%</b>.
          </InsightLine>
          {c.canBuy > 0 && (
            <InsightLine>
              If fully restocked at this capital level, inventory increases by <b>{formatRobux(c.inventoryGainRobux)}</b>.
            </InsightLine>
          )}
          <InsightLine>
            Inventory is at <b>{c.inventoryCapacityPct.toFixed(0)}%</b> capacity
            {c.inventoryCapacityPct >= 90
              ? ' — you likely don’t need to restock yet.'
              : ' — there is room to restock once capital allows.'}
          </InsightLine>
        </ul>
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
