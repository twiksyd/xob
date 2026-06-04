'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import TopBar from '@/components/shared/TopBar'
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

const INCOME_CATEGORIES = ['Sale', 'Bonus', 'Deposit', 'Other']
const EXPENSE_CATEGORIES = ['Robux Purchase', 'Operating Cost', 'Refund Issued', 'Withdrawal', 'Other']

const TT = {
  backgroundColor: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(139,92,246,0.15)',
  borderRadius: '12px',
  color: 'oklch(0.10 0.030 272)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(139,92,246,0.12)',
  padding: '8px 12px',
}

export default function WalletPage() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [displayBalance, setDisplayBalance] = useState(0)
  const [formType, setFormType] = useState<'income' | 'expense'>('income')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (data) setTransactions(data as WalletTransaction[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const balance = useMemo(
    () => transactions.reduce((s, t) => s + t.amount, 0),
    [transactions]
  )
  const totalIncome = useMemo(
    () => transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions]
  )
  const totalExpenses = useMemo(
    () => transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions]
  )

  useEffect(() => {
    if (!balance) { setDisplayBalance(0); return }
    const start = Date.now()
    const duration = 1400
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayBalance(balance * eased)
      if (p < 1) requestAnimationFrame(tick)
      else setDisplayBalance(balance)
    }
    requestAnimationFrame(tick)
  }, [balance])

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    const cutoff = startOfDay(subDays(new Date(), 30))
    const priorBalance = transactions
      .filter(t => new Date(t.created_at) < cutoff)
      .reduce((s, t) => s + t.amount, 0)

    const txsByDay: Record<string, { income: number; expense: number }> = {}
    transactions
      .filter(t => new Date(t.created_at) >= cutoff)
      .forEach(t => {
        const key = format(new Date(t.created_at), 'MMM dd')
        if (!txsByDay[key]) txsByDay[key] = { income: 0, expense: 0 }
        if (t.amount > 0) txsByDay[key].income += t.amount
        else txsByDay[key].expense += Math.abs(t.amount)
      })

    let running = priorBalance
    return days.map(day => {
      const key = format(day, 'MMM dd')
      const d = txsByDay[key] ?? { income: 0, expense: 0 }
      running += d.income - d.expense
      return { day: key, income: d.income, expense: d.expense, balance: running }
    })
  }, [transactions])

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
      <TopBar title="Cash Wallet" subtitle="Track your PHP cash balance" />

      <div className="p-5 space-y-5">
        {/* Hero Balance Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.92) padding-box, linear-gradient(135deg, rgba(34,211,238,0.38), rgba(167,139,250,0.28), rgba(232,121,249,0.18)) border-box',
            border: '1px solid transparent',
            backdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: '0 4px 32px rgba(34,211,238,0.10), 0 8px 48px rgba(139,92,246,0.06)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="label-caps mb-2">Current Balance</p>
              <p
                style={{
                  fontSize: '48px', fontWeight: 900, lineHeight: 1,
                  color: balance >= 0 ? '#22d3ee' : '#f43f5e',
                  textShadow: balance >= 0
                    ? '0 0 32px rgba(34,211,238,0.40)'
                    : '0 0 32px rgba(244,63,94,0.35)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₱{displayBalance.toFixed(2)}
              </p>
              <p className="text-xs mt-2" style={{ color: 'oklch(0.55 0.010 265)' }}>
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
            <div
              className="h-full rounded-full"
              style={{
                width: balanceBarWidth,
                background: balance >= 0
                  ? 'linear-gradient(90deg, #22d3ee, #a78bfa)'
                  : 'linear-gradient(90deg, #f43f5e, #e879f9)',
                transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 0 8px rgba(34,211,238,0.50)',
              }}
            />
          </div>

          <div className="mt-3 flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[12px] font-semibold text-emerald-600">+₱{totalIncome.toFixed(2)}</span>
              <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 265)' }}>total in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[12px] font-semibold text-red-500">-₱{totalExpenses.toFixed(2)}</span>
              <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 265)' }}>total out</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { label: 'Total Inflow',  value: `₱${totalIncome.toFixed(2)}`,   color: '#22d3ee',  accent: '#22d3ee' },
            { label: 'Total Outflow', value: `₱${totalExpenses.toFixed(2)}`, color: '#f43f5e',  accent: '#f43f5e' },
            {
              label: 'Net Balance',
              value: `₱${balance.toFixed(2)}`,
              color: balance >= 0 ? '#34d399' : '#f43f5e',
              accent: '#a78bfa',
            },
          ].map(({ label, value, color, accent }) => (
            <div
              key={label}
              className="summary-card"
              style={{
                background: `rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, ${accent}42, rgba(34,211,238,0.18)) border-box`,
                border: '1px solid transparent',
              }}
            >
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Savings Goals */}
        <SavingsWidget compact={false} />

        {/* Chart + Add form */}
        <div className="grid grid-cols-3 gap-4">
          {/* Cash Flow Chart */}
          <div className="col-span-2 glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Cash Flow</p>
                <p className="label-caps mt-0.5">Last 30 days</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px rgba(34,211,238,0.6)' }} />
                  Income
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
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
                  tick={{ fontSize: 11, fill: 'oklch(0.55 0.010 265)' }}
                  axisLine={false} tickLine={false} interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'oklch(0.55 0.010 265)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={TT}
                  formatter={(v: any) => [`₱${Number(v).toFixed(2)}`]}
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
          </div>

          {/* Add Entry Form */}
          <div className="glass-card p-5">
            <p className="text-[13px] font-bold mb-4" style={{ color: 'oklch(0.10 0.030 272)' }}>Add Entry</p>

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
                  } : { color: 'oklch(0.55 0.010 265)' }}
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
                    style={{ background: 'rgba(139,92,246,0.08)', color: 'oklch(0.50 0.14 280)' }}
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
          </div>
        </div>

        {/* Transaction History */}
        {loading ? (
          <div className="glass-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet. Complete an order or add one manually.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
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
                          <div className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
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
                        <td className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                          {tx.category}
                        </td>
                        <td className="max-w-48 truncate text-[12px]" style={{ color: 'oklch(0.10 0.030 272)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="text-right">
                          <span className={cn('text-[13px] font-bold', isIn ? 'text-emerald-500' : 'text-red-400')}>
                            {isIn ? '+' : ''}₱{Math.abs(tx.amount).toFixed(2)}
                          </span>
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
