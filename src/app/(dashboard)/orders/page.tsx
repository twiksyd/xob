'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/shared/TopBar'
import OrderModal from '@/components/orders/OrderModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Order, Gamepass, Game, RobloxAccount, LineItem, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, Search, ShoppingCart, MoreHorizontal, Edit2, Trash2, Check, X } from 'lucide-react'
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

  async function handleSave(data: any, items: LineItem[]) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const totalRobux = items.reduce((s, i) => s + i.robux_amount, 0)
    const totalPrice = items.reduce((s, i) => s + i.selling_price, 0)
    const totalCost = items.reduce((s, i) => s + i.cost, 0)
    const totalProfit = items.reduce((s, i) => s + i.profit, 0)
    const firstItem = items[0]

    if (editOrder) {
      await supabase.from('orders').update({
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
    }

    setSaving(false)
    setModalOpen(false)
    setEditOrder(null)
    fetchData()
  }

  async function handleStatusChange(order: Order, newStatus: string) {
    await supabase.from('orders').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)
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
  const chipColor: Record<string, { active: string; idle: string }> = {
    all:       { active: 'bg-primary/20 text-primary border-primary/40',          idle: 'text-muted-foreground border-border/40 hover:bg-secondary/50 hover:text-foreground' },
    pending:   { active: 'bg-slate-500/20 text-slate-300 border-slate-400/40',    idle: 'text-slate-400/60 border-slate-500/20 hover:bg-slate-500/10 hover:text-slate-300' },
    paid:      { active: 'bg-blue-500/20 text-blue-400 border-blue-400/40',       idle: 'text-blue-400/50 border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-400' },
    completed: { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40', idle: 'text-emerald-400/50 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-400' },
    refunded:  { active: 'bg-purple-500/20 text-purple-400 border-purple-400/40', idle: 'text-purple-400/50 border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-400' },
    cancelled: { active: 'bg-red-500/20 text-red-400 border-red-400/40',          idle: 'text-red-400/50 border-red-500/20 hover:bg-red-500/10 hover:text-red-400' },
  }

  return (
    <div>
      <TopBar title="Orders" subtitle="Manage and track all sales" />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed Revenue</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">₱{totals.revenue.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">₱{totals.profit.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Orders</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{totals.active}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-input h-9 text-sm" />
          </div>
          <Button
            onClick={() => { setEditOrder(null); setModalOpen(true) }}
            className="gap-2 bg-primary text-primary-foreground h-9 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Order
          </Button>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map(s => {
            const count = s === 'all' ? orders.length : (statusGroups[s] ?? 0)
            const isActive = filterStatus === s
            const colors = chipColor[s]
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${isActive ? colors.active : colors.idle}`}
              >
                {s === 'all' ? 'All' : s}
                <span className="ml-1.5 opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/20">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Buyer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Gamepasses</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Account</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Profit</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Pay</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide">Time</th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(order => {
                    const nextStatus = STATUS_FLOW[order.status]
                    const items = order.order_items ?? []
                    const hasMultiple = items.length > 1

                    return (
                      <tr key={order.id} className="hover:bg-accent/20 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-primary/80 font-medium">{order.order_number ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">{order.buyer_name ?? '—'}</p>
                          {order.buyer_roblox_username && (
                            <p className="text-[10px] text-muted-foreground">{order.buyer_roblox_username}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {items.length > 0 ? (
                            <div className="space-y-0.5">
                              {items.slice(0, 2).map((item, i) => (
                                <div key={i}>
                                  <p className="text-xs font-medium text-foreground truncate">{item.gamepass_name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{item.game_name}</p>
                                </div>
                              ))}
                              {items.length > 2 && (
                                <p className="text-[10px] text-primary">+{items.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-medium text-foreground truncate">{order.gamepasses?.name ?? '—'}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{order.gamepasses?.games?.name ?? ''}</p>
                            </div>
                          )}
                          {hasMultiple && (
                            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                              {items.length} items
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-foreground">{order.roblox_accounts?.username ?? '—'}</p>
                          {order.robux_amount != null && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">{order.robux_amount.toLocaleString()} R$</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold text-foreground">
                            {order.selling_price ? `₱${order.selling_price}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${(order.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {order.profit != null ? `₱${order.profit.toFixed(2)}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{order.payment_method}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3">
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
