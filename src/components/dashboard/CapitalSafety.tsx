'use client'

import { useMemo, useState } from 'react'
import {
  LucideIcon, ShieldAlert, ShieldCheck, Lock, Banknote, TrendingUp,
} from 'lucide-react'
import { RobloxAccount } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { calculateInventoryValue, fmtSigned } from '@/lib/utils/capital'
import { FIXED_CAPITAL, ACCOUNT_COST, MAX_ACCOUNTS } from '@/lib/constants/restock'

interface CapitalSafetyProps {
  accounts: RobloxAccount[]
  walletBalance: number
}

const PURCHASE_OPTIONS = [1, 2, 3, 4, 5]

export default function CapitalSafety({ accounts, walletBalance }: CapitalSafetyProps) {
  const [selectedN, setSelectedN] = useState(1)

  const c = useMemo(() => {
    const inventoryValue = calculateInventoryValue(accounts)
    const businessValue = walletBalance + inventoryValue

    // "Capital Buffer" — how far above (or below) the protected floor the
    // business currently sits. Available Profit is the spendable portion of it.
    const capitalBuffer = businessValue - FIXED_CAPITAL
    const availableProfit = Math.max(0, capitalBuffer)
    const isRecovered = businessValue >= FIXED_CAPITAL
    const maxProfitAccounts = Math.floor(availableProfit / ACCOUNT_COST)
    const safeAccounts = Math.min(MAX_ACCOUNTS, maxProfitAccounts)

    const purchaseCost = selectedN * ACCOUNT_COST
    const remainingBusinessValue = businessValue - purchaseCost
    const capitalUsed = Math.max(0, purchaseCost - availableProfit)
    const profitUsed = purchaseCost - capitalUsed

    let tier: 'safe' | 'caution' | 'unsafe'
    if (capitalUsed === 0) tier = 'safe'
    else if (capitalUsed < purchaseCost) tier = 'caution'
    else tier = 'unsafe'

    return {
      businessValue, capitalBuffer, availableProfit, isRecovered, maxProfitAccounts, safeAccounts,
      purchaseCost, remainingBusinessValue, capitalUsed, profitUsed, tier,
    }
  }, [accounts, walletBalance, selectedN])

  // ── Quick Decision — the single most prominent message ──
  let recommendation: { emoji: string; text: string; bg: string; border: string; color: string }
  if (!c.isRecovered) {
    recommendation = {
      emoji: '🔴',
      text: 'Do not purchase stock. Business value has not yet recovered your original capital.',
      bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.24)', color: '#be123c',
    }
  } else if (c.safeAccounts >= 2) {
    recommendation = {
      emoji: '🟢',
      text: `Safe to purchase up to ${c.safeAccounts} accounts without touching capital.`,
      bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.24)', color: '#047857',
    }
  } else if (c.safeAccounts === 1) {
    recommendation = {
      emoji: '🟢',
      text: 'You may purchase 1 account safely. A second account would begin consuming capital.',
      bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.24)', color: '#047857',
    }
  } else {
    recommendation = {
      emoji: '🟡',
      text: `Capital is recovered, but available profit (${formatPHP(c.availableProfit)}) isn't enough yet for a full account (${formatPHP(ACCOUNT_COST)}). Any purchase right now would dip slightly into capital.`,
      bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.24)', color: '#92400e',
    }
  }

  const tierStyles = {
    safe: {
      label: '🟢 SAFE',
      desc: 'Purchase is fully covered by profit. No capital will be touched.',
      bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.26)', color: '#047857',
    },
    caution: {
      label: '🟡 CAUTION',
      desc: 'Partially uses profit and partially uses capital.',
      bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.26)', color: '#92400e',
    },
    unsafe: {
      label: '🔴 UNSAFE',
      desc: 'No profit cushion remains — this purchase would come entirely from protected capital.',
      bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.26)', color: '#be123c',
    },
  } as const
  const tier = tierStyles[c.tier]

  const profitPct = c.purchaseCost > 0 ? (c.profitUsed / c.purchaseCost) * 100 : 0
  const capitalPct = c.purchaseCost > 0 ? (c.capitalUsed / c.purchaseCost) * 100 : 0

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #f43f5e60 40%, #34d39950 60%, transparent 95%)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(52,211,153,0.14))',
            border: '1px solid rgba(244,63,94,0.26)',
            boxShadow: '0 0 20px rgba(244,63,94,0.16)',
          }}
        >
          <ShieldAlert className="w-5 h-5" style={{ color: '#f43f5e' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Capital Safety</p>
          <p className="label-caps mt-0.5">Can I safely buy supplier stock right now?</p>
        </div>
      </div>

      {/* ── Quick Decision — largest, most prominent element ── */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: recommendation.bg, border: `1px solid ${recommendation.border}` }}>
        <p className="label-caps mb-2" style={{ color: recommendation.color, opacity: 0.8 }}>Quick Decision</p>
        <p className="flex items-start gap-3" style={{ fontSize: '21px', fontWeight: 900, lineHeight: 1.35, color: recommendation.color }}>
          <span className="text-[30px] leading-none flex-shrink-0">{recommendation.emoji}</span>
          {recommendation.text}
        </p>
      </div>

      {/* ── Core metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Protected Capital" value={formatPHP(FIXED_CAPITAL)} icon={Lock} color="#94a3b8" />
        <MiniStat label="Business Value" value={formatPHP(c.businessValue)} icon={Banknote} color="#22d3ee" />
        <MiniStat label="Available Profit" value={formatPHP(c.availableProfit)} icon={TrendingUp} color="#34d399" />
        <MiniStat label="Safe Buffer" value={fmtSigned(c.capitalBuffer)} icon={ShieldCheck} color={c.capitalBuffer >= 0 ? '#34d399' : '#f43f5e'} />
      </div>

      {/* ── Purchase simulator ── */}
      <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.092)' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="label-caps">Purchase Simulator</span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>{formatPHP(ACCOUNT_COST)} per supplier account</span>
        </div>

        <div className="flex gap-1.5 mb-4">
          {PURCHASE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSelectedN(n)}
              className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all cursor-pointer"
              style={selectedN === n
                ? { background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', color: '#ffffff', boxShadow: '0 2px 12px rgba(34,211,238,0.30)' }
                : { background: 'rgba(255,255,255,0.065)', border: '1px solid rgba(255,255,255,0.110)', color: 'rgba(255,255,255,0.45)' }
              }
            >
              +{n} {n === 1 ? 'Account' : 'Accounts'}
            </button>
          ))}
        </div>

        {/* Simulation result */}
        <div className="rounded-2xl p-4" style={{ background: tier.bg, border: `1px solid ${tier.border}` }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-[13px] font-extrabold" style={{ color: tier.color }}>{tier.label}</span>
            <span className="text-[11px] font-bold" style={{ color: tier.color, opacity: 0.85 }}>
              Buying {selectedN} account{selectedN > 1 ? 's' : ''} = {formatPHP(c.purchaseCost)}
            </span>
          </div>

          {/* Profit-funded vs. capital-funded split */}
          <div className="flex h-2.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.092)' }}>
            {profitPct > 0 && <div style={{ width: `${profitPct}%`, background: '#34d399' }} />}
            {capitalPct > 0 && <div style={{ width: `${capitalPct}%`, background: '#f43f5e' }} />}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <MiniStat label="From Profit" value={formatPHP(c.profitUsed)} icon={TrendingUp} color="#34d399" />
            <MiniStat label="From Capital" value={formatPHP(c.capitalUsed)} icon={Lock} color="#f43f5e" />
            <MiniStat label="Remaining Business Value" value={formatPHP(c.remainingBusinessValue)} icon={Banknote} color="#22d3ee" />
            <MiniStat label="Protected Capital" value={formatPHP(FIXED_CAPITAL)} icon={ShieldCheck} color="#94a3b8" />
          </div>

          <p className="text-[12px] leading-relaxed font-semibold" style={{ color: tier.color }}>
            {tier.desc}
          </p>
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
      <p className="text-[16px] font-extrabold tabular-nums truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{value}</p>
    </div>
  )
}
