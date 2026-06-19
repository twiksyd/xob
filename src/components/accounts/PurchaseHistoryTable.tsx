'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderWithItems, RobloxAccount } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import ReassignDialog from '@/components/accounts/ReassignDialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/utils/pricing'
import { Search, X, Receipt, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface PurchaseHistoryTableProps {
  orders: OrderWithItems[]
  accounts: RobloxAccount[]
  currentAccount: RobloxAccount
  onReassigned: () => void
}

type HistoryRow = {
  _key: string
  orderId: string
  orderNumber: string | null
  buyerName: string | null
  status: OrderWithItems['status']
  createdAt: string
  gamepassName: string
  robuxAmount: number
  sellingPrice: number
  profit: number
}

type SortKey = 'date_desc' | 'date_asc' | 'profit_desc' | 'profit_asc' | 'robux_desc' | 'robux_asc'

const REASSIGNABLE_STATUSES: OrderWithItems['status'][] = ['pending', 'paid', 'delivering', 'completed']
const PAGE_SIZE = 15

export default function PurchaseHistoryTable({ orders, accounts, currentAccount, onReassigned }: PurchaseHistoryTableProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('date_desc')
  const [page, setPage] = useState(1)
  const [reassignOrder, setReassignOrder] = useState<OrderWithItems | null>(null)

  const rows = useMemo<HistoryRow[]>(() => {
    const out: HistoryRow[] = []
    for (const order of orders) {
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          out.push({
            _key: item.id,
            orderId: order.id,
            orderNumber: order.order_number,
            buyerName: order.buyer_name,
            status: order.status,
            createdAt: order.created_at,
            gamepassName: item.gamepass_name,
            robuxAmount: item.robux_amount,
            sellingPrice: item.selling_price,
            profit: item.profit,
          })
        }
      } else {
        out.push({
          _key: order.id,
          orderId: order.id,
          orderNumber: order.order_number,
          buyerName: order.buyer_name,
          status: order.status,
          createdAt: order.created_at,
          gamepassName: '—',
          robuxAmount: order.robux_amount ?? 0,
          sellingPrice: order.selling_price ?? 0,
          profit: order.profit ?? 0,
        })
      }
    }
    return out
  }, [orders])

  const filtered = useMemo(() => {
    let base = rows
    if (search) {
      const q = search.toLowerCase()
      base = base.filter(r =>
        r.gamepassName.toLowerCase().includes(q) ||
        (r.orderNumber ?? '').toLowerCase().includes(q) ||
        (r.buyerName ?? '').toLowerCase().includes(q)
      )
    }
    return [...base].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'date_desc':   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'profit_asc':  return a.profit - b.profit
        case 'profit_desc': return b.profit - a.profit
        case 'robux_asc':   return a.robuxAmount - b.robuxAmount
        case 'robux_desc':  return b.robuxAmount - a.robuxAmount
        default:            return 0
      }
    })
  }, [rows, search, sortBy])

  useEffect(() => { setPage(1) }, [search, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openReassign(orderId: string) {
    const order = orders.find(o => o.id === orderId)
    if (order) setReassignOrder(order)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label-caps">Purchase History</span>
        {filtered.length > 0 && (
          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
            {filtered.length} purchase{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Filter bar (T4 floating glass) ── */}
      <div className="glass-floating rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.48)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by gamepass, order #, or buyer…"
            className="w-full pl-9 pr-9 h-9 rounded-xl text-[13px] bg-input border border-border outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy((v ?? 'date_desc') as SortKey)}>
          <SelectTrigger className="w-full sm:w-48 h-9 bg-input text-sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="profit_desc">Profit: High → Low</SelectItem>
            <SelectItem value="profit_asc">Profit: Low → High</SelectItem>
            <SelectItem value="robux_desc">Robux: High → Low</SelectItem>
            <SelectItem value="robux_asc">Robux: Low → High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      {pageRows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Receipt className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
          <p className="text-[14px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {orders.length === 0 ? 'No purchases yet' : 'No purchases match your search'}
          </p>
          <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>
            {orders.length === 0 ? 'Orders assigned to this account will appear here' : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Gamepass</th>
                  <th className="text-left">Order #</th>
                  <th className="text-left">Buyer</th>
                  <th className="text-right">Robux</th>
                  <th className="text-right">Selling Price</th>
                  <th className="text-right">Profit</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr key={row._key}>
                    <td className="text-[12px] font-semibold max-w-48 truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {row.gamepassName}
                    </td>
                    <td className="font-mono text-[11px] font-bold" style={{ color: '#22d3ee' }}>
                      {row.orderNumber ?? '—'}
                    </td>
                    <td className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                      {row.buyerName ?? '—'}
                    </td>
                    <td className="text-right text-[12px] tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {row.robuxAmount.toLocaleString()} R$
                    </td>
                    <td className="text-right text-[12px] tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {formatPHP(row.sellingPrice)}
                    </td>
                    <td className={cn('text-right text-[12px] font-semibold tabular-nums', row.profit >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {formatPHP(row.profit)}
                    </td>
                    <td className="whitespace-nowrap text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                      {format(new Date(row.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right">
                      {REASSIGNABLE_STATUSES.includes(row.status) && (
                        <Button
                          variant="outline" size="xs"
                          className="gap-1"
                          onClick={() => openReassign(row.orderId)}
                        >
                          <ArrowLeftRight className="w-3 h-3" /> Reassign
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-[12px] font-semibold transition-colors disabled:opacity-40"
            style={{ color: 'rgba(255,255,255,0.47)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-[12px] font-semibold transition-colors disabled:opacity-40"
            style={{ color: 'rgba(255,255,255,0.47)' }}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Reassign dialog ── */}
      <ReassignDialog
        order={reassignOrder}
        currentAccount={currentAccount}
        accounts={accounts}
        onClose={() => setReassignOrder(null)}
        onSuccess={() => { setReassignOrder(null); onReassigned() }}
      />
    </div>
  )
}
