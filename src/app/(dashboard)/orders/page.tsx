'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import GamepassPicker from '@/components/orders/GamepassPicker'
import AccountSelector from '@/components/inventory/AccountSelector'
import { Gamepass, Game, RobloxAccount, LineItem, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, MoreHorizontal, Edit2, Trash2, X, ChevronDown, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FLOW: Record<string, string> = { pending: 'paid', paid: 'completed' }

const ACTION_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: 'Mark Paid',  bg: 'rgba(245,158,11,0.09)',  color: '#b45309', border: 'rgba(245,158,11,0.24)' },
  paid:    { label: 'Complete',   bg: 'rgba(52,211,153,0.09)',  color: '#047857', border: 'rgba(52,211,153,0.24)' },
}

const STATUS_ACCENT: Record<string, string> = { pending: '#f59e0b', paid: '#22d3ee' }

const PAGE_SIZE = 50

const schema = z.object({
  buyer_name:            z.string().optional(),
  buyer_roblox_username: z.string().optional(),
  roblox_account_id:     z.string().min(1, 'Select an account'),
  payment_method:        z.enum(['GCash', 'Maya', 'Bank', 'Cash', 'Other']),
  status:                z.enum(['pending', 'paid', 'completed', 'refunded', 'cancelled']),
  notes:                 z.string().optional(),
})
type FormData = z.infer<typeof schema>

