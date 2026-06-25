'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import OrderForm, { orderFormSchema, OrderFormData, GamepassWithGame } from '@/components/orders/OrderForm'
import OrderActivityPanel from '@/components/orders/OrderActivityPanel'
import OrderInspectDialog from '@/components/orders/OrderInspectDialog'
import { useOrderCart } from '@/hooks/useOrderCart'
import { RobloxAccount, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { calculateOrderTotals, formatPHP } from '@/lib/utils/pricing'
import { isActiveOrder } from '@/lib/utils/orders'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import CountUp from '@/components/shared/CountUp'
import StatusBadge from '@/components/shared/StatusBadge'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, ClipboardList, Wallet, TrendingUp, CheckCircle2,
  Loader2, Edit2, ArrowUpRight, AlertCircle, X, MoreHorizontal, Trash2,
} from 'lucide-react'
import type { CSSProperties } from 'react'

const PAGE_SIZE = 50

// ── Blob ─────────────────────────────────────────────────────────────────────
function Blob({ color, width, height, style }: { color: string; width: number; height: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', width, height,
        background: color, borderRadius: '50%',
        filter: `blur(${Math.round(Math.max(width, height) * 0.18)}px)`,
        pointerEvents: 'none', ...style,
      }}
    />
  )
}

// ── Section label (matches Dashboard) ────────────────────────────────────────
function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 mb-6"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.18)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

// ── Status advance config ─────────────────────────────────────────────────────
const STATUS_NEXT: Record<string, string> = { pending: 'paid', paid: 'completed' }
const STATUS_ACTION: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Mark Paid',  color: '#f59e0b', bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.24)' },
  paid:    { label: 'Complete',   color: '#34d399', bg: 'rgba(52,211,153,0.09)',  border: 'rgba(52,211,153,0.24)' },
}

