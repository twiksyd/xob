'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import StatusBadge from '@/components/shared/StatusBadge'
import { Transaction } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Receipt, ArrowDownCircle, ArrowUpCircle, TrendingUp, ShoppingCart, Coins } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { springToggle } from '@/lib/motion'
import CountUp from '@/components/shared/CountUp'
import { SkeletonTable } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { formatPHP } from '@/lib/utils/pricing'
import { useUrlState } from '@/hooks/useUrlState'

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

type TransactionWithOrder = Transaction & {
  orders: { order_number: string | null; buyer_name: string | null } | null
}

type Period = 'today' | 'overall'

type SalesSummary = { orders_count: number; revenue: number; profit: number; robux: number }

const EMPTY_SUMMARY: SalesSummary = { orders_count: 0, revenue: 0, profit: 0, robux: 0 }

const PERIODS: readonly Period[] = ['today', 'overall']
const TX_TYPES = ['all', 'sale', 'refund', 'topup', 'adjustment'] as const

type SalesSummaryRow = { orders_count: number | string; revenue: number | string; profit: number | string; robux: number | string }

// PostgREST returns numeric/bigint columns as strings to avoid precision loss
function toSummary(row: SalesSummaryRow): SalesSummary {
  return {
    orders_count: Number(row.orders_count),
    revenue:      Number(row.revenue),
    profit:       Number(row.profit),
    robux:        Number(row.robux),
  }
}

