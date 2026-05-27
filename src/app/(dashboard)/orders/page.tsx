'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import OrderModal from '@/components/orders/OrderModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Gamepass, Game, RobloxAccount, LineItem, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, ShoppingCart, MoreHorizontal, Edit2, Trash2, X, ChevronDown } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { springToggle } from '@/lib/motion'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FLOW: Record<string, string> = {
  pending: 'paid',
  paid:    'completed',
}

const ACTION_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: 'Mark as Paid',    bg: 'rgba(245,158,11,0.09)',  color: '#b45309', border: 'rgba(245,158,11,0.24)' },
  paid:    { label: 'Mark Complete',   bg: 'rgba(52,211,153,0.09)',  color: '#047857', border: 'rgba(52,211,153,0.24)' },
}

const STATUS_ACCENT: Record<string, string> = {
  pending: '#f59e0b',
  paid:    '#22d3ee',
}

const PAGE_SIZE = 100

function matchesSearch(o: OrderWithDetails, q: string): boolean {
  const gpNames = (o.order_items ?? []).map(i => i.gamepass_name.toLowerCase()).join(' ')
  return (o.buyer_name ?? '').toLowerCase().includes(q) ||
    (o.order_number ?? '').toLowerCase().includes(q) ||
    (o.gamepasses?.name ?? '').toLowerCase().includes(q) ||
    gpNames.includes(q)
}

// ─── Active order card ────────────────────────────────────────────────────────
interface CardProps {
  order: OrderWithDetails
  onStatusChange: (o: OrderWithDetails, s: string) => void
  onEdit: (o: OrderWithDetails) => void
  onDelete: (o: OrderWithDetails) => void
  isBusy: boolean
}

