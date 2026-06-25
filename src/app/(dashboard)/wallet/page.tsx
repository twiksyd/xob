'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import CountUp from '@/components/shared/CountUp'
import { WalletTransaction } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns'
import { Wallet, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
import SavingsWidget from '@/components/shared/SavingsWidget'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { SkeletonTable } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { formatPHP } from '@/lib/utils/pricing'

const INCOME_CATEGORIES = ['Sale', 'Bonus', 'Deposit', 'Other']
const EXPENSE_CATEGORIES = ['Robux Purchase', 'Operating Cost', 'Refund Issued', 'Withdrawal', 'Other']

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

const TT = {
  backgroundColor: 'rgba(10, 8, 24, 0.94)',
  border: '1px solid rgba(139,92,246,0.15)',
  borderRadius: '12px',
  color: 'rgba(255,255,255,0.88)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(139,92,246,0.12)',
  padding: '8px 12px',
}

export default function WalletPage() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [balance, setBalance] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [formType, setFormType] = useState<'income' | 'expense'>('income')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [txRes, summaryRes] = await Promise.all([
      supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.rpc('get_wallet_summary').single(),
    ])
    if (txRes.data) setTransactions(txRes.data as WalletTransaction[])
    if (summaryRes.data) {
      const summary = summaryRes.data as { balance: number; total_income: number; total_expenses: number }
      setBalance(Number(summary.balance))
      setTotalIncome(Number(summary.total_income))
      setTotalExpenses(Number(summary.total_expenses))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    const cutoff = startOfDay(subDays(new Date(), 30))

    const txsByDay: Record<string, { income: number; expense: number }> = {}
    let last30DaysSum = 0
    transactions
      .filter(t => new Date(t.created_at) >= cutoff)
      .forEach(t => {
        const key = format(new Date(t.created_at), 'MMM dd')
        if (!txsByDay[key]) txsByDay[key] = { income: 0, expense: 0 }
        if (t.amount > 0) txsByDay[key].income += t.amount
        else txsByDay[key].expense += Math.abs(t.amount)
        last30DaysSum += t.amount
      })

    // Anchor the running total to the all-time balance (not just the
    // capped/visible transaction list) so the chart always ends at the
    // same figure shown in the hero balance.
    const priorBalance = balance - last30DaysSum

    let running = priorBalance
    return days.map(day => {
      const key = format(day, 'MMM dd')
      const d = txsByDay[key] ?? { income: 0, expense: 0 }
      running += d.income - d.expense
      return { day: key, income: d.income, expense: d.expense, balance: running }
    })
  }, [transactions, balance])

  async function handleAdd() {
    const amt = parseFloat(formAmount)
    if (!amt || amt <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const signedAmount = formType === 'income' ? amt : -amt
    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      type: formType,
      amount: signedAmount,
      category: formCategory || 'Other',
      description: formDesc || null,
    })
    setFormAmount('')
    setFormDesc('')
    setFormCategory('')
    setSaving(false)
    fetchData()
  }

  const categories = formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const balanceBarWidth = totalIncome > 0
    ? `${Math.min(100, Math.max(0, (balance / totalIncome) * 100))}%`
    : '0%'

  return (
    <div>
      <TopBar title="Cash Wallet" />
      <PageHero
        badge="Finance"
        title="Cash Wallet"
        subtitle="PHP balance, income and expense tracking, savings goals, and balance history."
        gradient="linear-gradient(135deg, #fbbf24 0%, #34d399 50%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">
        {/* ── 01 · Financial Position ── */}
        <SectionLabel index="01" label="Financial Position" />
        <motion.div
          className="rounded-2xl p-6 featured-card"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            '--featured-color': balance >= 0 ? '#22d3ee' : '#f43f5e',
            backdropFilter: 'blur(24px) saturate(170%)',
          } as CSSProperties}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="label-caps mb-2">Current Balance</p>
              <CountUp
                value={balance}
                format={formatPHP}
                duration={1.6}
                className="featured-value block"
                style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
              />
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.44)' }}>
                PHP Cash Available · {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, #e879f9 100%)',
                boxShadow: '0 0 24px rgba(34,211,238,0.45), 0 0 48px rgba(167,139,250,0.20)',
              }}
            >
              <Wallet className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="mt-5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              whileInView={{ width: balanceBarWidth }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: balance >= 0
                  ? 'linear-gradient(90deg, #22d3ee, #a78bfa)'
                  : 'linear-gradient(90deg, #f43f5e, #e879f9)',
                boxShadow: '0 0 8px rgba(34,211,238,0.50)',
              }}
            />
          </div>

          <div className="mt-3 flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[12px] font-semibold text-emerald-600">+{formatPHP(totalIncome)}</span>
              <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 265)' }}>total in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[12px] font-semibold text-red-500">-{formatPHP(totalExpenses)}</span>
              <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 265)' }}>total out</span>
            </div>
          </div>
        </motion.div>

        {/* ── 02 · Capital Status ── */}
        <SectionLabel index="02" label="Capital Status" />
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
          variants={cardStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.4 }}
        >
          {[
            { label: 'Total Inflow',  value: formatPHP(totalIncome),   color: '#22d3ee',  accent: '#22d3ee' },
            { label: 'Total Outflow', value: formatPHP(totalExpenses), color: '#f43f5e',  accent: '#f43f5e' },
            {
              label: 'Net Balance',
              value: formatPHP(balance),
              color: balance >= 0 ? '#34d399' : '#f43f5e',
              accent: '#a78bfa',
            },
          ].map(({ label, value, color, accent }) => (
            <motion.div
              key={label}
              variants={cardStaggerItem}
              className="summary-card"
              style={{
                background: `rgba(255,255,255,0.038) padding-box, linear-gradient(135deg, ${accent}38, rgba(34,211,238,0.14)) border-box`,
                border: '1px solid transparent',
              }}
            >
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Savings Goals — part of Capital Status */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <SavingsWidget compact={false} />
        </motion.div>

        {/* ── 03 · Cash Flow ── */}
        <SectionLabel index="03" label="Cash Flow" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cash Flow Chart */}
          <motion.div
            className="col-span-2 glass-card p-5"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Cash Flow</p>
                <p className="label-caps mt-0.5">Last 30 days</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.44)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px rgba(34,211,238,0.6)' }} />
                  Income
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.44)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#f43f5e', boxShadow: '0 0 6px rgba(244,63,94,0.5)' }} />
                  Expenses
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: -10, right: 4 }}>
                <defs>
                  <linearGradient id="gWalletIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.30} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gWalletOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.44)' }}
                  axisLine={false} tickLine={false} interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.44)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={TT}
                  formatter={(v: any) => [formatPHP(Number(v))]}
                />
                <Area
                  type="monotone" dataKey="income" stroke="#22d3ee"
                  strokeWidth={2} fill="url(#gWalletIn)" dot={false} name="Income"
                />
                <Area
                  type="monotone" dataKey="expense" stroke="#f43f5e"
                  strokeWidth={2} fill="url(#gWalletOut)" dot={false} name="Expense"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Add Entry Form */}
          <motion.div
            className="glass-card p-5"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[13px] font-bold mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>Add Entry</p>

            <div
              className="flex rounded-xl overflow-hidden mb-4"
              style={{ border: '1px solid rgba(139,92,246,0.12)' }}
            >
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setFormType(t); setFormCategory('') }}
                  className="flex-1 py-2 text-[12px] font-bold transition-all capitalize"
                  style={formType === t ? {
                    background: t === 'income'
                      ? 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(167,139,250,0.08))'
                      : 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.04))',
                    color: t === 'income' ? '#22d3ee' : '#f43f5e',
                  } : { color: 'rgba(255,255,255,0.44)' }}
                >
                  {t === 'income' ? '+ Income' : '− Expense'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₱)</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="bg-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={formCategory} onValueChange={v => setFormCategory(v ?? '')}>
                  <SelectTrigger className="bg-input"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  Description
                  <span
                    className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.08)', color: 'rgba(167,139,250,0.70)' }}
                  >
                    optional
                  </span>
                </Label>
                <Input
                  placeholder="e.g. Sold 1000 Robux to John"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="bg-input"
                />
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !formAmount || parseFloat(formAmount) <= 0}
                className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background: formType === 'income'
                    ? 'linear-gradient(135deg, #22d3ee, #a78bfa)'
                    : 'linear-gradient(135deg, #f43f5e, #e879f9)',
                  color: 'white',
                  boxShadow: formType === 'income'
                    ? '0 0 20px rgba(34,211,238,0.28)'
                    : '0 0 20px rgba(244,63,94,0.22)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                {saving ? 'Adding...' : formType === 'income' ? 'Add Income' : 'Add Expense'}
              </button>
            </div>
          </motion.div>
        </div>

        {/* ── 04 · Transactions ── */}
        <SectionLabel index="04" label="Transactions" />
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Completed orders post here automatically. You can also log a manual income or expense using the Add Entry form above."
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
                    <th className="text-left">Category</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const isIn = tx.amount > 0
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
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              background: isIn ? 'rgba(34,211,238,0.10)' : 'rgba(244,63,94,0.10)',
                              color: isIn ? '#22d3ee' : '#f43f5e',
                            }}
                          >
                            {isIn
                              ? <ArrowUpRight className="w-3 h-3" />
                              : <ArrowDownRight className="w-3 h-3" />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                          {tx.category}
                        </td>
                        <td className="max-w-48 truncate text-[12px]" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="text-right">
                          <span className={cn('text-[13px] font-bold', isIn ? 'text-emerald-500' : 'text-red-400')}>
                            {isIn ? '+' : ''}{formatPHP(Math.abs(tx.amount))}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {!loading && transactions.length > 0 && (
          <motion.a
            href="/transactions"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold"
            style={{ color: '#22d3ee' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            View Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
          </motion.a>
        )}
      </div>
    </div>
  )
}
