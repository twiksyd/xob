'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/shared/TopBar'
import OrderModal from '@/components/orders/OrderModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Order, Gamepass, Game, RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, Search, ShoppingCart, MoreHorizontal, Edit2, Trash2, Truck, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type OrderWithDetails = Order & {
  gamepasses: (Gamepass & { games: Game | null }) | null
  roblox_accounts: RobloxAccount | null
}
type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FLOW: Record<string, string> = {
  pending: 'paid',
  paid: 'delivering',
  delivering: 'completed',
}


export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordRes, gpRes, accRes] = await Promise.all([
      supabase.from('orders')
        .select('*, gamepasses(*, games(*)), roblox_accounts(*)')
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

  async function handleSave(data: any) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editOrder) {
      await supabase.from('orders').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editOrder.id)
    } else {
      await supabase.from('orders').insert({ ...data, user_id: user.id })
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
    const matchSearch = (o.buyer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.order_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.gamepasses?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    return matchSearch && matchStatus
  }), [orders, search, filterStatus])

  const totals = useMemo(() => ({
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.selling_price ?? 0), 0),
    profit: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.profit ?? 0), 0),
    pending: orders.filter(o => ['pending', 'paid', 'delivering'].includes(o.status)).length,
  }), [orders])

  return (
    <div>
      <TopBar title="Orders" subtitle="Manage and track all sales" />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Completed Revenue</p>
            <p className="text-xl font-bold text-foreground">₱{totals.revenue.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Total Profit</p>
            <p className="text-xl font-bold text-emerald-400">₱{totals.profit.toFixed(2)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground">Active Orders</p>
            <p className="text-xl font-bold text-amber-400">{totals.pending}</p>
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

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'paid', 'delivering', 'completed', 'refunded', 'cancelled'] as const).map(s => {
            const count = s === 'all' ? orders.length : orders.filter(o => o.status === s).length
            const colorMap: Record<string, string> = {
              all: filterStatus === 'all' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70 hover:text-foreground',
              pending: filterStatus === 'pending' ? 'bg-slate-500/20 text-slate-300 border-slate-500/40' : 'text-slate-400/60 border-slate-500/20 hover:bg-slate-500/10 hover:text-slate-300',
              paid: filterStatus === 'paid' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'text-blue-400/60 border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-400',
              delivering: filterStatus === 'delivering' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'text-amber-400/60 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-400',
              completed: filterStatus === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'text-emerald-400/60 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-400',
              refunded: filterStatus === 'refunded' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'text-purple-400/60 border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-400',
              cancelled: filterStatus === 'cancelled' ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'text-red-400/60 border-red-500/20 hover:bg-red-500/10 hover:text-red-400',
            }
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${colorMap[s]}`}
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
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Buyer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Gamepass</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Account</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Profit</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Payment</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(order => {
                    const nextStatus = STATUS_FLOW[order.status]
                    return (
                      <tr key={order.id} className="hover:bg-accent/20 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{order.order_number ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">{order.buyer_name ?? '—'}</p>
                          {order.buyer_roblox_username && (
                            <p className="text-[10px] text-muted-foreground">{order.buyer_roblox_username}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">{order.gamepasses?.name ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{order.gamepasses?.games?.name ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-foreground">{order.roblox_accounts?.username ?? '—'}</p>
                          {order.robux_amount && (
                            <p className="text-[10px] text-muted-foreground">{order.robux_amount.toLocaleString()} R$</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                          {order.selling_price ? `₱${order.selling_price}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs font-semibold ${(order.profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {order.profit ? `₱${order.profit.toFixed(2)}` : '—'}
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
                                <Truck className="w-3.5 h-3.5" />
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
