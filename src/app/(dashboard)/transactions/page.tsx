'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { Transaction } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Search, Receipt, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
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
  const supabase = createClient()

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
      <TopBar title="Transaction History" subtitle="All Robux movements and sales" />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Total Sales Revenue</p>
            <p className="text-xl font-bold text-foreground">₱{totals.totalSales.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Total Profit Earned</p>
            <p className="text-xl font-bold text-emerald-400">₱{totals.totalProfit.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Total Robux Sold</p>
            <p className="text-xl font-bold text-amber-400">{totals.totalDeducted.toLocaleString()} R$</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-input h-9 text-sm" />
          </div>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Account</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Robux Change</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance After</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(tx => {
                    const isDeduction = tx.robux_change < 0
                    return (
                      <tr key={tx.id} className="hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div>{format(new Date(tx.created_at), 'MMM dd, yyyy')}</div>
                          <div className="text-[10px]">{format(new Date(tx.created_at), 'HH:mm')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={tx.type} />
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground max-w-48 truncate">
                          {tx.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {tx.roblox_account_username ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {tx.orders?.order_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={cn('flex items-center justify-end gap-1 text-xs font-bold', isDeduction ? 'text-red-400' : 'text-emerald-400')}>
                            {isDeduction
                              ? <ArrowDownCircle className="w-3 h-3" />
                              : <ArrowUpCircle className="w-3 h-3" />}
                            {isDeduction ? '' : '+'}{tx.robux_change.toLocaleString()} R$
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                          {tx.balance_after?.toLocaleString() ?? '—'} R$
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">
                          {tx.selling_price ? `₱${tx.selling_price}` : '—'}
                        </td>
                        <td className={cn('px-4 py-3 text-right text-xs font-semibold', (tx.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
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
