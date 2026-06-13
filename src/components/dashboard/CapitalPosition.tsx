'use client'

import { useMemo } from 'react'
import {
  LucideIcon, PiggyBank, Wallet, Package, Banknote, ShieldCheck, Gauge, TrendingUp,
} from 'lucide-react'
import { RobloxAccount } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { calculateInventoryValue, fmtSigned } from '@/lib/utils/capital'
import { FIXED_CAPITAL, ACCOUNT_COST } from '@/lib/constants/restock'

interface CapitalPositionProps {
  accounts: RobloxAccount[]
  walletBalance: number
}

export default function CapitalPosition({ accounts, walletBalance }: CapitalPositionProps) {
  const c = useMemo(() => {
    const inventoryValue = calculateInventoryValue(accounts)
    const businessValue = walletBalance + inventoryValue
    const netProfit = businessValue - FIXED_CAPITAL
    const withdrawableProfit = Math.max(0, netProfit)
    const isRecovered = businessValue >= FIXED_CAPITAL
    const recoveryPct = (businessValue / FIXED_CAPITAL) * 100
    const affordableAccounts = Math.floor(withdrawableProfit / ACCOUNT_COST)

    // How much of the business is liquid cash vs. tied up in unsold Robux
    const cashPct = businessValue > 0 ? Math.max(0, Math.min(100, (walletBalance / businessValue) * 100)) : 0
    const inventoryPct = businessValue > 0 ? Math.max(0, Math.min(100, (inventoryValue / businessValue) * 100)) : 0

    return { inventoryValue, businessValue, netProfit, withdrawableProfit, isRecovered, recoveryPct, affordableAccounts, cashPct, inventoryPct }
  }, [accounts, walletBalance])

  const heroStyle = c.withdrawableProfit > 0
    ? { background: 'rgba(52,211,153,0.05) padding-box, linear-gradient(135deg, rgba(52,211,153,0.35), rgba(34,211,238,0.20)) border-box', border: '1px solid transparent' }
    : { background: 'rgba(245,158,11,0.05) padding-box, linear-gradient(135deg, rgba(245,158,11,0.28), rgba(244,63,94,0.14)) border-box', border: '1px solid transparent' }
  const heroColor = c.withdrawableProfit > 0 ? '#34d399' : '#f59e0b'

  let decision: { emoji: string; message: string; bg: string; border: string; color: string }
  if (c.isRecovered && c.affordableAccounts > 0) {
    decision = {
      emoji: '🟢',
      message: `You can purchase ${c.affordableAccounts} supplier account${c.affordableAccounts > 1 ? 's' : ''} entirely using profit (${formatPHP(c.withdrawableProfit)} available at ${formatPHP(ACCOUNT_COST)} each).`,
      bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.22)', color: '#047857',
    }
  } else if (c.isRecovered) {
    decision = {
      emoji: '🟡',
      message: `Capital is fully recovered, but available profit (${formatPHP(c.withdrawableProfit)}) isn't enough yet for a full supplier account (${formatPHP(ACCOUNT_COST)}). A purchase right now would dip slightly into capital.`,
      bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', color: '#92400e',
    }
  } else {
    decision = {
      emoji: '🔴',
      message: `You have not yet recovered your capital (${c.recoveryPct.toFixed(0)}% recovered). Any supplier purchase right now will use capital, not profit — ${formatPHP(FIXED_CAPITAL - c.businessValue)} more in business value is needed to fully recover.`,
      bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.22)', color: '#be123c',
    }
  }

  let allocation: { label: string; bg: string; border: string; color: string; description: string }
  if (c.businessValue <= 0) {
    allocation = {
      label: 'No Capital Deployed',
      bg: 'rgba(15,13,42,0.04)', border: 'rgba(15,13,42,0.10)', color: 'oklch(0.50 0.014 265)',
      description: 'Business value is currently ₱0 — nothing to allocate yet.',
    }
  } else if (c.cashPct >= 60) {
    allocation = {
      label: 'Cash Heavy',
      bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.22)', color: '#047857',
      description: `${c.cashPct.toFixed(0)}% of your business value is sitting in your wallet as cash, with ${c.inventoryPct.toFixed(0)}% tied up in unsold inventory. You have plenty of liquidity to restock or withdraw.`,
    }
  } else if (c.inventoryPct >= 60) {
    allocation = {
      label: 'Inventory Heavy',
      bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.22)', color: '#0369a1',
      description: `${c.inventoryPct.toFixed(0)}% of your business value is tied up in unsold Robux, with only ${c.cashPct.toFixed(0)}% available as cash. Focus on selling down inventory before buying more stock.`,
    }
  } else {
    allocation = {
      label: 'Balanced',
      bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)', color: '#6d28d9',
      description: `Your business value is split roughly ${c.cashPct.toFixed(0)}% cash / ${c.inventoryPct.toFixed(0)}% inventory — a healthy mix of liquidity and stock.`,
    }
  }

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #a78bfa70 40%, #34d39950 60%, transparent 95%)' }}
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
          <PiggyBank className="w-5 h-5" style={{ color: '#a78bfa' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Capital Position</p>
          <p className="label-caps mt-0.5">Wallet + unsold inventory — your real business net worth</p>
        </div>
      </div>

      {/* ── Status banner ── */}
      <div
        className="mb-4 rounded-xl px-4 py-2.5 flex items-center gap-2 text-[12px] font-bold"
        style={c.isRecovered
          ? { background: 'rgba(52,211,153,0.10)', color: '#047857', border: '1px solid rgba(52,211,153,0.26)' }
          : { background: 'rgba(244,63,94,0.08)', color: '#be123c', border: '1px solid rgba(244,63,94,0.22)' }
        }
      >
        {c.isRecovered
          ? '🟢 Capital Fully Recovered'
          : `🔴 Capital Not Yet Recovered — ${c.recoveryPct.toFixed(0)}% of ${formatPHP(FIXED_CAPITAL)}`}
      </div>

      {/* ── Hero: Withdrawable Profit ── */}
      <div className="rounded-2xl p-5 text-center" style={heroStyle}>
        <p className="label-caps mb-1.5">Withdrawable Profit</p>
        <p style={{ fontSize: '38px', fontWeight: 900, lineHeight: 1, color: heroColor, textShadow: `0 0 28px ${heroColor}50`, fontVariantNumeric: 'tabular-nums' }}>
          {formatPHP(c.withdrawableProfit)}
        </p>
        <p className="text-[13px] mt-2 font-bold" style={{ color: 'oklch(0.18 0.025 270)' }}>
          {c.withdrawableProfit > 0
            ? `Business Value (${formatPHP(c.businessValue)}) exceeds Fixed Capital (${formatPHP(FIXED_CAPITAL)}) — safe to withdraw without touching capital.`
            : c.isRecovered
              ? 'Capital is exactly covered — nothing extra to withdraw yet.'
              : `Need ${formatPHP(FIXED_CAPITAL - c.businessValue)} more in business value to fully recover capital.`}
        </p>
      </div>

      {/* ── Core stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <MiniStat label="Business Value" value={formatPHP(c.businessValue)} icon={Banknote} color="#22d3ee" />
        <MiniStat label="Capital Recovery" value={`${c.recoveryPct.toFixed(0)}%`} icon={Gauge} color="#a78bfa" />
        <MiniStat label="Net Profit / Loss" value={fmtSigned(c.netProfit)} icon={TrendingUp} color={c.netProfit >= 0 ? '#34d399' : '#f43f5e'} />
        <MiniStat label="Fixed Capital" value={formatPHP(FIXED_CAPITAL)} icon={ShieldCheck} color="#94a3b8" />
      </div>

      {/* ── Recovery progress bar ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label-caps">Capital Recovery Progress</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.18 0.025 270)' }}>
            {formatPHP(c.businessValue)} / {formatPHP(FIXED_CAPITAL)}
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, c.recoveryPct)}%`, background: c.isRecovered ? '#34d399' : '#a78bfa' }}
          />
        </div>
      </div>

      {/* ── Capital Allocation ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="label-caps">Capital Allocation</span>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: allocation.bg, color: allocation.color, border: `1px solid ${allocation.border}` }}
          >
            {allocation.label}
          </span>
        </div>

        {/* Cash vs. inventory split bar */}
        <div className="flex h-2.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(15,13,42,0.06)' }}>
          {c.cashPct > 0 && <div style={{ width: `${c.cashPct}%`, background: '#34d399' }} />}
          {c.inventoryPct > 0 && <div style={{ width: `${c.inventoryPct}%`, background: '#38bdf8' }} />}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Wallet Value" value={formatPHP(walletBalance)} icon={Wallet} color="#34d399" />
          <MiniStat label="Inventory Value" value={formatPHP(c.inventoryValue)} icon={Package} color="#38bdf8" />
          <MiniStat label="Cash Allocation" value={`${c.cashPct.toFixed(0)}%`} icon={Wallet} color="#34d399" />
          <MiniStat label="Inventory Allocation" value={`${c.inventoryPct.toFixed(0)}%`} icon={Package} color="#38bdf8" />
        </div>

        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'oklch(0.45 0.018 268)' }}>
          {allocation.description}
        </p>
      </div>

      {/* ── Supplier decision panel ── */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
        <span className="label-caps">Can I Buy More Stock?</span>
        <div
          className="mt-2 rounded-xl px-4 py-3 flex items-start gap-2.5 text-[12px] leading-relaxed font-semibold"
          style={{ background: decision.bg, border: `1px solid ${decision.border}` }}
        >
          <span className="flex-shrink-0">{decision.emoji}</span>
          <span style={{ color: decision.color }}>{decision.message}</span>
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
