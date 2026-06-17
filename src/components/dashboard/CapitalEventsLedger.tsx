'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  LucideIcon, History, Lock, Calendar, ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CapitalEvent } from '@/lib/types/database'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'

interface CapitalEventsLedgerProps {
  refreshKey: number
}

const FUNDING_META: Record<CapitalEvent['funding_source'], { emoji: string; label: string; color: string; bg: string; border: string }> = {
  profit:  { emoji: '🟢', label: 'Profit Funded',  color: '#047857', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.26)' },
  mixed:   { emoji: '🟡', label: 'Mixed Funding',  color: '#92400e', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.26)' },
  capital: { emoji: '🔴', label: 'Capital Funded', color: '#be123c', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.26)' },
}

export default function CapitalEventsLedger({ refreshKey }: CapitalEventsLedgerProps) {
  const [events, setEvents] = useState<CapitalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    let active = true
    supabaseRef.current.from('capital_events').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (active && data) setEvents(data)
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refreshKey])

  const totalCapitalUsed = events.reduce((sum, e) => sum + e.capital_used, 0)
  const lastCapitalEvent = events.find((e) => e.capital_used > 0)
  const latest = events[0]

  return (
    <div className="glass-elevated p-5 lg:p-6 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent 5%, #a78bfa70 40%, #f43f5e50 60%, transparent 95%)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(244,63,94,0.14))',
            border: '1px solid rgba(167,139,250,0.30)',
            boxShadow: '0 0 20px rgba(167,139,250,0.20)',
          }}
        >
          <History className="w-5 h-5" style={{ color: '#a78bfa' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Capital Events Ledger</p>
          <p className="label-caps mt-0.5">Every recorded supplier purchase — profit or capital?</p>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <MiniStat label="Capital Currently Deployed" value={formatPHP(totalCapitalUsed)} icon={Lock} color="#f43f5e" />
        <MiniStat
          label="Last Capital Use"
          value={lastCapitalEvent ? format(new Date(lastCapitalEvent.created_at), 'MMM d, yyyy') : 'Never'}
          icon={Calendar}
          color="#f59e0b"
        />
        <MiniStat
          label="Latest Purchase Funding"
          value={latest ? `${FUNDING_META[latest.funding_source].emoji} ${FUNDING_META[latest.funding_source].label}` : '—'}
          icon={ShieldCheck}
          color={latest ? FUNDING_META[latest.funding_source].color : '#94a3b8'}
        />
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <p className="text-[12px] py-4 text-center" style={{ color: 'rgba(255,255,255,0.44)' }}>Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-[12px] py-4 text-center" style={{ color: 'rgba(255,255,255,0.44)' }}>
          No capital events recorded yet. Adding a Roblox account with a purchase cost logs one automatically.
        </p>
      ) : (
        <div className="pt-1">
          {events.map((e) => {
            const meta = FUNDING_META[e.funding_source]
            return (
              <div key={e.id} className="relative pl-6 pb-4 last:pb-0">
                <div className="absolute left-[4px] top-4 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.110)' }} />
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />

                <div className="rounded-xl p-3.5" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {format(new Date(e.created_at), 'MMMM d, yyyy')}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                  </div>

                  <p className={`text-[13px] font-semibold ${e.supplier ? 'mb-1' : 'mb-2.5'}`} style={{ color: 'rgba(255,255,255,0.76)' }}>
                    Purchased {e.accounts_purchased} Account{e.accounts_purchased > 1 ? 's' : ''} · {formatRobux(e.robux_acquired)}
                  </p>

                  {e.supplier && (
                    <p className="text-[11px] mb-2.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                      Supplier: <span className="font-semibold" style={{ color: 'oklch(0.30 0.020 270)' }}>{e.supplier}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                    <Field label="Cost" value={formatPHP(e.cost)} />
                    <Field label="Profit Used" value={formatPHP(e.profit_used)} />
                    <Field label="Capital Used" value={formatPHP(e.capital_used)} />
                    <Field label="Capital Remaining" value={formatPHP(e.protected_capital_remaining)} />
                  </div>

                  <p className="text-[11px] mt-2.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                    After purchase, Business Value: <span className="font-bold" style={{ color: 'rgba(255,255,255,0.76)' }}>{formatPHP(e.business_value_after)}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps mb-0.5" style={{ opacity: 0.7 }}>{label}</p>
      <p className="font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>{value}</p>
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
