'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Wallet } from 'lucide-react'
import { OrderWithDetails, SavingsGoal } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { cn } from '@/lib/utils'

interface Props {
  orders: OrderWithDetails[]
  savingsGoals: SavingsGoal[]
}

type Window = 'today' | 'week'

function inWindow(dateStr: string | null, window: Window): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr).getTime()
  const now = Date.now()
  if (window === 'today') {
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    return d >= startOfDay
  }
  return d >= now - 7 * 24 * 3_600_000
}

const STAGES: { key: 'revenue' | 'cost' | 'profit' | 'savings' | 'wallet'; label: string; color: string; explain: (v: number) => string }[] = [
  { key: 'revenue', label: 'Revenue',    color: '#e879f9', explain: () => 'Total selling price across orders completed in this window.' },
  { key: 'cost',    label: 'Cost',       color: '#f59e0b', explain: () => 'What those Robux actually cost you, based on each account’s cost rate.' },
  { key: 'profit',  label: 'Profit',     color: '#22d3ee', explain: () => 'Revenue minus cost — what you actually made.' },
  { key: 'savings', label: 'To Savings', color: '#a78bfa', explain: (pct: number) => `Auto-allocated to your active savings goal (${pct}% of profit).` },
  { key: 'wallet',  label: 'To Wallet',  color: '#34d399', explain: () => 'What’s left after savings — the actual growth in your spendable balance.' },
]

export default function MoneyFlowSummary({ orders, savingsGoals }: Props) {
  const [window, setWindow] = useState<Window>('today')

  const activeGoal = savingsGoals.find(g => g.status === 'active') ?? null
  const allocationPct = activeGoal?.allocation_pct ?? 0

  const figures = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed' && inWindow(o.completed_at, window))
    const revenue = completed.reduce((s, o) => s + (o.selling_price ?? 0), 0)
    const cost = completed.reduce((s, o) => s + (o.cost ?? 0), 0)
    const profit = completed.reduce((s, o) => s + (o.profit ?? 0), 0)
    const savings = profit > 0 ? Math.round(profit * (allocationPct / 100) * 100) / 100 : 0
    const wallet = profit - savings
    return { revenue, cost, profit, savings, wallet, count: completed.length }
  }, [orders, window, allocationPct])

  const values: Record<string, number> = {
    revenue: figures.revenue, cost: figures.cost, profit: figures.profit, savings: figures.savings, wallet: figures.wallet,
  }

  return (
    <div className="glass-elevated p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.22)' }}
          >
            <Wallet className="w-4 h-4" style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Where Today's Money Went</p>
            <p className="label-caps mt-0.5">{figures.count} order{figures.count === 1 ? '' : 's'} completed{window === 'week' ? ' this week' : ' today'}</p>
          </div>
        </div>
        <div className="metric-toggle">
          {(['today', 'week'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={cn('metric-toggle-btn', window === w ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive')}
              style={window === w ? { background: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(15,13,42,0.08)' } : undefined}
            >
              <span className="relative z-10 capitalize">{w === 'today' ? 'Today' : 'This Week'}</span>
            </button>
          ))}
        </div>
      </div>

      {figures.count === 0 ? (
        <p className="text-[12px] mt-4 py-3 text-center" style={{ color: 'oklch(0.55 0.010 265)' }}>
          No completed orders {window === 'week' ? 'this week' : 'today'} yet — once you complete one, this shows exactly where the money goes.
        </p>
      ) : (
        <>
          <div className="flex items-stretch gap-1.5 mt-4 overflow-x-auto overscroll-x-contain pb-1">
            {STAGES.map((stage, i) => {
              const v = values[stage.key]
              const isNegativeFlow = stage.key === 'cost' || stage.key === 'savings'
              return (
                <div key={stage.key} className="flex items-center gap-1.5 flex-shrink-0">
                  <div
                    className="rounded-xl px-3 py-2.5 min-w-[92px]"
                    style={{
                      background: `${stage.color}10`,
                      border: `1px solid ${stage.color}28`,
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: stage.color }}>
                      {stage.label}
                    </p>
                    <p className="text-[14px] font-extrabold tabular-nums" style={{ color: 'oklch(0.14 0.028 272)' }}>
                      {isNegativeFlow && v > 0 ? '−' : ''}{formatPHP(Math.abs(v))}
                    </p>
                  </div>
                  {i < STAGES.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.65 0.012 265)' }} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3.5 space-y-1">
            {STAGES.map(stage => (
              <p key={stage.key} className="text-[11px] leading-relaxed">
                <span className="font-bold" style={{ color: stage.color }}>{stage.label}: </span>
                <span style={{ color: 'oklch(0.50 0.012 265)' }}>{stage.explain(allocationPct)}</span>
              </p>
            ))}
          </div>

          {figures.profit > 0 && figures.savings === 0 && allocationPct === 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'oklch(0.55 0.010 265)' }}>
              No active savings goal is currently allocating — all profit flows straight to your wallet.
            </p>
          )}
        </>
      )}
    </div>
  )
}
