'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react'
import TopBar from '@/components/shared/TopBar'
import OrderModal from '@/components/orders/OrderModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Order, Gamepass, Game, RobloxAccount, LineItem, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, ShoppingCart, MoreHorizontal, Edit2, Trash2, Check, X } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { motion } from 'framer-motion'
import { springToggle } from '@/lib/motion'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FLOW: Record<string, string> = {
  pending: 'paid',
  paid: 'completed',
}

const PAGE_SIZE = 100

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OrderWithDetails | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [filterStatus, setFilterStatus] = useState('all')
  const [metricView, setMetricView] = useState<'today' | 'overall'>('overall')
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordRes, gpRes, accRes] = await Promise.all([
      supabase.from('orders')
        .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.from('gamepasses').select('*, games(*)').order('is_active', { ascending: false }).order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
    ])
    if (ordRes.data) {
      const hasMoreData = ordRes.data.length > PAGE_SIZE
      setOrders(ordRes.data.slice(0, PAGE_SIZE) as OrderWithDetails[])
      setHasMore(hasMoreData)
    }
    if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
    if (accRes.data) setAccounts(accRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    const cursor = orders[orders.length - 1]?.created_at
    if (!cursor) { setLoadingMore(false); return }

    const { data } = await supabase
      .from('orders')
      .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
      .order('created_at', { ascending: false })
      .lt('created_at', cursor)
      .limit(PAGE_SIZE + 1)

    if (data) {
      const hasMoreData = data.length > PAGE_SIZE
      setOrders(prev => [...prev, ...(data.slice(0, PAGE_SIZE) as OrderWithDetails[])])
      setHasMore(hasMoreData)
    }
    setLoadingMore(false)
  }, [supabase, hasMore, loadingMore, orders])

  // ── Financial helpers (edit path only — status transitions use RPCs) ─────────
  async function deductRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase
      .from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({
      current_robux: Math.max(0, acc.current_robux - amount),
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)
  }

  async function restoreRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase
      .from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({
      current_robux: acc.current_robux + amount,
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)
  }

  async function creditWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null) {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({
      user_id: userId, type: 'income', amount,
      category: 'Sale',
      description: `Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`,
      reference_order_id: orderId,
    })
  }

  async function reverseWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null, reason: 'Refund' | 'Cancellation') {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({
      user_id: userId, type: 'expense', amount: -amount,
      category: reason === 'Refund' ? 'Refund Issued' : 'Cancellation',
      description: `${reason}: Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`,
      reference_order_id: orderId,
    })
  }
  // ─────────────────────────────────────────────────────────────────────────────

  async function handleSave(data: any, items: LineItem[]) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const totalRobux  = items.reduce((s, i) => s + i.robux_amount, 0)
    const totalPrice  = items.reduce((s, i) => s + i.selling_price, 0)
    const totalCost   = items.reduce((s, i) => s + i.cost, 0)
    const totalProfit = items.reduce((s, i) => s + i.profit, 0)
    const firstItem   = items[0]

    if (editOrder) {
      // ── Edit existing order ──────────────────────────────────────────────────
      const prevStatus = editOrder.status
      const newStatus  = data.status

      await supabase.from('orders').update({
        buyer_name: data.buyer_name,
        buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id,
        payment_method: data.payment_method,
        status: newStatus,
        notes: data.notes,
        gamepass_id: firstItem?.gamepass_id || null,
        robux_amount: totalRobux,
        selling_price: totalPrice,
        cost: totalCost,
        profit: totalProfit,
        updated_at: new Date().toISOString(),
      }).eq('id', editOrder.id)

      await supabase.from('order_items').delete().eq('order_id', editOrder.id)
      if (items.length > 0) {
        await supabase.from('order_items').insert(
          items.map(item => ({
            order_id: editOrder.id,
            gamepass_id: item.gamepass_id || null,
            gamepass_name: item.gamepass_name,
            game_name: item.game_name,
            robux_amount: item.robux_amount,
            selling_price: item.selling_price,
            cost: item.cost,
            profit: item.profit,
          }))
        )
      }

      // Financial effects for edit-path status transitions.
      // Note: status changes from buttons go through transition_order RPC (atomic).
      // The edit path updates order data + status in one DB call above, so the RPC
      // can't be used here (it would see the already-updated status as a no-op).
      // These helpers remain client-side for the edit path only.
      if (prevStatus !== 'completed' && newStatus === 'completed') {
        if (data.roblox_account_id && totalRobux > 0) await deductRobux(data.roblox_account_id, totalRobux)
        await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
      } else if (prevStatus === 'completed' && newStatus !== 'completed') {
        if (editOrder.roblox_account_id && editOrder.robux_amount) {
          await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
        }
        const reason = newStatus === 'refunded' ? 'Refund' : 'Cancellation'
        await reverseWallet(user.id, editOrder.id, editOrder.selling_price ?? 0, editOrder.order_number ?? null, editOrder.buyer_name ?? null, reason)
      } else if (prevStatus === 'completed' && newStatus === 'completed') {
        const accountChanged = data.roblox_account_id !== editOrder.roblox_account_id
        const robuxChanged   = totalRobux !== (editOrder.robux_amount ?? 0)
        const priceChanged   = totalPrice !== (editOrder.selling_price ?? 0)

        if (accountChanged) {
          if (editOrder.roblox_account_id && editOrder.robux_amount) {
            await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
          }
          if (data.roblox_account_id && totalRobux > 0) {
            await deductRobux(data.roblox_account_id, totalRobux)
          }
        } else if (robuxChanged && data.roblox_account_id) {
          const diff = totalRobux - (editOrder.robux_amount ?? 0)
          if (diff > 0) await deductRobux(data.roblox_account_id, diff)
          else if (diff < 0) await restoreRobux(data.roblox_account_id, -diff)
        }

        if (priceChanged) {
          await supabase.from('wallet_transactions')
            .delete().eq('reference_order_id', editOrder.id).eq('type', 'income').eq('category', 'Sale')
          await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
        }
      }
    } else {
      // ── Create new order ─────────────────────────────────────────────────────
      // Always insert as 'pending' so the transition_order RPC can apply financial
      // effects atomically for any target status (including completed).
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: user.id,
        buyer_name: data.buyer_name,
        buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id,
        payment_method: data.payment_method,
        status: 'pending',
        notes: data.notes,
        gamepass_id: firstItem?.gamepass_id || null,
        robux_amount: totalRobux,
        selling_price: totalPrice,
        cost: totalCost,
        profit: totalProfit,
      }).select().single()

      if (newOrder && items.length > 0) {
        await supabase.from('order_items').insert(
          items.map(item => ({
            order_id: newOrder.id,
            gamepass_id: item.gamepass_id || null,
            gamepass_name: item.gamepass_name,
            game_name: item.game_name,
            robux_amount: item.robux_amount,
            selling_price: item.selling_price,
            cost: item.cost,
            profit: item.profit,
          }))
        )
      }

      // Transition to the user's chosen status atomically (handles financial effects)
      if (newOrder && data.status !== 'pending') {
        const { error } = await supabase.rpc('transition_order', {
          p_order_id: newOrder.id,
          p_new_status: data.status,
        })
        if (error) alert(`Order created but status transition failed: ${error.message}`)
      }
    }

    setSaving(false)
    setModalOpen(false)
    setEditOrder(null)
    fetchData()
  }

  // ── Status change from action buttons — fully atomic via RPC ─────────────────
  async function handleStatusChange(order: OrderWithDetails, newStatus: string) {
    if (order.status === newStatus) return
    if (statusChanging === order.id) return
    setStatusChanging(order.id)

    const { error } = await supabase.rpc('transition_order', {
      p_order_id: order.id,
      p_new_status: newStatus,
    })

    if (error) alert(`Could not update order status: ${error.message}`)

    setStatusChanging(null)
    fetchData()
  }

  // ── Delete — fully atomic via RPC ────────────────────────────────────────────
  async function handleDelete(order: OrderWithDetails) {
    if (!confirm('Delete this order?')) return

    const { error } = await supabase.rpc('delete_order', { p_order_id: order.id })
    if (error) alert(`Could not delete order: ${error.message}`)

    fetchData()
  }

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase()
    return orders.filter(o => {
      const gamepassNames = (o.order_items ?? []).map(i => i.gamepass_name.toLowerCase()).join(' ')
      const matchSearch = !q ||
        (o.buyer_name ?? '').toLowerCase().includes(q) ||
        (o.order_number ?? '').toLowerCase().includes(q) ||
        (o.gamepasses?.name ?? '').toLowerCase().includes(q) ||
        gamepassNames.includes(q)
      const matchStatus = filterStatus === 'all' || o.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [orders, deferredSearch, filterStatus])

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const totals = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed')
    const active = orders.filter(o => ['pending', 'paid'].includes(o.status)).length
    if (metricView === 'today') {
      const todayCompleted = completed.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === todayStr)
      return {
        revenue: todayCompleted.reduce((s, o) => s + (o.selling_price ?? 0), 0),
        profit: todayCompleted.reduce((s, o) => s + (o.profit ?? 0), 0),
        active,
        revenueLabel: "Today's Revenue",
        profitLabel: "Today's Profit",
      }
    }
    return {
      revenue: completed.reduce((s, o) => s + (o.selling_price ?? 0), 0),
      profit: completed.reduce((s, o) => s + (o.profit ?? 0), 0),
      active,
      revenueLabel: 'Completed Revenue',
      profitLabel: 'Total Profit',
    }
  }, [orders, metricView, todayStr])

  const statusGroups = useMemo(() => {
    const counts: Record<string, number> = {}
    orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1 })
    return counts
  }, [orders])

  const STATUS_CHIPS = ['all', 'pending', 'paid', 'completed', 'refunded', 'cancelled'] as const
  return (
    <div>
      <TopBar
        title="Orders"
        subtitle="Manage and track all sales"
        searchPlaceholder="Search orders..."
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel="+ New Order"
        onActionClick={() => { setEditOrder(null); setModalOpen(true) }}
      />

      <div className="p-5 space-y-4">
        {/* Summary header + toggle */}
        <div className="flex items-center justify-between">
          <span className="label-caps">Summary</span>
          <div className="metric-toggle">
            {(['today', 'overall'] as const).map(view => (
              <button
                key={view}
                onClick={() => setMetricView(view)}
                className={`metric-toggle-btn ${metricView === view ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
              >
                {metricView === view && (
                  <motion.div layoutId="orders-toggle-bg" className="metric-toggle-bg" transition={springToggle} />
                )}
                <span className="relative z-10 capitalize">{view}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { label: totals.revenueLabel, value: `₱${totals.revenue.toFixed(2)}`, color: 'oklch(0.10 0.030 272)' },
            { label: totals.profitLabel,  value: `₱${totals.profit.toFixed(2)}`,  color: '#22d3ee' },
            { label: 'Active Orders',     value: String(totals.active),            color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="summary-card">
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map(s => {
            const count = s === 'all' ? orders.length : (statusGroups[s] ?? 0)
            const isActive = filterStatus === s
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`chip capitalize ${isActive ? 'chip-active' : ''}`}
              >
                {s === 'all' ? 'All' : s}
                <span className="ml-1 opacity-50">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass-card p-8 flex justify-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No orders found.</p>
            <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2 bg-primary text-primary-foreground text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> New Order
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left">Order</th>
                    <th className="text-left">Buyer</th>
                    <th className="text-left">Gamepasses</th>
                    <th className="text-left">Account</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Profit</th>
                    <th className="text-left">Pay</th>
                    <th className="text-center">Status</th>
                    <th className="text-left">Time</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => {
                    const nextStatus = STATUS_FLOW[order.status]
                    const items = order.order_items ?? []
                    const hasMultiple = items.length > 1

                    return (
                      <tr key={order.id} className="group">
                        <td>
                          <span className="text-[12px] font-mono font-semibold" style={{ color: '#22d3ee' }}>{order.order_number ?? '—'}</span>
                        </td>
                        <td>
                          <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.buyer_name ?? '—'}</p>
                          {order.buyer_roblox_username && (
                            <p className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.buyer_roblox_username}</p>
                          )}
                        </td>
                        <td className="max-w-[200px]">
                          {items.length > 0 ? (
                            <div className="space-y-1">
                              {items.slice(0, 2).map((item, i) => (
                                <div key={i}>
                                  <p className="text-[13px] font-semibold truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{item.gamepass_name}</p>
                                  <p className="text-[11px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>{item.game_name}</p>
                                </div>
                              ))}
                              {items.length > 2 && (
                                <p className="text-[11px] font-medium" style={{ color: '#22d3ee' }}>+{items.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-[13px] font-semibold truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.gamepasses?.name ?? '—'}</p>
                              <p className="text-[11px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.gamepasses?.games?.name ?? ''}</p>
                            </div>
                          )}
                          {hasMultiple && (
                            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee' }}>
                              {items.length} items
                            </span>
                          )}
                        </td>
                        <td>
                          <p className="text-[13px] font-medium" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.roblox_accounts?.username ?? '—'}</p>
                          {order.robux_amount != null && (
                            <p className="text-[11px] tabular-nums" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.robux_amount.toLocaleString()} R$</p>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                            {order.selling_price ? `₱${order.selling_price}` : '—'}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`text-[13px] font-bold ${(order.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {order.profit != null ? `₱${order.profit.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.payment_method}</span>
                        </td>
                        <td className="text-center">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="whitespace-nowrap text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </td>
                        <td>
                          {(() => {
                            const isBusy = statusChanging === order.id
                            return (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {nextStatus && (
                              <button
                                onClick={() => handleStatusChange(order, nextStatus)}
                                disabled={isBusy}
                                title={`Mark as ${nextStatus}`}
                                className="w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary/30 text-primary flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isBusy
                                  ? <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                  : <Check className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => { if (!isBusy) { setEditOrder(order); setModalOpen(true) } }}
                              disabled={isBusy}
                              title="Edit"
                              className="w-7 h-7 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                disabled={isBusy}
                                className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                {order.status !== 'refunded' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order, 'refunded')}
                                    className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400"
                                  >
                                    <X className="w-3.5 h-3.5" /> Mark Refunded
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'cancelled' && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order, 'cancelled')}
                                    className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400"
                                  >
                                    <X className="w-3.5 h-3.5" /> Cancel
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-border/50" />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(order)}
                                  className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {hasMore && (
                  <tfoot>
                    <tr>
                      <td colSpan={10} className="text-center py-4">
                        <button
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="text-xs font-medium transition-opacity disabled:opacity-40"
                          style={{ color: '#22d3ee' }}
                        >
                          {loadingMore ? 'Loading…' : `Load more orders`}
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      <OrderModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditOrder(null) }}
        onSave={handleSave}
        order={editOrder}
        gamepasses={gamepasses}
        accounts={accounts}
        loading={saving}
      />
    </div>
  )
}
