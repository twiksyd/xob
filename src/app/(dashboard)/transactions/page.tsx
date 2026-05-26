'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { Transaction } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Receipt, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

type TransactionWithOrder = Transaction & {
  orders: { order_number: string | null; buyer_name: string | null } | null
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, orders(order_number, buyer_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setTransactions(data as TransactionWithOrder[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => transactions.filter(t => {
    const matchSearch =
      (t.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.roblox_account_username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.orders?.buyer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.orders?.order_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || t.type === filterType
    return matchSearch && matchType
  }), [transactions, search, filterType])

  const totals = useMemo(() => ({
    totalSales: transactions.filter(t => t.type === 'sale').reduce((s, t) => s + (t.selling_price ?? 0), 0),
    totalProfit: transactions.filter(t => t.type === 'sale').reduce((s, t) => s + (t.profit ?? 0), 0),
    totalDeducted: transactions.filter(t => t.type === 'sale').reduce((s, t) => s + Math.abs(t.robux_change), 0),
  }), [transactions])

  return (
    <div>
      <TopBar
        title="Transaction History"
        subtitle="All Robux movements and sales"
        searchPlaceholder="Search transactions..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="p-5 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { label: 'Total Sales Revenue', value: `₱${totals.totalSales.toFixed(2)}`,         color: 'oklch(0.10 0.030 272)' },
            { label: 'Total Profit Earned', value: `₱${totals.totalProfit.toFixed(2)}`,        color: '#22d3ee' },
            { label: 'Total Robux Sold',    value: `${totals.totalDeducted.toLocaleString()} R$`, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="summary-card">
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? 'all')}>
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
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet. Complete an order to see history.</p>
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
                          <div className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{format(new Date(tx.created_at), 'MMM dd, yyyy')}</div>
                          <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>{format(new Date(tx.created_at), 'HH:mm')}</div>
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
                        <td className="font-mono text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                          {tx.orders?.order_number ?? '—'}
                        </td>
                        <td className="text-right">
                          <div className={cn('flex items-center justify-end gap-1 text-[12px] font-bold', isDeduction ? 'text-red-400' : 'text-emerald-500')}>
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
                        <td className={cn('text-right text-[12px] font-semibold', (tx.profit ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-400')}>
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
