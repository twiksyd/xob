'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import { createClient } from '@/lib/supabase/client'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import {
  CheckCircle2, AlertTriangle, XCircle, ShieldCheck,
  Wallet, PiggyBank, Lock, Package, Coins, RefreshCw,
} from 'lucide-react'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { SkeletonCard } from '@/components/shared/Skeleton'

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

type CheckStatus = 'PASS' | 'WARNING' | 'FAIL'

type IntegrityCheckRow = {
  check_name: string
  formula: string
  expected: number | string
  actual: number | string
  difference: number | string
  status: CheckStatus
  details: string
}

type IntegrityCheck = {
  check_name: string
  formula: string
  expected: number
  actual: number
  difference: number
  status: CheckStatus
  details: string
}

const META: Record<string, { icon: typeof Wallet; unit: 'php' | 'robux' }> = {
  'Wallet Balance':   { icon: Wallet,    unit: 'php' },
  'Savings Balance':  { icon: PiggyBank, unit: 'php' },
  'Reserved Robux':   { icon: Lock,      unit: 'robux' },
  'Inventory Value':  { icon: Package,   unit: 'php' },
  'Capital Usage':    { icon: Coins,     unit: 'php' },
}

const STATUS_STYLES: Record<CheckStatus, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  PASS:    { label: 'Pass',    color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.25)', icon: CheckCircle2 },
  WARNING: { label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: AlertTriangle },
  FAIL:    { label: 'Fail',    color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.25)', icon: XCircle },
}

function fmtValue(value: number, unit: 'php' | 'robux'): string {
  return unit === 'robux' ? formatRobux(value) : formatPHP(value)
}

function fmtDiff(value: number, unit: 'php' | 'robux'): string {
  if (Math.abs(value) < 0.005) return unit === 'robux' ? '0 R$' : formatPHP(0)
  const sign = value > 0 ? '+' : '−'
  return sign + fmtValue(Math.abs(value), unit)
}

function toCheck(row: IntegrityCheckRow): IntegrityCheck {
  return {
    check_name: row.check_name,
    formula: row.formula,
    expected: Number(row.expected),
    actual: Number(row.actual),
    difference: Number(row.difference),
    status: row.status,
    details: row.details,
  }
}

export default function FinancialIntegrityPage() {
  const [checks, setChecks] = useState<IntegrityCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_financial_integrity_checks')
    if (!error && data) {
      setChecks((data as IntegrityCheckRow[]).map(toCheck))
      setLastChecked(new Date())
    }
    setLoading(false)
    setRefreshing(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function handleRefresh() {
    setRefreshing(true)
    fetchData()
  }

  const failCount = checks.filter(c => c.status === 'FAIL').length
  const warnCount = checks.filter(c => c.status === 'WARNING').length
  const overallStatus: CheckStatus = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARNING' : 'PASS'
  const overallStyle = STATUS_STYLES[overallStatus]
  const OverallIcon = overallStyle.icon

  return (
    <div>
      <TopBar title="Financial Integrity" />
      <PageHero
        badge="Reconciliation"
        title="Financial Integrity"
        subtitle="Live verification that every balance, reservation, and profit figure is internally consistent."
        gradient="linear-gradient(135deg, #f87171 0%, #fbbf24 50%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">

        {/* ── 01 · Reconciliation Status ── */}
        <SectionLabel index="01" label="Reconciliation Status" />

        {/* ── Overall status banner ── */}
        <motion.div
          className="glass-elevated p-5 flex items-center justify-between flex-wrap gap-3"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ borderColor: overallStyle.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: overallStyle.bg, border: `1px solid ${overallStyle.border}` }}
            >
              <ShieldCheck className="w-5 h-5" style={{ color: overallStyle.color }} />
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {overallStatus === 'PASS'
                  ? 'All reconciliation checks pass'
                  : `${failCount} check${failCount === 1 ? '' : 's'} failing, ${warnCount} with warnings`}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking...'} — Wallet, Savings, Reserved Robux, Inventory Value, Capital Usage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5"
              style={{ background: overallStyle.bg, color: overallStyle.color, border: `1px solid ${overallStyle.border}` }}
            >
              <OverallIcon className="w-3 h-3" />
              {overallStyle.label}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'rgba(255,255,255,0.050) padding-box, linear-gradient(135deg, rgba(139,92,246,0.20), rgba(34,211,238,0.20)) border-box',
                border: '1px solid transparent',
                color: 'rgba(255,255,255,0.38)',
              }}
              title="Re-run checks"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* ── 02 · Per-Check Detail ── */}
        <SectionLabel index="02" label="Per-Check Detail" />

        {/* ── Per-check cards ── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={3} />)}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-3.5"
            variants={cardStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.2 }}
          >
            {checks.map((check) => {
              const meta = META[check.check_name] ?? { icon: ShieldCheck, unit: 'php' as const }
              const Icon = meta.icon
              const style = STATUS_STYLES[check.status]
              const StatusIcon = style.icon

              return (
                <motion.div
                  key={check.check_name}
                  variants={cardStaggerItem}
                  className="glass-card p-5"
                  style={{ borderColor: style.border }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: style.bg, border: `1px solid ${style.border}` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: style.color }} />
                      </div>
                      <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {check.check_name}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {style.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.62 0.010 265)' }}>Expected</p>
                      <p className="text-[13px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.76)' }}>
                        {fmtValue(check.expected, meta.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'oklch(0.62 0.010 265)' }}>Actual</p>
                      <p className="text-[13px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.76)' }}>
                        {fmtValue(check.actual, meta.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: style.color, opacity: 0.85 }}>Difference</p>
                      <p className="text-[13px] font-extrabold tabular-nums" style={{ color: style.color }}>
                        {fmtDiff(check.difference, meta.unit)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono mb-2 px-2 py-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.47)', background: 'rgba(15,13,42,0.03)' }}>
                    {check.formula}
                  </p>

                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.44)' }}>
                    {check.details}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}
