'use client'

import { Package, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { OrderWithDetails, RobloxAccount } from '@/lib/types/database'
import { formatRobux } from '@/lib/utils/pricing'

interface Props {
  orders: OrderWithDetails[]
  accounts: RobloxAccount[]
}

const STATUS_STYLES = {
  healthy: { label: 'Healthy',  color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.25)' },
  watch:   { label: 'Watch',    color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
  low:     { label: 'Low',      color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.25)' },
} as const

export default function FulfillmentReadiness({ orders, accounts }: Props) {
  const [expanded, setExpanded] = useState(false)

  const activeAccounts = accounts.filter(a => a.status === 'active')
  const totalAvailable = activeAccounts.reduce((s, a) => s + (a.current_robux - (a.reserved_robux ?? 0)), 0)

  const recentCompleted = orders.filter(o => o.status === 'completed').slice(0, 30)
  const avgRobuxPerOrder = recentCompleted.length
    ? Math.round(recentCompleted.reduce((s, o) => s + (o.robux_amount ?? 0), 0) / recentCompleted.length)
    : 0

  const orderCapacity = avgRobuxPerOrder > 0 ? Math.floor(totalAvailable / avgRobuxPerOrder) : null

  // Daily order pace, from completed orders over the last 14 days
  const fourteenDaysAgo = Date.now() - 14 * 24 * 3_600_000
  const recentWindowCompleted = orders.filter(o =>
    o.status === 'completed' && new Date(o.completed_at ?? o.created_at).getTime() >= fourteenDaysAgo
  )
  const dailyPace = recentWindowCompleted.length / 14

  const daysOfRunway = orderCapacity !== null && dailyPace > 0 ? orderCapacity / dailyPace : null

  let status: keyof typeof STATUS_STYLES = 'healthy'
  if (daysOfRunway !== null) {
    if (daysOfRunway < 2) status = 'low'
    else if (daysOfRunway < 5) status = 'watch'
  } else if (orderCapacity !== null) {
    if (orderCapacity < 3) status = 'low'
    else if (orderCapacity < 8) status = 'watch'
  }
  const style = STATUS_STYLES[status]

  const lowAccounts = activeAccounts
    .map(a => ({ ...a, available: a.current_robux - (a.reserved_robux ?? 0) }))
    .sort((a, b) => a.available - b.available)
    .slice(0, 4)

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.22)' }}
            >
              <Package className="w-4 h-4" style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Fulfillment Readiness</p>
              <p className="label-caps mt-0.5">Can you keep selling without interruption?</p>
            </div>
          </div>
          <span
            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
          >
            {style.label}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <p className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color: 'oklch(0.12 0.028 272)' }}>
            {orderCapacity !== null ? `~${orderCapacity}` : formatRobux(totalAvailable)}
          </p>
          <p className="text-[12px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
            {orderCapacity !== null ? 'more typical orders fulfillable' : 'available across active accounts'}
          </p>
        </div>

        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'oklch(0.55 0.010 265)' }}>
          {orderCapacity !== null && daysOfRunway !== null && (
            <>≈ <span className="font-bold" style={{ color: style.color }}>{daysOfRunway < 1 ? 'less than a day' : `${Math.round(daysOfRunway)} day${Math.round(daysOfRunway) === 1 ? '' : 's'}`}</span> of runway at your recent pace (~{dailyPace.toFixed(1)} completed orders/day) — </>
          )}
          {formatRobux(totalAvailable)} sits free across {activeAccounts.length} active account{activeAccounts.length === 1 ? '' : 's'}, against a typical order size of ~{formatRobux(avgRobuxPerOrder)}.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-2.5 transition-colors hover:bg-[rgba(56,189,248,0.03)]"
        style={{ borderTop: '1px solid rgba(15,13,42,0.05)' }}
      >
        <span className="text-[11px] font-bold" style={{ color: 'oklch(0.50 0.012 265)' }}>Lowest accounts right now</span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: 'oklch(0.55 0.010 265)' }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-4 space-y-1.5">
              {lowAccounts.map(acc => {
                const dotColor = acc.available < 200 ? '#f43f5e' : acc.available < 500 ? '#f59e0b' : '#34d399'
                return (
                  <div key={acc.id} className="flex items-center gap-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}80` }} />
                    <span className="text-[11px] font-medium flex-1 truncate" style={{ color: 'oklch(0.20 0.025 270)' }}>{acc.username}</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: dotColor }}>{formatRobux(acc.available)}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