function mkItem(): LineItem {
  return {
    _key: Math.random().toString(36).slice(2),
    gamepass_id: '', gamepass_name: '', game_name: null,
    robux_amount: 0, selling_price: 0, cost: 0, profit: 0,
  }
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="section-divider" />
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]                   = useState<OrderWithDetails[]>([])
  const [hasMore, setHasMore]                 = useState(false)
  const [loadingMore, setLoadingMore]         = useState(false)
  const [gamepasses, setGamepasses]           = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]               = useState<RobloxAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [statusChanging, setStatusChanging]   = useState<string | null>(null)
  const [editOrder, setEditOrder]             = useState<OrderWithDetails | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [justCreated, setJustCreated]         = useState(false)
  const [items, setItems]                     = useState<LineItem[]>([mkItem()])
  const supabase = useMemo(() => createClient(), [])

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer_name: '', buyer_roblox_username: '',
      roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '',
    },
  })

  const accountId    = watch('roblox_account_id')
  const payMethod    = watch('payment_method')
  const statusVal    = watch('status')
  const totalRobux   = items.reduce((s, i) => s + i.robux_amount, 0)
  const totalPrice   = items.reduce((s, i) => s + i.selling_price, 0)
  const totalProfit  = items.reduce((s, i) => s + i.profit, 0)
  const validItems   = items.filter(i => i.gamepass_id)
  const isEditMode   = editOrder !== null

  // ── Populate form when editing ──────────────────────────────────────────────
  useEffect(() => {
    if (editOrder) {
      reset({
        buyer_name:            editOrder.buyer_name ?? '',
        buyer_roblox_username: editOrder.buyer_roblox_username ?? '',
        roblox_account_id:     editOrder.roblox_account_id ?? '',
        payment_method:        editOrder.payment_method,
        status:                (editOrder.status === 'delivering' ? 'paid' : editOrder.status) as any,
        notes:                 editOrder.notes ?? '',
      })
      const oi = editOrder.order_items
      if (oi && oi.length > 0) {
        setItems(oi.map(item => ({
          _key: item.id,
          gamepass_id:    item.gamepass_id ?? '',
          gamepass_name:  item.gamepass_name,
          game_name:      item.game_name,
          robux_amount:   item.robux_amount,
          selling_price:  item.selling_price,
          cost:           item.cost,
          profit:         item.profit,
        })))
      } else {
        setItems([{
          _key:           'legacy',
          gamepass_id:    editOrder.gamepass_id ?? '',
          gamepass_name:  '',
          game_name:      null,
          robux_amount:   editOrder.robux_amount ?? 0,
          selling_price:  editOrder.selling_price ?? 0,
          cost:           editOrder.cost ?? 0,
          profit:         editOrder.profit ?? 0,
        }])
      }
    } else {
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      setItems([mkItem()])
    }
  }, [editOrder, reset])

  function cancelEdit() { setEditOrder(null) }

  function updateItem(key: string, gamepass_id: string) {
    const gp = gamepasses.find(g => g.id === gamepass_id)
    setItems(prev => prev.map(item => item._key !== key ? item : {
      ...item, gamepass_id,
      gamepass_name:  gp?.name ?? '',
      game_name:      gp?.games?.name ?? null,
      robux_amount:   gp?.robux_amount ?? 0,
      selling_price:  gp?.your_price ?? 0,
      cost:           gp?.your_cost ?? 0,
      profit:         gp?.profit ?? 0,
    }))
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
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

  // ── Financial helpers ───────────────────────────────────────────────────────
  async function deductRobux(acctId: string, amount: number) {
    const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', acctId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({ current_robux: Math.max(0, acc.current_robux - amount), updated_at: new Date().toISOString() }).eq('id', acctId)
  }
  async function restoreRobux(acctId: string, amount: number) {
    const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', acctId).single()
    if (!acc) return
    await supabase.from('roblox_accounts').update({ current_robux: acc.current_robux + amount, updated_at: new Date().toISOString() }).eq('id', acctId)
  }
  async function creditWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null) {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'income', amount, category: 'Sale', description: `Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
  }
  async function reverseWallet(userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null, reason: 'Refund' | 'Cancellation') {
    if (amount <= 0) return
    await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'expense', amount: -amount, category: reason === 'Refund' ? 'Refund Issued' : 'Cancellation', description: `${reason}: Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    if (validItems.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const tRobux  = validItems.reduce((s, i) => s + i.robux_amount, 0)
    const tPrice  = validItems.reduce((s, i) => s + i.selling_price, 0)
    const tCost   = validItems.reduce((s, i) => s + i.cost, 0)
    const tProfit = validItems.reduce((s, i) => s + i.profit, 0)
    const first   = validItems[0]

    if (editOrder) {
      const prevStatus = editOrder.status
      const newStatus  = data.status
      await supabase.from('orders').update({
        buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: newStatus, notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        updated_at: new Date().toISOString(),
      }).eq('id', editOrder.id)
      await supabase.from('order_items').delete().eq('order_id', editOrder.id)
      if (validItems.length > 0) {
        await supabase.from('order_items').insert(validItems.map(item => ({
          order_id: editOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (prevStatus !== 'completed' && newStatus === 'completed') {
        if (data.roblox_account_id && tRobux > 0) await deductRobux(data.roblox_account_id, tRobux)
        await creditWallet(user.id, editOrder.id, tPrice, editOrder.order_number ?? null, data.buyer_name || null)
      } else if (prevStatus === 'completed' && newStatus !== 'completed') {
        if (editOrder.roblox_account_id && editOrder.robux_amount) await restoreRobux(editOrder.roblox_account_id, editOrder.robux_amount)
        await reverseWallet(user.id, editOrder.id, editOrder.selling_price ?? 0, editOrder.order_number ?? null, editOrder.buyer_name ?? null, newStatus === 'refunded' ? 'Refund' : 'Cancellation')
      }
      setEditOrder(null)
    } else {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: user.id, buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: 'pending', notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
      }).select().single()
      if (newOrder && validItems.length > 0) {
        await supabase.from('order_items').insert(validItems.map(item => ({
          order_id: newOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (newOrder && data.status !== 'pending') {
        await supabase.rpc('transition_order', { p_order_id: newOrder.id, p_new_status: data.status })
      }
      setJustCreated(true)
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      setItems([mkItem()])
      setTimeout(() => setJustCreated(false), 1800)
    }

    setSaving(false)
    fetchData()
  }

  // ── Status / delete ─────────────────────────────────────────────────────────
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeOrders  = useMemo(() => orders.filter(o => ['pending', 'paid'].includes(o.status)), [orders])
  const historyOrders = useMemo(() => orders.filter(o => ['completed', 'refunded', 'cancelled'].includes(o.status)), [orders])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <TopBar
        title="Order Workspace"
        subtitle={isEditMode ? `Editing ${editOrder.order_number ?? 'order'}` : 'Create orders fast — form stays open'}
      />

      <div className="flex gap-5 p-5 pt-4 flex-1 min-h-0" style={{ overflow: 'hidden' }}>

        {/* ── LEFT: Create / Edit panel (≈70%) ──────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="glass-workspace overflow-hidden">

            {/* Panel header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{
                background: 'linear-gradient(180deg, rgba(139,92,246,0.022) 0%, transparent 100%)',
                boxShadow: 'inset 0 -1px 0 rgba(139,92,246,0.11), inset 0 -1px 0 rgba(34,211,238,0.07)',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isEditMode ? 'edit' : 'new'}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.16 }}
                >
                  <h2 className="text-[14px] font-bold tracking-tight" style={{ color: 'oklch(0.095 0.032 272)' }}>
                    {isEditMode ? 'Edit Order' : 'Create Order'}
                  </h2>
                  <p className="text-[11px] mt-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>
                    {isEditMode
                      ? `${editOrder.order_number ?? '—'} · ${editOrder.buyer_name ?? 'No buyer name'}`
                      : 'Resets after submit — ready for the next order immediately'}
                  </p>
                </motion.div>
              </AnimatePresence>

              {isEditMode && (
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{ background: 'rgba(15,13,42,0.04)', color: 'oklch(0.48 0.016 265)', border: '1px solid rgba(15,13,42,0.08)' }}
                >
                  <X className="w-3 h-3" /> Cancel Edit
                </button>
              )}
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 form-stagger">

              {/* ── Buyer ── */}
              <div className="form-section" style={{ animationDelay: '0.04s' }}>
                <SectionLabel>Buyer</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold" style={{ color: 'oklch(0.42 0.016 265)' }}>
                      Name / GCash Name
                    </Label>
                    <Input
                      {...register('buyer_name')}
                      placeholder="John Doe"
                      className="bg-input h-9 text-[13px]"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold" style={{ color: 'oklch(0.42 0.016 265)' }}>
                      Roblox Username
                    </Label>
                    <Input
                      {...register('buyer_roblox_username')}
                      placeholder="JohnDoe123"
                      className="bg-input h-9 text-[13px]"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <Divider />

              {/* ── Gamepasses ── */}
              <div className="form-section" style={{ animationDelay: '0.09s' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <SectionLabel>Gamepasses</SectionLabel>
                  {validItems.length > 0 && (
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: '#22d3ee' }}>
                      {validItems.length} selected
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item._key}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <GamepassPicker
                            gamepasses={gamepasses}
                            value={item.gamepass_id}
                            onChange={id => updateItem(item._key, id)}
                          />
                          {item.gamepass_id && (
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                              <div className="rounded-lg py-2 text-center" style={{ background: 'rgba(15,13,42,0.030)' }}>
                                <p className="text-[10px] mb-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>Robux</p>
                                <p className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.10 0.030 272)' }}>
                                  {item.robux_amount.toLocaleString()} R$
                                </p>
                              </div>
                              <div className="rounded-lg py-2 text-center" style={{ background: 'rgba(15,13,42,0.030)' }}>
                                <p className="text-[10px] mb-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>Price</p>
                                <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                                  ₱{item.selling_price}
                                </p>
                              </div>
                              <div className="rounded-lg py-2 text-center" style={{ background: 'rgba(52,211,153,0.08)' }}>
                                <p className="text-[10px] mb-0.5 text-emerald-500/70">Profit</p>
                                <p className="text-[12px] font-bold text-emerald-600">₱{item.profit.toFixed(2)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter(i => i._key !== item._key))}
                            className="mt-1 w-8 h-8 flex-shrink-0 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 flex items-center justify-center transition-colors"
                            style={{ background: 'rgba(15,13,42,0.03)' }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setItems(prev => [...prev, mkItem()])}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-medium transition-colors"
                  style={{
                    border: '1px dashed rgba(139,92,246,0.25)',
                    color: 'oklch(0.50 0.090 280)',
                    background: 'rgba(139,92,246,0.03)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add another gamepass
                </button>
              </div>

              {/* Totals preview — always show when any item has a gamepass */}
              {validItems.length > 0 && (
                <div className="totals-bar grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: 'oklch(0.55 0.010 265)' }}>Total Robux</p>
                    <p className="text-[14px] font-bold tabular-nums" style={{ color: 'oklch(0.095 0.032 272)' }}>
                      {totalRobux.toLocaleString()} R$
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: 'oklch(0.55 0.010 265)' }}>Total Price</p>
                    <p className="text-[14px] font-bold" style={{ color: 'oklch(0.095 0.032 272)' }}>
                      ₱{totalPrice.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] mb-1 text-emerald-500/70">Total Profit</p>
                    <p className="text-[14px] font-bold text-emerald-600">₱{totalProfit.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <Divider />

              {/* ── Account ── */}
              <div className="form-section" style={{ animationDelay: '0.14s' }}>
                <SectionLabel>Account</SectionLabel>
                <AccountSelector
                  accounts={accounts}
                  robuxRequired={totalRobux}
                  selectedId={accountId}
                  onSelect={id => setValue('roblox_account_id', id, { shouldValidate: true })}
                />
                {errors.roblox_account_id && (
                  <p className="text-xs text-red-400 mt-1.5">{errors.roblox_account_id.message}</p>
                )}
              </div>

              <Divider />

              {/* ── Order details ── */}
              <div className="form-section" style={{ animationDelay: '0.19s' }}>
                <SectionLabel>Order Details</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold" style={{ color: 'oklch(0.42 0.016 265)' }}>
                      Payment Method
                    </Label>
                    <Select value={payMethod} onValueChange={v => setValue('payment_method', (v ?? 'GCash') as any)}>
                      <SelectTrigger className="bg-input h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {['GCash', 'Maya', 'Bank', 'Cash', 'Other'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold" style={{ color: 'oklch(0.42 0.016 265)' }}>
                      Status
                    </Label>
                    <Select value={statusVal} onValueChange={v => setValue('status', (v ?? 'pending') as any)}>
                      <SelectTrigger className="bg-input h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {['pending', 'paid', 'completed', 'refunded', 'cancelled'].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Submit ── */}
              <div className="form-section pt-1" style={{ animationDelay: '0.24s' }}>
                <div className="submit-glow-wrap">
                <AnimatePresence mode="wait">
                  {justCreated ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-bold"
                      style={{
                        background: 'rgba(52,211,153,0.11)',
                        border: '1px solid rgba(52,211,153,0.28)',
                        color: '#047857',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Order created — ready for next
                    </motion.div>
                  ) : (
                    <motion.button
                      key="submit"
                      type="submit"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      disabled={saving || validItems.length === 0}
                      className="btn-primary w-full h-11 text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          {isEditMode ? 'Save Changes' : 'Create Order'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
                </div>
                {!isEditMode && (
                  <p className="text-center text-[11px] mt-2" style={{ color: 'oklch(0.64 0.010 265)' }}>
                    Form resets automatically — no need to reopen
                  </p>
                )}
              </div>

            </form>
          </div>
        </div>

        {/* ── RIGHT: Activity panel (≈30%) ──────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex flex-col gap-4 overflow-y-auto"
          style={{ width: '320px', scrollbarWidth: 'thin' }}
        >

          {/* Active orders */}
          <div className="glass-secondary overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3.5"
              style={{
                background: 'rgba(255,255,255,0.28)',
                borderBottom: '1px solid rgba(15,13,42,0.048)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="label-caps">Active Orders</span>
                {activeOrders.length > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: 'rgba(34,211,238,0.10)', color: '#0e7490', border: '1px solid rgba(34,211,238,0.20)' }}
                  >
                    {activeOrders.length}
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-8 flex justify-center"><div className="spinner" /></div>
            ) : activeOrders.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>No active orders</p>
                <p className="text-[11px] mt-1" style={{ color: 'oklch(0.70 0.010 265)' }}>Orders appear here after creation</p>
              </div>
            ) : (
              <AnimatePresence>
                {activeOrders.map((order) => {
                  const nextStatus = STATUS_FLOW[order.status]
                  const action     = nextStatus ? ACTION_CFG[order.status] : null
                  const accent     = STATUS_ACCENT[order.status] ?? '#a78bfa'
                  const isBusy     = statusChanging === order.id
                  const dispItems  = order.order_items && order.order_items.length > 0
                    ? order.order_items
                    : order.gamepasses
                      ? [{ gamepass_name: order.gamepasses.name }]
                      : []

                  return (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.18 }}
                      className="relative order-row-shimmer"
                      style={{ borderBottom: '1px solid rgba(15,13,42,0.042)' }}
                    >
                      {/* Left accent */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: accent }}
                      />

                      <div className="pl-4 pr-3 py-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold" style={{ color: '#22d3ee' }}>
                              {order.order_number ?? '—'}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setEditOrder(order)}
                              className="w-6 h-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                disabled={isBusy}
                                className="w-6 h-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                {order.status !== 'refunded' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order, 'refunded')} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                                    <X className="w-3.5 h-3.5" /> Mark Refunded
                                  </DropdownMenuItem>
                                )}
                                {order.status !== 'cancelled' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order, 'cancelled')} className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400">
                                    <X className="w-3.5 h-3.5" /> Cancel
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-border/50" />
                                <DropdownMenuItem onClick={() => handleDelete(order)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Buyer */}
                        <p className="text-[12px] font-semibold truncate" style={{ color: 'oklch(0.095 0.032 272)' }}>
                          {order.buyer_name || (
                            <span style={{ color: 'oklch(0.60 0.010 265)', fontStyle: 'italic', fontWeight: 400, fontSize: '11px' }}>
                              No buyer name
                            </span>
                          )}
                        </p>

                        {/* Gamepass name */}
                        {dispItems.length > 0 && (
                          <p className="text-[11px] truncate mt-0.5 mb-2.5" style={{ color: 'oklch(0.55 0.010 265)' }}>
                            {(dispItems as any)[0].gamepass_name}
                            {dispItems.length > 1 && (
                              <span style={{ color: '#22d3ee' }}> +{dispItems.length - 1}</span>
                            )}
                          </p>
                        )}

                        {/* Price + action button */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold tabular-nums" style={{ color: 'oklch(0.095 0.032 272)' }}>
                            {order.selling_price ? `₱${order.selling_price}` : '—'}
                          </span>
                          {action && nextStatus && (
                            <button
                              onClick={() => handleStatusChange(order, nextStatus)}
                              disabled={isBusy}
                              className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-40 flex-shrink-0"
                              style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}` }}
                            >
                              {isBusy
                                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                : action.label}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>

          {/* History */}
          {!loading && (
            <div className="glass-secondary overflow-hidden">
              <button
                onClick={() => setHistoryExpanded(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{
                  background: historyExpanded ? 'rgba(255,255,255,0.28)' : 'transparent',
                  borderBottom: historyExpanded ? '1px solid rgba(15,13,42,0.048)' : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="label-caps">History</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(15,13,42,0.05)', color: 'oklch(0.48 0.016 265)' }}
                  >
                    {historyOrders.length}
                  </span>
                </div>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{
                    color: 'oklch(0.48 0.016 265)',
                    transform: historyExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {historyExpanded && (
                <div style={{ maxHeight: '420px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                  {historyOrders.length === 0 ? (
                    <p className="text-center text-[12px] py-6" style={{ color: 'oklch(0.62 0.010 265)' }}>
                      No history yet
                    </p>
                  ) : (
                    <>
                      {historyOrders.slice(0, 40).map((order) => {
                        const oi = order.order_items ?? []
                        return (
                          <div
                            key={order.id}
                            className="flex items-center gap-2.5 px-4 py-2.5 group order-row-shimmer transition-colors"
                            style={{ borderBottom: '1px solid rgba(15,13,42,0.038)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-mono text-[10px] font-semibold" style={{ color: '#22d3ee' }}>
                                  {order.order_number ?? '—'}
                                </span>
                                <StatusBadge status={order.status} />
                              </div>
                              <p className="text-[11px] font-medium truncate" style={{ color: 'oklch(0.20 0.025 270)' }}>
                                {order.buyer_name ?? '—'}
                              </p>
                              <p className="text-[10px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>
                                {oi.length > 0 ? oi[0].gamepass_name : (order.gamepasses?.name ?? '—')}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[12px] font-bold" style={{ color: 'oklch(0.095 0.032 272)' }}>
                                {order.selling_price ? `₱${order.selling_price}` : '—'}
                              </p>
                              <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <button
                              onClick={() => setEditOrder(order)}
                              className="w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all flex-shrink-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                      {hasMore && (
                        <div className="px-4 py-3 text-center">
                          <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="text-[11px] font-medium disabled:opacity-40 transition-opacity"
                            style={{ color: '#22d3ee' }}
                          >
                            {loadingMore ? 'Loading…' : 'Load more'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
