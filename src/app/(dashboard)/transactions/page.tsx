'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { Transaction } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Receipt, ArrowDownCircle, ArrowUpCircle, TrendingUp, ShoppingCart, Coins } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { springToggle } from '@/lib/motion'

type TransactionWithOrder = Transaction & {
  orders: { order_number: string | null; buyer_name: string | null } | null
}

type Period = 'today' | 'overall'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithOrder[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterType, setFilterType]     = useState('all')
  const [period, setPeriod]             = useState<Period>('overall')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, orders(order_number, buyer_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (data) setTransactions(data as TransactionWithOrder[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  // Sales in the selected period (for metrics)
  const periodSales = useMemo(() => {
    const sales = transactions.filter(t => t.type === 'sale')
    if (period === 'today') {
      return sales.filter(t => format(new Date(t.created_at), 'yyyy-MM-dd') === todayStr)
    }
    return sales
  }, [transactions, period, todayStr])

  const metrics = useMemo(() => ({
    orders:  new Set(periodSales.map(t => t.order_id).filter(Boolean)).size,
    revenue: periodSales.reduce((s, t) => s + (t.selling_price ?? 0), 0),
    profit:  periodSales.reduce((s, t) => s + (t.profit ?? 0), 0),
    robux:   periodSales.reduce((s, t) => s + Math.abs(t.robux_change), 0),
  }), [periodSales])

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

      <div className="p-5 space-y-4">

        {/* ── Period toggle ── */}
        <div className="flex items-center justify-between">
          <span className="label-caps">Sales Summary</span>
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
        <div className="grid grid-cols-4 gap-3.5">

          {/* Profit — hero card */}
          <div
            className="summary-card relative overflow-hidden"
            style={{
              background: metrics.profit > 0
                ? 'rgba(52,211,153,0.07) padding-box, linear-gradient(140deg, rgba(52,211,153,0.28), rgba(34,211,238,0.18) 55%, rgba(52,211,153,0.12)) border-box'
                : 'rgba(255,255,255,0.93) padding-box, linear-gradient(140deg, rgba(139,92,246,0.20), rgba(34,211,238,0.16) 55%, rgba(232,121,249,0.12)) border-box',
              boxShadow: metrics.profit > 0
                ? 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(52,211,153,0.10), 0 8px 28px rgba(15,13,42,0.04)'
                : undefined,
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
                style={{ color: metrics.profit > 0 ? '#34d399' : 'oklch(0.095 0.032 272)', fontSize: '24px' }}
              >
                ₱{metrics.profit.toFixed(2)}
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
                style={{ color: 'oklch(0.58 0.010 265)' }}
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
                style={{ color: 'oklch(0.095 0.032 272)', fontSize: '22px' }}
              >
                ₱{metrics.revenue.toFixed(2)}
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'oklch(0.58 0.010 265)' }}>
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
                style={{ color: 'oklch(0.095 0.032 272)', fontSize: '22px' }}
              >
                {metrics.orders}
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'oklch(0.58 0.010 265)' }}>
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
                {metrics.robux.toLocaleString()}
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] mt-1.5" style={{ color: 'oklch(0.58 0.010 265)' }}>
              R$ sold
            </p>
          </div>
        </div>

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
            <span className="text-[12px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {period === 'today' ? ' today' : ''}
            </span>
          )}
        </div>

        {/* ── Transaction table ── */}
        {loading ? (
          <div className="glass-card p-8 flex justify-center">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'oklch(0.40 0.016 265)' }}>
              {period === 'today' ? 'No transactions today' : 'No transactions yet'}
            </p>
            <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>
              {period === 'today' ? 'Switch to Overall to see all history' : 'Complete an order to see history'}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
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
                          <div className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                            {format(new Date(tx.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>
                            {format(new Date(tx.created_at), 'HH:mm')}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={tx.type} />
                        </td>
                        <td className="max-w-48 truncate text-[12px]" style={{ color: 'oklch(0.10 0.030 272)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
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
                        <td className="text-right text-[11px] font-mono" style={{ color: 'oklch(0.55 0.010 265)' }}>
                          {tx.balance_after?.toLocaleString() ?? '—'} R$
                        </td>
                        <td className="text-right text-[12px]" style={{ color: 'oklch(0.10 0.030 272)' }}>
                          {tx.selling_price ? `₱${tx.selling_price}` : '—'}
                        </td>
                        <td className={cn(
                          'text-right text-[12px] font-semibold',
                          (tx.profit ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-400'
                        )}>
                          {tx.profit ? `₱${tx.profit.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
