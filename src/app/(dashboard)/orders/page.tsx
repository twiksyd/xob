'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { formatDistanceToNow } from 'date-fns'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FLOW: Record<string, string> = {
  pending: 'paid',
  paid: 'completed',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OrderWithDetails | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordRes, gpRes, accRes] = await Promise.all([
      supabase.from('orders')
        .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
        .order('created_at', { ascending: false }),
      supabase.from('gamepasses').select('*, games(*)').eq('is_active', true).order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
    ])
    if (ordRes.data) setOrders(ordRes.data as OrderWithDetails[])
    if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
    if (accRes.data) setAccounts(accRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Financial helpers ────────────────────────────────────────────────────────
  // Deduct Robux from an account (floors at 0 to prevent negatives)
  async function deductRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase
      .from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({
      current_robux: Math.max(0, acc.current_robux - amount),
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)
  }

  // Restore Robux to an account (used on refund/cancellation of completed order)
  async function restoreRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase
      .from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({
      current_robux: acc.current_robux + amount,
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)
  }

  // Credit wallet with sale income (positive amount = inflow)
  async function creditWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null) {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({
      user_id: userId, type: 'income', amount,
      category: 'Sale',
      description: `Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`,
      reference_order_id: orderId,
    })
  }

  // Reverse wallet income (negative amount = outflow, reduces balance)
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

      // H2 / C3: Sync financial state based on status transition
      if (prevStatus !== 'completed' && newStatus === 'completed') {
        // Becoming completed via edit — deduct Robux + credit wallet
        if (data.roblox_account_id && totalRobux > 0) await deductRobux(data.roblox_account_id, totalRobux)
        await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
      } else if (prevStatus === 'completed' && newStatus !== 'completed') {
        // Leaving completed via edit — restore Robux + reverse wallet
        if (editOrder.roblox_account_id && editOrder.robux_amount) {
          await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
        }
        const reason = newStatus === 'refunded' ? 'Refund' : 'Cancellation'
        await reverseWallet(user.id, editOrder.id, editOrder.selling_price ?? 0, editOrder.order_number ?? null, editOrder.buyer_name ?? null, reason)
      } else if (prevStatus === 'completed' && newStatus === 'completed' && totalPrice !== (editOrder.selling_price ?? 0)) {
        // Staying completed but price changed — replace the original Sale entry
        await supabase.from('wallet_transactions')
          .delete().eq('reference_order_id', editOrder.id).eq('type', 'income').eq('category', 'Sale')
        await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
      }
    } else {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: user.id,
        buyer_name: data.buyer_name,
        buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id,
        payment_method: data.payment_method,
        status: data.status,
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

      // C3: Order created directly as completed — apply financial effects immediately
      if (data.status === 'completed' && newOrder) {
        if (data.roblox_account_id && totalRobux > 0) await deductRobux(data.roblox_account_id, totalRobux)
        await creditWallet(user.id, newOrder.id, totalPrice, newOrder.order_number ?? null, data.buyer_name || null)
      }
    }

    setSaving(false)
    setModalOpen(false)
    setEditOrder(null)
    fetchData()
  }

  async function handleStatusChange(order: OrderWithDetails, newStatus: string) {
    const prevStatus = order.status

    // Guard: no-op and prevent double-processing
    if (prevStatus === newStatus) { fetchData(); return }

    await supabase.from('orders').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { fetchData(); return }

    // Completing an order — deduct Robux + credit wallet once
    if (newStatus === 'completed' && prevStatus !== 'completed') {
      if (order.roblox_account_id && order.robux_amount) {
        await deductRobux(order.roblox_account_id, order.robux_amount)
      }
      await creditWallet(user.id, order.id, order.selling_price ?? 0, order.order_number ?? null, order.buyer_name ?? null)
    }

    // Refunding or cancelling a previously completed order — restore Robux + reverse wallet
    if (prevStatus === 'completed' && (newStatus === 'refunded' || newStatus === 'cancelled')) {
      if (order.roblox_account_id && order.robux_amount) {
        await restoreRobux(order.roblox_account_id, order.robux_amount)
      }
      const reason = newStatus === 'refunded' ? 'Refund' : 'Cancellation'
      await reverseWallet(user.id, order.id, order.selling_price ?? 0, order.order_number ?? null, order.buyer_name ?? null, reason)
    }

    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order?')) return
    await supabase.from('orders').delete().eq('id', id)
    fetchData()
  }

  const filtered = useMemo(() => orders.filter(o => {
    const gamepassNames = (o.order_items ?? []).map(i => i.gamepass_name.toLowerCase()).join(' ')
    const matchSearch = (o.buyer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.order_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.gamepasses?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        gamepassNames.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    return matchSearch && matchStatus
  }), [orders, search, filterStatus])

  const totals = useMemo(() => ({
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.selling_price ?? 0), 0),
    profit: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.profit ?? 0), 0),
    active: orders.filter(o => ['pending', 'paid'].includes(o.status)).length,
  }), [orders])

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
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { label: 'Completed Revenue', value: `₱${totals.revenue.toFixed(2)}`, color: 'oklch(0.10 0.030 272)' },
            { label: 'Total Profit',      value: `₱${totals.profit.toFixed(2)}`,  color: '#22d3ee' },
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
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {nextStatus && (
                              <button
                                onClick={() => handleStatusChange(order, nextStatus)}
                                title={`Mark as ${nextStatus}`}
                                className="w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary/30 text-primary flex items-center justify-center transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditOrder(order); setModalOpen(true) }}
                              title="Edit"
                              className="w-7 h-7 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
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
                                  onClick={() => handleDelete(order.id)}
                                  className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