function TransactionsPageContent() {
  const [transactions, setTransactions] = useState<TransactionWithOrder[]>([])
  const [summaries, setSummaries]       = useState<Record<Period, SalesSummary>>({ today: EMPTY_SUMMARY, overall: EMPTY_SUMMARY })
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterType, setFilterType]     = useUrlState<typeof TX_TYPES[number]>('type', 'all', TX_TYPES)
  const [period, setPeriod]             = useUrlState<Period>('period', 'overall', PERIODS)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const [txRes, overallRes, todayRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, orders(order_number, buyer_name)')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.rpc('get_sales_summary').single(),
      supabase.rpc('get_sales_summary', { p_since: startOfToday.toISOString() }).single(),
    ])
    if (txRes.data) setTransactions(txRes.data as TransactionWithOrder[])
    if (overallRes.data || todayRes.data) {
      setSummaries({
        overall: overallRes.data ? toSummary(overallRes.data as SalesSummaryRow) : EMPTY_SUMMARY,
        today:   todayRes.data ? toSummary(todayRes.data as SalesSummaryRow) : EMPTY_SUMMARY,
      })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const metrics = useMemo(() => ({
    orders:  summaries[period].orders_count,
    revenue: summaries[period].revenue,
    profit:  summaries[period].profit,
    robux:   summaries[period].robux,
  }), [summaries, period])

  // Transaction list filtered by period + search + type
  const filtered = useMemo(() => {
    let base = transactions

    if (period === 'today') {
      base = base.filter(t => format(new Date(t.created_at), 'yyyy-MM-dd') === todayStr)
    }

    if (search) {
      const q = search.toLowerCase()
      base = base.filter(t =>
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.roblox_account_username ?? '').toLowerCase().includes(q) ||
        (t.orders?.buyer_name ?? '').toLowerCase().includes(q) ||
        (t.orders?.order_number ?? '').toLowerCase().includes(q)
      )
    }

    if (filterType !== 'all') {
      base = base.filter(t => t.type === filterType)
    }

    return base
  }, [transactions, period, todayStr, search, filterType])

  const periodLabel = period === 'today' ? "Today's" : 'Overall'

  return (
    <div>
      <TopBar
        title="Transactions"
        subtitle="Robux movements and sales history"
        searchPlaceholder="Search transactions..."
        searchValue={search}
        onSearchChange={setSearch}
      />
      <PageHero
        badge="Ledger"
        title="Transaction Ledger"
        subtitle="Every sale, topup, and adjustment — a complete, server-computed financial audit trail."
        gradient="linear-gradient(135deg, #34d399 0%, #22d3ee 60%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">

        {/* ── 01 · Sales Summary ── */}
        <div className="flex items-center justify-between">
          <SectionLabel index="01" label="Sales Summary" />
          <div className="metric-toggle">
            {(['today', 'overall'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`metric-toggle-btn ${period === p ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
              >
                {period === p && (
                  <motion.div
                    layoutId="tx-toggle-bg"
                    className="metric-toggle-bg"
                    transition={springToggle}
                  />
                )}
                <span className="relative z-10 capitalize">{p === 'today' ? 'Today' : 'Overall'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Metric cards ── */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >

          {/* Profit — hero card */}
          <div
            className="summary-card relative overflow-hidden"
            style={{
              background: metrics.profit > 0
                ? 'rgba(52,211,153,0.07) padding-box, linear-gradient(140deg, rgba(52,211,153,0.28), rgba(34,211,238,0.18) 55%, rgba(52,211,153,0.12)) border-box'
                : 'rgba(167,139,250,0.05) padding-box, linear-gradient(140deg, rgba(167,139,250,0.24), rgba(34,211,238,0.14) 55%, rgba(167,139,250,0.10)) border-box',
              boxShadow: metrics.profit > 0
                ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 12px rgba(52,211,153,0.10), 0 8px 28px rgba(0,0,0,0.32)'
                : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px rgba(167,139,250,0.08), 0 8px 28px rgba(0,0,0,0.32)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="label-caps">{periodLabel} Profit</p>
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: metrics.profit > 0 ? 'rgba(52,211,153,0.15)' : 'rgba(139,92,246,0.08)' }}
              >
                <TrendingUp className="w-3.5 h-3.5" style={{ color: metrics.profit > 0 ? '#34d399' : '#a78bfa' }} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`profit-${period}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="profit-counter-value"
                style={{ color: metrics.profit > 0 ? '#34d399' : 'rgba(255,255,255,0.80)', fontSize: '24px' }}
              >
                <CountUp value={metrics.profit} format={formatPHP} duration={1.4} />
              </motion.p>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={`orders-sub-${period}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="text-[11px] mt-1.5"
                style={{ color: 'rgba(255,255,255,0.48)' }}
              >
                {metrics.orders} order{metrics.orders !== 1 ? 's' : ''}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Revenue */}
          <div className="summary-card">
            <div className="flex items-center justify-between mb-2">
              <p className="label-caps">{periodLabel} Revenue</p>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.08)' }}>
                <Coins className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`revenue-${period}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18, delay: 0.03 }}
                className="stat-value"
                style={{ color: 'rgba(255,255,255,0.88)', fontSize: '22px' }}
              >
                <CountUp value={metrics.revenue} format={formatPHP} duration={1.4} />
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.48)' }}>
              gross sales
            </p>
          </div>

          {/* Orders */}
          <div className="summary-card">
            <div className="flex items-center justify-between mb-2">
              <p className="label-caps">{periodLabel} Orders</p>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.08)' }}>
                <ShoppingCart className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`orders-${period}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18, delay: 0.06 }}
                className="stat-value"
                style={{ color: 'rgba(255,255,255,0.88)', fontSize: '22px' }}
              >
                <CountUp value={metrics.orders} format={(v) => `${Math.round(v)}`} duration={1.4} />
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.48)' }}>
              completed
            </p>
          </div>

          {/* Robux sold */}
          <div className="summary-card">
            <div className="flex items-center justify-between mb-2">
              <p className="label-caps">{periodLabel} Robux</p>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.08)' }}>
                <Receipt className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`robux-${period}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18, delay: 0.09 }}
                className="stat-value"
                style={{ color: '#f59e0b', fontSize: '22px' }}
              >
                <CountUp value={metrics.robux} format={(v) => Math.round(v).toLocaleString()} duration={1.4} />
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.48)' }}>
              R$ sold
            </p>
          </div>
        </motion.div>

        {/* ── 02 · Transaction History ── */}
        <SectionLabel index="02" label="Transaction History" />

        {/* ── Type filter ── */}
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={v => setFilterType(v ?? 'all')}>
            <SelectTrigger className="w-36 h-9 bg-input text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="topup">Top Up</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {period === 'today' ? ' today' : ''}
            </span>
          )}
        </div>

        {/* ── Transaction table ── */}
        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={period === 'today' ? 'No transactions today' : 'No transactions yet'}
            description={period === 'today'
              ? 'Nothing has posted since midnight. Switch to Overall to see your full history.'
              : 'Completed orders post here automatically as sales are fulfilled.'}
            actionLabel={period === 'today' ? 'View Overall' : undefined}
            onAction={period === 'today' ? () => setPeriod('overall') : undefined}
          />
        ) : (
          <motion.div
            className="glass-card overflow-hidden"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Description</th>
                    <th className="text-left">Account</th>
                    <th className="text-left">Order</th>
                    <th className="text-right">Robux Change</th>
                    <th className="text-right">Balance After</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => {
                    const isDeduction = tx.robux_change < 0
                    return (
                      <tr key={tx.id}>
                        <td className="whitespace-nowrap">
                          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            {format(new Date(tx.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>
                            {format(new Date(tx.created_at), 'HH:mm')}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={tx.type} />
                        </td>
                        <td className="max-w-48 truncate text-[12px]" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                          {tx.roblox_account_username ?? '—'}
                        </td>
                        <td className="font-mono text-[11px]" style={{ color: '#22d3ee' }}>
                          {tx.orders?.order_number ?? '—'}
                        </td>
                        <td className="text-right">
                          <div className={cn(
                            'flex items-center justify-end gap-1 text-[12px] font-bold',
                            isDeduction ? 'text-red-400' : 'text-emerald-500'
                          )}>
                            {isDeduction
                              ? <ArrowDownCircle className="w-3 h-3" />
                              : <ArrowUpCircle className="w-3 h-3" />}
                            {isDeduction ? '' : '+'}{tx.robux_change.toLocaleString()} R$
                          </div>
                        </td>
                        <td className="text-right text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.44)' }}>
                          {tx.balance_after?.toLocaleString() ?? '—'} R$
                        </td>
                        <td className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {tx.selling_price ? formatPHP(tx.selling_price) : '—'}
                        </td>
                        <td className={cn(
                          'text-right text-[12px] font-semibold',
                          (tx.profit ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-400'
                        )}>
                          {tx.profit ? formatPHP(tx.profit) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}

// useUrlState() calls useSearchParams() internally — requires a Suspense
// boundary or the build's prerender pass fails even on a force-dynamic page.
export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsPageContent />
    </Suspense>
  )
}