// ── Page ──────────────────────────────────────────────────────────────────────
function OrdersPageContent() {
  const [orders, setOrders]                   = useState<OrderWithDetails[]>([])
  const [hasMore, setHasMore]                 = useState(false)
  const [loadingMore, setLoadingMore]         = useState(false)
  const [gamepasses, setGamepasses]           = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]               = useState<RobloxAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [statusChanging, setStatusChanging]   = useState<string | null>(null)
  const [editOrder, setEditOrder]             = useState<OrderWithDetails | null>(null)
  const [inspectOrder, setInspectOrder]       = useState<OrderWithDetails | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [justCreated, setJustCreated]         = useState(false)
  const [workspaceOpen, setWorkspaceOpen]     = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()

  const cart = useOrderCart(gamepasses)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      buyer_name: '', buyer_roblox_username: '',
      roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '',
    },
  })

  const accountId  = watch('roblox_account_id')
  const isEditMode = editOrder !== null

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId) ?? null,
    [accountId, accounts]
  )
  const accountRate = selectedAccount?.robux_cost_rate ?? 0
  const isAccountPlus = selectedAccount?.is_plus_account ?? false

  const totals = useMemo(
    () => calculateOrderTotals(cart.items, accountRate, isAccountPlus),
    [cart.items, accountRate, isAccountPlus]
  )

  // ── Populate form when editing ──────────────────────────────────────────────
  useEffect(() => {
    if (editOrder) {
      reset({
        buyer_name:            editOrder.buyer_name ?? '',
        buyer_roblox_username: editOrder.buyer_roblox_username ?? '',
        roblox_account_id:     editOrder.roblox_account_id ?? '',
        payment_method:        editOrder.payment_method,
        status:                (editOrder.status === 'delivering' ? 'paid' : editOrder.status) as OrderFormData['status'],
        notes:                 editOrder.notes ?? '',
      })
      const oi = editOrder.order_items
      if (oi && oi.length > 0) {
        cart.setItems(oi.map(item => ({
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
        cart.setItems([{
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
      cart.setItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrder, reset])

  function cancelEdit() { setEditOrder(null) }

  function openCreateWorkspace() { setEditOrder(null); setWorkspaceOpen(true) }
  function openEditWorkspace(order: OrderWithDetails) { setEditOrder(order); setWorkspaceOpen(true) }
  function closeWorkspace() { setWorkspaceOpen(false); setEditOrder(null) }

  // ── Global "New Order" command lands here with ?create=1 ───────────────────
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateWorkspace()
      router.replace('/orders')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Workspace modal: escape-to-close + scroll lock ──────────────────────────
  useEffect(() => {
    if (!workspaceOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWorkspace() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [workspaceOpen])

  // ── Data fetching ───────────────────────────────────────────────────────────
  // toast is intentionally not a dependency — useToast() returns a new object
  // every render (see Toast.tsx), and depending on it here would recreate
  // fetchData (and retrigger the mount effect below) every time any toast
  // fires anywhere in the app. The captured closure still calls the underlying
  // stable push/dismiss callbacks, so this stays correct regardless.
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ordRes, gpRes, accRes] = await Promise.all([
        supabase.from('orders')
          .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE + 1),
        supabase.from('gamepasses').select('*, games(*)').order('is_active', { ascending: false }).order('name'),
        supabase.from('roblox_accounts').select('*').eq('status', 'active'),
      ])

      if (ordRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load orders:', ordRes.error)
        toast.error(`Could not load orders: ${ordRes.error.message}`)
      } else if (ordRes.data) {
        setOrders(ordRes.data.slice(0, PAGE_SIZE) as OrderWithDetails[])
        setHasMore(ordRes.data.length > PAGE_SIZE)
      }

      if (gpRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load gamepasses:', gpRes.error)
        toast.error(`Could not load gamepasses: ${gpRes.error.message}`)
      } else if (gpRes.data) {
        setGamepasses(gpRes.data as GamepassWithGame[])
      }

      if (accRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load accounts:', accRes.error)
        toast.error(`Could not load accounts: ${accRes.error.message}`)
      } else if (accRes.data) {
        setAccounts(accRes.data)
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[orders] unexpected error loading page data:', err)
      toast.error('Could not load orders — check your connection and try again.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: OrderFormData) {
    if (cart.validItems.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const orderAccount = accounts.find(a => a.id === data.roblox_account_id)
    const rateUsed = orderAccount?.robux_cost_rate ?? 0
    const {
      totalRobux: tRobux, totalPrice: tPrice, totalCost: tCost, totalProfit: tProfit, effectiveRobux,
    } = calculateOrderTotals(cart.validItems, rateUsed, orderAccount?.is_plus_account ?? false)
    // effectiveRobux is a Plus-discounted float (e.g. 228 * 0.9 = 205.20000000000002) —
    // effective_robux_amount is an integer column, so this must be rounded before storage.
    const roundedEffectiveRobux = Math.round(effectiveRobux)
    const first = cart.validItems[0]
    const gpNames = cart.validItems.map(i => i.gamepass_name).filter(Boolean).join(', ')

    if (editOrder) {
      const prevStatus = editOrder.status
      const newStatus  = data.status

      const { error: updateError } = await supabase.from('orders').update({
        buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        account_rate_used: rateUsed || null,
        effective_robux_amount: tRobux > 0 ? roundedEffectiveRobux : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editOrder.id)
      if (updateError) {
        toast.error(`Could not update order: ${updateError.message}`)
        setSaving(false)
        return
      }
      await supabase.from('order_items').delete().eq('order_id', editOrder.id)
      if (cart.validItems.length > 0) {
        await supabase.from('order_items').insert(cart.validItems.map(item => ({
          order_id: editOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }

      if (['pending', 'paid'].includes(newStatus) && data.roblox_account_id && tRobux > 0) {
        await supabase.rpc('reserve_order_robux', {
          p_order_id:       editOrder.id,
          p_account_id:     data.roblox_account_id,
          p_robux_amount:   roundedEffectiveRobux,
          p_gamepass_names: gpNames,
        })
      }

      if (newStatus !== prevStatus) {
        const { error } = await supabase.rpc('transition_order', { p_order_id: editOrder.id, p_new_status: newStatus })
        if (error) toast.error(`Could not update order status: ${error.message}`)
      }

      setEditOrder(null)
      setWorkspaceOpen(false)
      toast.success('Order updated.')
    } else {
      const { data: newOrder, error: insertError } = await supabase.from('orders').insert({
        user_id: user.id, buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: 'pending', notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        account_rate_used: rateUsed || null,
        effective_robux_amount: tRobux > 0 ? roundedEffectiveRobux : null,
      }).select().single()
      if (insertError || !newOrder) {
        toast.error(`Could not create order: ${insertError?.message ?? 'unknown error'}`)
        setSaving(false)
        return
      }
      if (cart.validItems.length > 0) {
        await supabase.from('order_items').insert(cart.validItems.map(item => ({
          order_id: newOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (data.roblox_account_id && tRobux > 0) {
        await supabase.rpc('reserve_order_robux', {
          p_order_id:       newOrder.id,
          p_account_id:     data.roblox_account_id,
          p_robux_amount:   roundedEffectiveRobux,
          p_gamepass_names: gpNames,
        })
      }
      if (data.status !== 'pending') {
        await supabase.rpc('transition_order', { p_order_id: newOrder.id, p_new_status: data.status })
      }
      setJustCreated(true)
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      cart.setItems([])
      // Workspace stays open — an operator creating many orders back-to-back
      // should never have to reopen it between submissions.
      setTimeout(() => setJustCreated(false), 1800)
      toast.success('Order created.')
    }

    setSaving(false)
    fetchData()
  }

  // ── Status / delete ─────────────────────────────────────────────────────────
  async function handleStatusChange(order: OrderWithDetails, newStatus: string) {
    if (order.status === newStatus || statusChanging === order.id) return
    setStatusChanging(order.id)
    const { error } = await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: newStatus })
    if (error) toast.error(`Could not update order status: ${error.message}`)
    else toast.success(`Order marked ${newStatus}.`)
    setStatusChanging(null)
    fetchData()
  }

  async function handleDelete(order: OrderWithDetails) {
    const ok = await confirm({
      title: `Delete order ${order.order_number ?? ''}?`,
      description: 'This permanently removes the order. Any reserved Robux tied to it will be released.',
      confirmLabel: 'Delete Order',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.rpc('delete_order', { p_order_id: order.id })
    if (error) toast.error(`Could not delete order: ${error.message}`)
    else toast.success('Order deleted.')
    fetchData()
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const orderStats = useMemo(() => {
    const active = orders.filter(isActiveOrder)
    const pendingRevenue = active.reduce((sum, o) => sum + (o.selling_price ?? 0), 0)
    const completed = orders.filter(o => o.status === 'completed')
    const totalProfit = completed.reduce((sum, o) => sum + (o.profit ?? 0), 0)
    const withOutcome = completed.length + orders.filter(o => o.status === 'refunded').length
    return {
      activeOrders:    active.length,
      pendingRevenue,
      totalProfit,
      fulfillmentRate: withOutcome > 0 ? (completed.length / withOutcome) * 100 : 100,
    }
  }, [orders])

  const activeOrdersSorted = useMemo(() =>
    orders
      .filter(isActiveOrder)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════════
          § 01 · ORDER OPERATIONS — headline + Create Order / Statistics
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden px-6 sm:px-8"
        style={{ paddingTop: '5rem', paddingBottom: '5rem', minHeight: 'calc(60svh)' }}
      >
        <Blob color="rgba(34,211,238,0.12)" width={700} height={700} style={{ top: -300, left: -200 }} />
        <Blob color="rgba(139,92,246,0.07)" width={500} height={500} style={{ bottom: -200, right: -150 }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="01" label="Order Operations" />

          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            {loading ? (
              <h1
                className="font-black leading-tight"
                style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', color: 'rgba(255,255,255,0.30)' }}
              >
                Order Workspace
              </h1>
            ) : orderStats.activeOrders > 0 ? (
              <h1 className="font-black leading-[1.05]" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
                <span style={{ color: '#22d3ee' }}>{orderStats.activeOrders}</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {' '}active order{orderStats.activeOrders !== 1 ? 's' : ''}
                </span>
                <br />
                <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: '40%', fontWeight: 500, letterSpacing: '0.01em' }}>
                  in the fulfillment pipeline
                </span>
              </h1>
            ) : (
              <h1 className="font-black leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
                <span style={{ color: '#34d399' }}>All clear</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}> — inbox zero</span>
              </h1>
            )}
          </motion.div>

          {/* Create Order entry point + Order Statistics — two distinct workspaces */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-stretch"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* ── Create Order — dedicated launcher, not a floating action ── */}
            <motion.button
              type="button"
              variants={staggerItem}
              onClick={openCreateWorkspace}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              className="rounded-2xl p-7 flex flex-col items-start text-left gap-4 group"
              style={{
                background: 'linear-gradient(155deg, rgba(34,211,238,0.12), rgba(56,189,248,0.03) 60%)',
                border: '1px solid rgba(34,211,238,0.24)',
                boxShadow: '0 0 0 1px rgba(34,211,238,0.04), 0 8px 24px rgba(0,0,0,0.30)',
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #22d3ee, #38bdf8)', boxShadow: '0 0 24px rgba(34,211,238,0.35)' }}
              >
                <Plus style={{ width: 22, height: 22, color: 'oklch(0.040 0.008 265)' }} />
              </div>
              <div>
                <p className="text-[19px] font-black mb-1.5" style={{ color: 'rgba(255,255,255,0.92)' }}>Create Order</p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Open a dedicated workspace — select gamepasses, set the buyer, and submit.
                </p>
              </div>
              <span
                className="mt-auto flex items-center gap-1.5 text-[12px] font-bold transition-transform"
                style={{ color: '#22d3ee' }}
              >
                Start workspace
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </motion.button>

            {/* ── Order Statistics — read-only metrics, kept visually separate ── */}
            <motion.div
              variants={staggerItem}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.026)', border: '1px solid rgba(255,255,255,0.060)' }}
            >
              <p className="label-caps mb-4">Order Statistics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  {
                    label: 'Active Orders',
                    value: orderStats.activeOrders,
                    format: (v: number) => `${Math.round(v)}`,
                    color: '#22d3ee',
                    icon: ClipboardList,
                  },
                  {
                    label: 'Pending Revenue',
                    value: orderStats.pendingRevenue,
                    format: (v: number) => formatPHP(v),
                    color: '#f59e0b',
                    icon: Wallet,
                  },
                  {
                    label: 'Profit Generated',
                    value: orderStats.totalProfit,
                    format: (v: number) => formatPHP(v),
                    color: '#34d399',
                    icon: TrendingUp,
                  },
                  {
                    label: 'Fulfillment Rate',
                    value: orderStats.fulfillmentRate,
                    format: (v: number) => `${Math.round(v)}%`,
                    color: '#a78bfa',
                    icon: CheckCircle2,
                  },
                ] as const).map(({ label, value, format, color, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.026)', border: `1px solid ${color}20` }}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                      >
                        <Icon style={{ width: 12, height: 12, color }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>
                        {label}
                      </span>
                    </div>
                    <CountUp
                      value={loading ? 0 : value}
                      format={format}
                      duration={1.6}
                      className="text-[22px] font-black tabular-nums block leading-none"
                      style={{ color }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          § 02 · ACTION CENTER — managing active orders
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden px-6 sm:px-8"
        style={{ paddingTop: '6rem', paddingBottom: '6rem' }}
      >
        <Blob color="rgba(245,158,11,0.07)" width={600} height={600} style={{ top: -80, right: -200 }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="02" label="Action Center" />

          <motion.div
            className="mb-10 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeOrdersSorted.length > 0 ? (
              <>
                <h2 className="font-black leading-tight mb-2" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}>
                  <span style={{ color: '#f59e0b' }}>{activeOrdersSorted.length}</span>
                  <span style={{ color: 'rgba(255,255,255,0.88)' }}> order{activeOrdersSorted.length !== 1 ? 's' : ''} need action</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  Oldest first — most urgent at the top.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-black leading-tight mb-2" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}>
                  <span style={{ color: '#34d399' }}>Queue empty</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  No active orders right now. Create one below.
                </p>
              </>
            )}
          </motion.div>

          {activeOrdersSorted.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="rounded-2xl p-10 text-center"
              style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)' }}
            >
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3" style={{ color: '#34d399', opacity: 0.5 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No active orders — inbox zero.</p>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
            >
              {activeOrdersSorted.map((order) => {
                const ageHours  = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000
                const ageColor  = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'rgba(255,255,255,0.35)'
                const isStale   = ageHours > 48
                const action    = STATUS_ACTION[order.status]
                const nextStatus = STATUS_NEXT[order.status]
                const isBusy    = statusChanging === order.id

                return (
                  <motion.div
                    key={order.id}
                    variants={staggerItem}
                    onClick={() => setInspectOrder(order)}
                    className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
                    style={{
                      background: isStale ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.032)',
                      border: `1px solid ${isStale ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.065)'}`,
                    }}
                  >
                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
                          {order.order_number ?? '—'}
                        </span>
                        <StatusBadge status={order.status} />
                        {isStale && (
                          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#f43f5e' }}>
                            <AlertCircle style={{ width: 10, height: 10 }} />
                            Stale
                          </span>
                        )}
                        <span className="text-[10px] font-semibold ml-auto sm:ml-0" style={{ color: ageColor }}>
                          {ageHours < 48 ? `${Math.round(ageHours)}h ago` : `${Math.round(ageHours / 24)}d ago`}
                        </span>
                      </div>
                      <p className="text-[14px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {order.buyer_name ?? '—'}
                      </p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {order.gamepasses?.games?.name ?? order.gamepasses?.name ?? '—'}
                        {order.robux_amount ? ` · ${order.robux_amount.toLocaleString()} R$` : ''}
                      </p>
                    </div>

                    {/* Price + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-[15px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {order.selling_price ? formatPHP(order.selling_price) : '—'}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditWorkspace(order) }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}
                      >
                        <Edit2 style={{ width: 12, height: 12 }} />
                      </button>
                      {action && nextStatus && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(order, nextStatus) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-opacity"
                          style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}` }}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isBusy ? '…' : action.label}
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={isBusy}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}
                        >
                          <MoreHorizontal style={{ width: 14, height: 14 }} />
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
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {activeOrdersSorted.length > 0 && (
            <div className="mt-6 flex justify-end">
              <a
                href="#order-history"
                onClick={(e) => { e.preventDefault(); document.getElementById('order-history')?.scrollIntoView({ behavior: 'smooth' }) }}
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                View full history <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          § 03 · ORDER HISTORY — viewing past orders
      ══════════════════════════════════════════════════════════════ */}
      <section
        id="order-history"
        className="relative overflow-hidden px-6 sm:px-8"
        style={{ paddingTop: '6rem', paddingBottom: '8rem' }}
      >
        <Blob color="rgba(34,211,238,0.06)" width={500} height={500} style={{ bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="03" label="Order History" />

          <motion.div
            className="mb-10 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-black leading-tight mb-2" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', color: 'rgba(255,255,255,0.88)' }}>
              {orders.length > 0
                ? <><span style={{ color: '#a78bfa' }}>{orders.length}</span>{' '}order{orders.length !== 1 ? 's' : ''} on record</>
                : 'Order History'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
              Full pipeline view — advance status, edit, or manage from here.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <OrderActivityPanel
              orders={orders}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              historyExpanded={historyExpanded}
              onToggleHistory={() => setHistoryExpanded(p => !p)}
              onEdit={openEditWorkspace}
              onInspect={setInspectOrder}
              onDelete={handleDelete}
              onLoadMore={loadMore}
            />
          </motion.div>
        </div>
      </section>

      <OrderInspectDialog
        order={inspectOrder}
        onClose={() => setInspectOrder(null)}
        onEdit={(order) => { setInspectOrder(null); openEditWorkspace(order) }}
      />

      {/* ══════════════════════════════════════════════════════════════
          CREATE ORDER WORKSPACE — full-screen modal, deliberately
          separated from the operational sections above
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {workspaceOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto pt-20 pb-6 sm:pt-24 sm:pb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div
              className="absolute inset-0 glass-modal-overlay"
              onClick={closeWorkspace}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />

            <motion.div
              className="relative w-full sm:max-w-[880px] sm:px-4"
              style={{ minHeight: 'calc(100svh - 6.5rem)' }}
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.985 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={closeWorkspace}
                aria-label="Close workspace"
                className="absolute top-4 right-4 sm:-right-2 sm:top-0 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.55)' }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>

              <div
                className="overflow-y-auto"
                style={{ maxHeight: 'calc(100svh - 6.5rem)' }}
              >
                <div className="sm:my-10">
                  <OrderForm
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    onFormSubmit={handleSubmit(onSubmit, (formErrors) => {
                      const firstMessage = Object.values(formErrors)[0]?.message
                      toast.error(typeof firstMessage === 'string' ? firstMessage : 'Please fix the highlighted fields before submitting.')
                    })}
                    isEditMode={isEditMode}
                    editOrder={editOrder}
                    onCancelEdit={cancelEdit}
                    gamepasses={gamepasses}
                    accounts={accounts}
                    cartGroups={cart.cartGroups}
                    cartCounts={cart.cartCounts}
                    validItemsCount={cart.validItems.length}
                    onAddToCart={cart.addToCart}
                    onRemoveFromCart={cart.removeFromCart}
                    onClearCart={cart.clearCart}
                    totals={totals}
                    accountRate={accountRate}
                    saving={saving}
                    justCreated={justCreated}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

// useSearchParams() (for ?create=1 auto-opening the workspace) requires a
// Suspense boundary or the build's prerender pass fails even on a
// force-dynamic page.
export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  )
}