function OrderCard({ order, onStatusChange, onEdit, onDelete, isBusy }: CardProps) {
  const nextStatus = STATUS_FLOW[order.status]
  const action     = nextStatus ? ACTION_CFG[order.status] : null
  const accent     = STATUS_ACCENT[order.status] ?? '#a78bfa'
  const items      = order.order_items ?? []

  const displayItems = items.length > 0
    ? items.map(i => ({ name: i.gamepass_name, gameName: i.game_name }))
    : order.gamepasses
      ? [{ name: order.gamepasses.name, gameName: order.gamepasses.games?.name ?? null }]
      : []

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card flex flex-col relative overflow-hidden"
    >
      {/* Status accent top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}CC 0%, ${accent}50 60%, transparent 100%)` }}
      />

      <div className="p-4 pt-5 flex-1 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold" style={{ color: '#22d3ee' }}>
              {order.order_number ?? '—'}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <span className="text-[10px] flex-shrink-0 tabular-nums" style={{ color: 'oklch(0.55 0.010 265)' }}>
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Buyer */}
        <div>
          <p className="text-[13px] font-semibold leading-snug" style={{ color: 'oklch(0.095 0.032 272)' }}>
            {order.buyer_name || (
              <span style={{ color: 'oklch(0.58 0.010 265)', fontStyle: 'italic', fontWeight: 400, fontSize: '12px' }}>
                No buyer name
              </span>
            )}
          </p>
          {order.buyer_roblox_username && (
            <p className="text-[11px] mt-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>
              @{order.buyer_roblox_username}
            </p>
          )}
        </div>

        {/* Gamepasses */}
        {displayItems.length > 0 && (
          <div className="space-y-1.5">
            {displayItems.slice(0, 2).map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: `${accent}90` }}
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'oklch(0.18 0.025 270)' }}>
                    {item.name}
                  </p>
                  {item.gameName && (
                    <p className="text-[10px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>
                      {item.gameName}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {displayItems.length > 2 && (
              <p className="text-[11px] font-semibold pl-3.5" style={{ color: '#22d3ee' }}>
                +{displayItems.length - 2} more
              </p>
            )}
          </div>
        )}

        {/* Price + account */}
        <div
          className="flex items-center justify-between pt-2.5"
          style={{ borderTop: '1px solid rgba(15,13,42,0.055)' }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-[16px] font-bold tabular-nums" style={{ color: 'oklch(0.095 0.032 272)' }}>
              {order.selling_price ? `₱${order.selling_price}` : '—'}
            </span>
            <span className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
              {order.payment_method}
            </span>
          </div>
          {order.roblox_accounts?.username && (
            <span className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
              {order.roblox_accounts.username}
            </span>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div
        className="px-4 pb-4 pt-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(15,13,42,0.048)' }}
      >
        {action && nextStatus ? (
          <button
            onClick={() => onStatusChange(order, nextStatus)}
            disabled={isBusy}
            className="flex-1 h-8 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}` }}
          >
            {isBusy
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : action.label}
          </button>
        ) : (
          <div className="flex-1" />
        )}

        <button
          onClick={() => { if (!isBusy) onEdit(order) }}
          disabled={isBusy}
          className="w-8 h-8 rounded-xl hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isBusy}
            className="w-8 h-8 rounded-xl hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            {order.status !== 'refunded' && (
              <DropdownMenuItem onClick={() => onStatusChange(order, 'refunded')} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                <X className="w-3.5 h-3.5" /> Mark Refunded
              </DropdownMenuItem>
            )}
            {order.status !== 'cancelled' && (
              <DropdownMenuItem onClick={() => onStatusChange(order, 'cancelled')} className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400">
                <X className="w-3.5 h-3.5" /> Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem onClick={() => onDelete(order)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]               = useState<OrderWithDetails[]>([])
  const [hasMore, setHasMore]             = useState(false)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [gamepasses, setGamepasses]       = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]           = useState<RobloxAccount[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [statusChanging, setStatusChanging] = useState<string | null>(null)
  const [modalOpen, setModalOpen]         = useState(false)
  const [editOrder, setEditOrder]         = useState<OrderWithDetails | null>(null)
  const [search, setSearch]               = useState('')
  const deferredSearch                    = useDeferredValue(search)
  const [metricView, setMetricView]       = useState<'today' | 'overall'>('overall')
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'refunded' | 'cancelled'>('all')
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
      setOrders(ordRes.data.slice(0, PAGE_SIZE) as OrderWithDetails[])
      setHasMore(ordRes.data.length > PAGE_SIZE)
    }
    if (gpRes.data)  setGamepasses(gpRes.data as GamepassWithGame[])
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
      setOrders(prev => [...prev, ...(data.slice(0, PAGE_SIZE) as OrderWithDetails[])])
      setHasMore(data.length > PAGE_SIZE)
    }
    setLoadingMore(false)
  }, [supabase, hasMore, loadingMore, orders])

  // ── Financial helpers (edit path only) ──────────────────────────────────────
  async function deductRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({ current_robux: Math.max(0, acc.current_robux - amount), updated_at: new Date().toISOString() }).eq('id', accountId)
  }
  async function restoreRobux(accountId: string, amount: number) {
    const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', accountId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({ current_robux: acc.current_robux + amount, updated_at: new Date().toISOString() }).eq('id', accountId)
  }
  async function creditWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null) {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'income', amount, category: 'Sale', description: `Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
  }
  async function reverseWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null, reason: 'Refund' | 'Cancellation') {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'expense', amount: -amount, category: reason === 'Refund' ? 'Refund Issued' : 'Cancellation', description: `${reason}: Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
  }
  // ────────────────────────────────────────────────────────────────────────────

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
        buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: newStatus, notes: data.notes, gamepass_id: firstItem?.gamepass_id || null,
        robux_amount: totalRobux, selling_price: totalPrice, cost: totalCost, profit: totalProfit,
        updated_at: new Date().toISOString(),
      }).eq('id', editOrder.id)
      await supabase.from('order_items').delete().eq('order_id', editOrder.id)
      if (items.length > 0) {
        await supabase.from('order_items').insert(items.map(item => ({
          order_id: editOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (prevStatus !== 'completed' && newStatus === 'completed') {
        if (data.roblox_account_id && totalRobux > 0) await deductRobux(data.roblox_account_id, totalRobux)
        await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
      } else if (prevStatus === 'completed' && newStatus !== 'completed') {
        if (editOrder.roblox_account_id && editOrder.robux_amount) await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
        const reason = newStatus === 'refunded' ? 'Refund' : 'Cancellation'
        await reverseWallet(user.id, editOrder.id, editOrder.selling_price ?? 0, editOrder.order_number ?? null, editOrder.buyer_name ?? null, reason)
      } else if (prevStatus === 'completed' && newStatus === 'completed') {
        const accountChanged = data.roblox_account_id !== editOrder.roblox_account_id
        const robuxChanged   = totalRobux !== (editOrder.robux_amount ?? 0)
        const priceChanged   = totalPrice !== (editOrder.selling_price ?? 0)
        if (accountChanged) {
          if (editOrder.roblox_account_id && editOrder.robux_amount) await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
          if (data.roblox_account_id && totalRobux > 0) await deductRobux(data.roblox_account_id, totalRobux)
        } else if (robuxChanged && data.roblox_account_id) {
          const diff = totalRobux - (editOrder.robux_amount ?? 0)
          if (diff > 0) await deductRobux(data.roblox_account_id, diff)
          else if (diff < 0) await restoreRobux(data.roblox_account_id, -diff)
        }
        if (priceChanged) {
          await supabase.from('wallet_transactions').delete().eq('reference_order_id', editOrder.id).eq('type', 'income').eq('category', 'Sale')
          await creditWallet(user.id, editOrder.id, totalPrice, editOrder.order_number ?? null, data.buyer_name || null)
        }
      }
    } else {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: user.id, buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: 'pending', notes: data.notes, gamepass_id: firstItem?.gamepass_id || null,
        robux_amount: totalRobux, selling_price: totalPrice, cost: totalCost, profit: totalProfit,
      }).select().single()
      if (newOrder && items.length > 0) {
        await supabase.from('order_items').insert(items.map(item => ({
          order_id: newOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (newOrder && data.status !== 'pending') {
        const { error } = await supabase.rpc('transition_order', { p_order_id: newOrder.id, p_new_status: data.status })
        if (error) alert(`Order created but status transition failed: ${error.message}`)
      }
    }
    setSaving(false)
    setModalOpen(false)
    setEditOrder(null)
    fetchData()
  }

  async function handleStatusChange(order: OrderWithDetails, newStatus: string) {
    if (order.status === newStatus || statusChanging === order.id) return
    setStatusChanging(order.id)
    const { error } = await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: newStatus })
    if (error) alert(`Could not update order status: ${error.message}`)
    setStatusChanging(null)
    fetchData()
  }

  async function handleDelete(order: OrderWithDetails) {
    if (!confirm('Delete this order?')) return
    const { error } = await supabase.rpc('delete_order', { p_order_id: order.id })
    if (error) alert(`Could not delete order: ${error.message}`)
    fetchData()
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const activeOrders = useMemo(() => {
    const q = deferredSearch.toLowerCase()
    return orders
      .filter(o => ['pending', 'paid'].includes(o.status))
      .filter(o => !q || matchesSearch(o, q))
  }, [orders, deferredSearch])

  const historyBase = useMemo(() => {
    const q = deferredSearch.toLowerCase()
    return orders
      .filter(o => ['completed', 'refunded', 'cancelled'].includes(o.status))
      .filter(o => !q || matchesSearch(o, q))
  }, [orders, deferredSearch])

  const historyCounts = useMemo(() => ({
    all:       historyBase.length,
    completed: historyBase.filter(o => o.status === 'completed').length,
    refunded:  historyBase.filter(o => o.status === 'refunded').length,
    cancelled: historyBase.filter(o => o.status === 'cancelled').length,
  }), [historyBase])

  const historyOrders = useMemo(() =>
    historyFilter === 'all' ? historyBase : historyBase.filter(o => o.status === historyFilter),
    [historyBase, historyFilter])

  const totals = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed')
    const active    = orders.filter(o => ['pending', 'paid'].includes(o.status)).length
    if (metricView === 'today') {
      const td = completed.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === todayStr)
      return { revenue: td.reduce((s, o) => s + (o.selling_price ?? 0), 0), profit: td.reduce((s, o) => s + (o.profit ?? 0), 0), active, revenueLabel: "Today's Revenue", profitLabel: "Today's Profit" }
    }
    return { revenue: completed.reduce((s, o) => s + (o.selling_price ?? 0), 0), profit: completed.reduce((s, o) => s + (o.profit ?? 0), 0), active, revenueLabel: 'Completed Revenue', profitLabel: 'Total Profit' }
  }, [orders, metricView, todayStr])

  const openNew = () => { setEditOrder(null); setModalOpen(true) }

  return (
    <div>
      <TopBar
        title="Orders"
        subtitle="Seller operations workspace"
        searchPlaceholder="Search orders..."
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel="+ New Order"
        onActionClick={openNew}
      />

      <div className="p-5 space-y-6">

        {/* ── Performance metrics ─────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-caps">Performance</span>
            <div className="metric-toggle">
              {(['today', 'overall'] as const).map(view => (
                <button key={view} onClick={() => setMetricView(view)}
                  className={`metric-toggle-btn ${metricView === view ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}>
                  {metricView === view && (
                    <motion.div layoutId="orders-toggle-bg" className="metric-toggle-bg" transition={springToggle} />
                  )}
                  <span className="relative z-10 capitalize">{view}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {[
              { label: totals.revenueLabel, value: `₱${totals.revenue.toFixed(2)}`, color: 'oklch(0.095 0.032 272)' },
              { label: totals.profitLabel,  value: `₱${totals.profit.toFixed(2)}`,  color: '#22d3ee' },
              { label: 'Active Orders',     value: String(totals.active),            color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="summary-card">
                <p className="label-caps mb-1">{label}</p>
                <p className="stat-value" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Active Orders Workspace ─────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="label-caps">Active Orders</span>
              {!loading && activeOrders.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,211,238,0.10)', color: '#0e7490', border: '1px solid rgba(34,211,238,0.20)' }}
                >
                  {activeOrders.length} need attention
                </span>
              )}
            </div>
            <button onClick={openNew} className="btn-primary h-8 px-4 flex items-center gap-1.5 text-xs">
              <Plus className="w-3 h-3" /> New Order
            </button>
          </div>

          {loading ? (
            <div className="glass-card p-10 flex justify-center"><div className="spinner" /></div>
          ) : activeOrders.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(167,139,250,0.08))' }}
              >
                <ShoppingCart className="w-6 h-6" style={{ color: '#22d3ee' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1.5" style={{ color: 'oklch(0.095 0.032 272)' }}>
                {deferredSearch ? 'No active orders match your search' : 'No active orders'}
              </p>
              <p className="text-[12px] mb-5" style={{ color: 'oklch(0.55 0.010 265)' }}>
                {deferredSearch ? 'Try a different search term' : 'Create a new order to start fulfilling'}
              </p>
              {!deferredSearch && (
                <button
                  onClick={openNew}
                  className="btn-primary h-9 px-6 inline-flex items-center gap-2 text-xs mx-auto"
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Order
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {activeOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusChange}
                    onEdit={(o) => { setEditOrder(o); setModalOpen(true) }}
                    onDelete={handleDelete}
                    isBusy={statusChanging === order.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Order History ───────────────────────────────────── */}
        {!loading && (
          <div className="space-y-3">
            <button
              onClick={() => setHistoryExpanded(p => !p)}
              className="flex items-center gap-2.5 w-full text-left"
            >
              <span className="label-caps">Order History</span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(15,13,42,0.05)', color: 'oklch(0.48 0.016 265)' }}
              >
                {historyCounts.all}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 ml-auto transition-transform duration-200"
                style={{ color: 'oklch(0.48 0.016 265)', transform: historyExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {historyExpanded && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'completed', 'refunded', 'cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setHistoryFilter(s)}
                      className={`chip capitalize ${historyFilter === s ? 'chip-active' : ''}`}>
                      {s === 'all' ? 'All History' : s}
                      <span className="ml-1 opacity-50">({historyCounts[s]})</span>
                    </button>
                  ))}
                </div>

                {historyOrders.length === 0 ? (
                  <div className="glass-card p-10 text-center" style={{ opacity: 0.65 }}>
                    <p className="text-[13px]" style={{ color: 'oklch(0.55 0.010 265)' }}>No order history yet.</p>
                  </div>
                ) : (
                  <div className="glass-card overflow-hidden" style={{ opacity: 0.88 }}>
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
                            <th className="w-20" />
                          </tr>
                        </thead>
                        <tbody>
                          {historyOrders.map(order => {
                            const items  = order.order_items ?? []
                            const isBusy = statusChanging === order.id
                            return (
                              <tr key={order.id} className="group">
                                <td>
                                  <span className="text-[11px] font-mono font-semibold" style={{ color: '#22d3ee' }}>
                                    {order.order_number ?? '—'}
                                  </span>
                                </td>
                                <td>
                                  <p className="text-[12px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                                    {order.buyer_name ?? '—'}
                                  </p>
                                </td>
                                <td className="max-w-[180px]">
                                  {items.length > 0 ? (
                                    <div>
                                      <p className="text-[12px] truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{items[0].gamepass_name}</p>
                                      {items.length > 1 && <p className="text-[10px]" style={{ color: '#22d3ee' }}>+{items.length - 1} more</p>}
                                    </div>
                                  ) : (
                                    <p className="text-[12px] truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.gamepasses?.name ?? '—'}</p>
                                  )}
                                </td>
                                <td>
                                  <p className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.roblox_accounts?.username ?? '—'}</p>
                                </td>
                                <td className="text-right">
                                  <span className="text-[12px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                                    {order.selling_price ? `₱${order.selling_price}` : '—'}
                                  </span>
                                </td>
                                <td className="text-right">
                                  <span className={`text-[12px] font-semibold ${(order.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {order.profit != null ? `₱${order.profit.toFixed(2)}` : '—'}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.payment_method}</span>
                                </td>
                                <td className="text-center"><StatusBadge status={order.status} /></td>
                                <td className="text-[10px] whitespace-nowrap" style={{ color: 'oklch(0.55 0.010 265)' }}>
                                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                </td>
                                <td>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { if (!isBusy) { setEditOrder(order); setModalOpen(true) } }} disabled={isBusy}
                                      className="w-7 h-7 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-40">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger disabled={isBusy}
                                        className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="bg-popover border-border">
                                        {order.status !== 'refunded' && (
                                          <DropdownMenuItem onClick={() => handleStatusChange(order, 'refunded')} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                                            <X className="w-3.5 h-3.5" /> Mark Refunded
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator className="bg-border/50" />
                                        <DropdownMenuItem onClick={() => handleDelete(order)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
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
                        {hasMore && (
                          <tfoot>
                            <tr>
                              <td colSpan={10} className="text-center py-3">
                                <button onClick={loadMore} disabled={loadingMore}
                                  className="text-xs font-medium transition-opacity disabled:opacity-40"
                                  style={{ color: '#22d3ee' }}>
                                  {loadingMore ? 'Loading…' : 'Load more'}
                                </button>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
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
