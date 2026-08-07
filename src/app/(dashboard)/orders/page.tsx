'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { OrderFormData, GamepassWithGame } from '@/components/orders/OrderForm'
import WorkspaceTabs from '@/components/orders/WorkspaceTabs'
import WorkspaceEditor from '@/components/orders/WorkspaceEditor'
import OrderActivityPanel from '@/components/orders/OrderActivityPanel'
import OrderInspectDialog from '@/components/orders/OrderInspectDialog'
import FulfillmentMode from '@/components/orders/FulfillmentMode'
import BWAccountAssignDialog from '@/components/orders/BWAccountAssignDialog'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { RobloxAccount, OrderWithDetails, LineItem } from '@/lib/types/database'
import type { LogicalOrder } from '@/lib/types/logical-order'
import { createClient } from '@/lib/supabase/client'
import { calculateOrderTotals, formatPHP } from '@/lib/utils/pricing'
import { isActiveLogicalOrder } from '@/lib/utils/orders'
import { normalizeOrders, RAW_FETCH_CAP } from '@/lib/utils/normalize-orders'
import { getGameNameStyle } from '@/lib/utils/games'
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
  Loader2, Edit2, ArrowUpRight, AlertCircle, X, MoreHorizontal, Trash2, Zap,
} from 'lucide-react'
import type { CSSProperties } from 'react'

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
  const [rawOrders, setRawOrders]             = useState<OrderWithDetails[]>([])
  const [isRawCapped, setIsRawCapped]         = useState(false)
  const [gamepasses, setGamepasses]           = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]               = useState<RobloxAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [statusChanging, setStatusChanging]   = useState<string | null>(null)
  const [inspectOrder, setInspectOrder]       = useState<LogicalOrder | null>(null)
  const [fulfillOrder, setFulfillOrder]       = useState<LogicalOrder | null>(null)
  const [bwAssignOrder, setBwAssignOrder]     = useState<LogicalOrder | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const ws = useWorkspaces()

  // Stable refs for submit callback — avoids stale closures without adding
  // large arrays to useCallback dependency lists.
  const workspacesRef  = useRef(ws.workspaces)
  const rawOrdersRef   = useRef(rawOrders)
  const accountsRef    = useRef(accounts)
  useEffect(() => { workspacesRef.current = ws.workspaces }, [ws.workspaces])
  useEffect(() => { rawOrdersRef.current = rawOrders }, [rawOrders])
  useEffect(() => { accountsRef.current = accounts }, [accounts])

  // ── Normalization ────────────────────────────────────────────────────────────
  const logicalOrders = useMemo(() => normalizeOrders(rawOrders), [rawOrders])
  const rawOrdersMap  = useMemo(() => new Map(rawOrders.map(o => [o.id, o])), [rawOrders])

  // ── ?create=1 URL param — GlobalOrderCommand lands here ───────────────────
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      ws.openOrCreate()
      router.replace('/orders')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Keyboard shortcuts + scroll lock when overlay is open ─────────────────
  useEffect(() => {
    if (!ws.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') ws.closeOverlay()
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        ws.addWorkspace()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.open])

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ordRes, gpRes, accRes] = await Promise.all([
        supabase.from('orders')
          .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(RAW_FETCH_CAP),
        supabase.from('gamepasses').select('*, games(*)').order('is_active', { ascending: false }).order('name'),
        supabase.from('roblox_accounts').select('*').eq('status', 'active'),
      ])

      if (ordRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load orders:', ordRes.error)
        toast.error(`Could not load orders: ${ordRes.error.message}`)
      } else if (ordRes.data) {
        let rows = ordRes.data as OrderWithDetails[]
        const isCapped = rows.length >= RAW_FETCH_CAP

        // Boundary completion: when we hit the cap, any order_number that appears
        // in the last MAX_BW_CART rows might have siblings beyond the cap. Fetch
        // ALL rows sharing those order_numbers to avoid split logical groups.
        if (isCapped && rows.length > 0) {
          const MAX_BW_CART = 20
          const boundaryNums = new Set(
            rows.slice(-MAX_BW_CART)
              .map(r => r.order_number?.trim())
              .filter((n): n is string => !!n),
          )
          if (boundaryNums.size > 0) {
            const { data: siblings } = await supabase
              .from('orders')
              .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
              .in('order_number', Array.from(boundaryNums))
            if (siblings && siblings.length > 0) {
              const existingIds = new Set(rows.map(r => r.id))
              const extra = (siblings as OrderWithDetails[]).filter(s => !existingIds.has(s.id))
              if (extra.length > 0) rows = [...rows, ...extra]
            }
          }
        }

        setRawOrders(rows)
        setIsRawCapped(isCapped)
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

  // ── Multi-workspace submit — called by WorkspaceEditor on form submit ───────
  const handleWorkspaceSubmit = useCallback(async (
    workspaceId: string,
    data: OrderFormData,
    cartItems: LineItem[],
  ) => {
    const workspace = workspacesRef.current.find(w => w.id === workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const validItems = cartItems.filter(i => i.gamepass_id)
    if (validItems.length === 0) throw new Error('Cart is empty')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const orderAccount = accountsRef.current.find(a => a.id === data.roblox_account_id)
    const rateUsed = orderAccount?.robux_cost_rate ?? 0
    const {
      totalRobux: tRobux, totalPrice: tPrice, totalCost: tCost, totalProfit: tProfit, effectiveRobux,
    } = calculateOrderTotals(validItems, rateUsed, orderAccount?.is_plus_account ?? false)
    const roundedEffectiveRobux = Math.round(effectiveRobux)
    const first = validItems[0]
    const gpNames = validItems.map(i => i.gamepass_name).filter(Boolean).join(', ')

    if (workspace.editOrderId) {
      const editOrder = rawOrdersRef.current.find(o => o.id === workspace.editOrderId)
      const prevStatus = editOrder?.status
      const newStatus  = data.status

      const { error: updateError } = await supabase.from('orders').update({
        buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        account_rate_used: rateUsed || null,
        effective_robux_amount: tRobux > 0 ? roundedEffectiveRobux : null,
        updated_at: new Date().toISOString(),
      }).eq('id', workspace.editOrderId)
      if (updateError) throw new Error(`Could not update order: ${updateError.message}`)

      await supabase.from('order_items').delete().eq('order_id', workspace.editOrderId)
      if (validItems.length > 0) {
        await supabase.from('order_items').insert(validItems.map(item => ({
          order_id: workspace.editOrderId, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      if (['pending', 'paid'].includes(newStatus ?? '') && data.roblox_account_id && tRobux > 0) {
        await supabase.rpc('reserve_order_robux', {
          p_order_id:       workspace.editOrderId,
          p_account_id:     data.roblox_account_id,
          p_robux_amount:   roundedEffectiveRobux,
          p_gamepass_names: gpNames,
        })
      }
      if (newStatus !== prevStatus) {
        const { error } = await supabase.rpc('transition_order', { p_order_id: workspace.editOrderId, p_new_status: newStatus })
        if (error) toast.error(`Could not update order status: ${error.message}`)
      }

      ws.closeWorkspace(workspaceId)
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
      if (insertError || !newOrder) throw new Error(`Could not create order: ${insertError?.message ?? 'unknown error'}`)

      if (validItems.length > 0) {
        await supabase.from('order_items').insert(validItems.map(item => ({
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
      toast.success('Order created.')
      // WorkspaceEditor handles form reset + justCreated — workspace stays open
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fetchData, ws.closeWorkspace])

  // ── Close a workspace tab (with discard confirmation if it has content) ─────
  async function handleCloseTab(id: string) {
    const workspace = ws.workspaces.find(w => w.id === id)
    if (!workspace) return
    const isEmpty =
      !workspace.formValues.buyer_name?.trim() &&
      !workspace.formValues.buyer_roblox_username?.trim() &&
      workspace.items.length === 0 &&
      !workspace.formValues.notes?.trim()
    if (isEmpty) { ws.closeWorkspace(id); return }
    const ok = await confirm({
      title: 'Discard draft?',
      description: workspace.formValues.buyer_name
        ? `"${workspace.formValues.buyer_name}" and all its items will be lost.`
        : 'This workspace has unsaved work.',
      confirmLabel: 'Discard',
      danger: true,
    })
    if (ok) ws.closeWorkspace(id)
  }

  // ── Status / delete ─────────────────────────────────────────────────────────
  //
  // transition_order has financial side effects for EVERY orders row, including
  // BudgetWise rows where roblox_account_id IS NULL:
  //   any → completed    : wallet_transactions income + allocate_order_savings
  //   completed → any    : wallet_transactions reversal + reverse_order_savings
  //   pending/paid → cancelled/refunded: release reservation (no-op for BW)
  //
  // A direct .update().in() only writes the status column — it silently skips
  // wallet and savings effects, breaking accounting for completed BW orders.
  // Until a grouped RPC exists, we fire one RPC per underlying row in parallel.

  async function handleStatusChange(lo: LogicalOrder, newStatus: string) {
    if ((!lo.hasMixedStatus && lo.status === newStatus) || statusChanging === lo.logicalKey) return
    setStatusChanging(lo.logicalKey)

    const results = await Promise.all(
      lo.underlyingOrderIds.map(id =>
        supabase.rpc('transition_order', { p_order_id: id, p_new_status: newStatus }),
      ),
    )
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      const succeeded = results.length - failed.length
      toast.error(
        succeeded === 0
          ? `Could not update order status: ${failed[0].error!.message}`
          : `Expected ${results.length} order rows, but only ${succeeded} matching rows were updated. ${failed[0].error!.message}`,
      )
    } else {
      toast.success(`Order marked ${newStatus}.`)
    }
    setStatusChanging(null)
    fetchData()
  }

  async function handleFulfillmentComplete(lo: LogicalOrder) {
    await handleStatusChange(lo, 'completed')
  }

  async function handleDelete(lo: LogicalOrder) {
    const ok = await confirm({
      title: `Delete order ${lo.orderNumber ?? ''}?`,
      description: 'This permanently removes the order. Any reserved Robux tied to it will be released.',
      confirmLabel: 'Delete Order',
      danger: true,
    })
    if (!ok) return

    // delete_order cleans wallet_transactions, savings allocations, and
    // reservations for each row — a direct .delete() would leave those as orphans
    // for any BW rows that were previously marked completed.
    const results = await Promise.all(
      lo.underlyingOrderIds.map(id =>
        supabase.rpc('delete_order', { p_order_id: id }),
      ),
    )
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      const succeeded = results.length - failed.length
      toast.error(
        succeeded === 0
          ? `Could not delete order: ${failed[0].error!.message}`
          : `Expected ${results.length} order rows, but only ${succeeded} matching rows were removed. Check order history for remaining rows.`,
      )
    } else {
      toast.success('Order deleted.')
    }
    fetchData()
  }

  // ── Edit helper — routes BW orders to account assignment, XOB to workspace ───
  function openEditWorkspace(lo: LogicalOrder) {
    if (lo.source === 'budgetwise') {
      setBwAssignOrder(lo)
      return
    }
    const raw = rawOrdersMap.get(lo.primaryOrderId)
    if (raw) ws.openOrCreate(raw)
  }

  // ── BW account assignment save ────────────────────────────────────────────────
  async function handleBWAssignSave(assignments: Record<string, string | null>) {
    const results = await Promise.all(
      Object.entries(assignments).map(([orderId, accountId]) =>
        supabase.from('orders').update({ roblox_account_id: accountId }).eq('id', orderId),
      ),
    )
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      toast.error(`Could not save account assignments: ${failed[0].error!.message}`)
    } else {
      toast.success('Account assignments saved.')
    }
    setBwAssignOrder(null)
    fetchData()
  }

  // ── Game activity map ────────────────────────────────────────────────────────
  const gameActivity = useMemo(() => {
    const gamepassToGame = new Map(gamepasses.map(gp => [gp.id, gp.game_id]))
    const map = new Map<string, Date>()
    logicalOrders.forEach(lo => {
      if (lo.status !== 'completed') return
      const at = new Date(lo.createdAt)
      lo.items.forEach(item => {
        const gameId = item.gamepassId ? gamepassToGame.get(item.gamepassId) : null
        if (!gameId) return
        const existing = map.get(gameId)
        if (!existing || at > existing) map.set(gameId, at)
      })
    })
    return map
  }, [logicalOrders, gamepasses])

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const orderStats = useMemo(() => {
    const active = logicalOrders.filter(isActiveLogicalOrder)
    const pendingRevenue = active.reduce((sum, lo) => sum + lo.totalSellingPrice, 0)
    const completed = logicalOrders.filter(lo => lo.status === 'completed')
    const totalProfit = completed.reduce((sum, lo) => sum + lo.totalProfit, 0)
    const withOutcome = completed.length + logicalOrders.filter(lo => lo.status === 'refunded').length
    return {
      activeOrders:    active.length,
      pendingRevenue,
      totalProfit,
      fulfillmentRate: withOutcome > 0 ? (completed.length / withOutcome) * 100 : 100,
    }
  }, [logicalOrders])

  const activeOrdersSorted = useMemo(() =>
    logicalOrders
      .filter(isActiveLogicalOrder)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [logicalOrders]
  )

  // Button label — reflects whether there are saved workspaces to return to
  const wsButtonLabel = ws.workspaces.length > 0
    ? `Resume Workspace${ws.workspaces.length > 1 ? ` (${ws.workspaces.length})` : ''}`
    : 'Create Order'

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

          {/* Create Order entry point + Order Statistics */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-stretch"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* ── Open Workspace launcher ── */}
            <motion.button
              type="button"
              variants={staggerItem}
              onClick={() => ws.openOrCreate()}
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
                <p className="text-[19px] font-black mb-1.5" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  {wsButtonLabel}
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  {ws.workspaces.length > 0
                    ? `${ws.workspaces.length} workspace${ws.workspaces.length > 1 ? 's' : ''} waiting — switch tabs with Ctrl+N`
                    : 'Open a dedicated workspace — select gamepasses, set the buyer, and submit.'}
                </p>
              </div>
              <span
                className="mt-auto flex items-center gap-1.5 text-[12px] font-bold transition-transform"
                style={{ color: '#22d3ee' }}
              >
                {ws.workspaces.length > 0 ? 'Open workspace' : 'Start workspace'}
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </motion.button>

            {/* ── Order Statistics ── */}
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
              {activeOrdersSorted.map((lo) => {
                const ageHours   = (Date.now() - new Date(lo.createdAt).getTime()) / 3_600_000
                const ageColor   = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'rgba(255,255,255,0.35)'
                const isStale    = ageHours > 48
                const action     = lo.hasMixedStatus ? null : STATUS_ACTION[lo.status]
                const nextStatus = lo.hasMixedStatus ? null : STATUS_NEXT[lo.status]
                const isBusy     = statusChanging === lo.logicalKey
                const firstItem  = lo.items[0]

                return (
                  <motion.div
                    key={lo.logicalKey}
                    variants={staggerItem}
                    onClick={() => setInspectOrder(lo)}
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
                          {lo.orderNumber ?? '—'}
                        </span>
                        <StatusBadge status={lo.hasMixedStatus ? 'mixed' : lo.status} />
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
                        {lo.buyerName ?? '—'}
                      </p>
                      {lo.items.length > 1 ? (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.44)' }}>
                          {lo.items.length} items · {lo.totalRobux.toLocaleString()} R$
                        </p>
                      ) : (
                        <p className="text-[11px] mt-0.5 truncate">
                          <span style={getGameNameStyle(firstItem?.isDiscounted)}>
                            {firstItem?.gameName ?? firstItem?.gamepassName ?? '—'}
                          </span>
                          {lo.totalRobux > 0 && (
                            <span style={{ color: 'rgba(255,255,255,0.38)' }}> · {lo.totalRobux.toLocaleString()} R$</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Price + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-[15px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {lo.totalSellingPrice ? formatPHP(lo.totalSellingPrice) : '—'}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFulfillOrder(lo) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{ background: 'rgba(167,139,250,0.09)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.22)' }}
                      >
                        <Zap style={{ width: 11, height: 11 }} /> Fulfill
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditWorkspace(lo) }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}
                        title={lo.source === 'budgetwise' ? 'Assign Account' : 'Edit Order'}
                      >
                        <Edit2 style={{ width: 12, height: 12 }} />
                      </button>
                      {action && nextStatus && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(lo, nextStatus) }}
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
                          {lo.source === 'budgetwise' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => openEditWorkspace(lo)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Assign Account
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border/50" />
                            </>
                          )}
                          {lo.status !== 'refunded' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(lo, 'refunded')} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                              <X className="w-3.5 h-3.5" /> Mark Refunded
                            </DropdownMenuItem>
                          )}
                          {lo.status !== 'cancelled' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(lo, 'cancelled')} className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400">
                              <X className="w-3.5 h-3.5" /> Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-border/50" />
                          <DropdownMenuItem onClick={() => handleDelete(lo)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
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
              {logicalOrders.length > 0
                ? <><span style={{ color: '#a78bfa' }}>{logicalOrders.length}</span>{' '}order{logicalOrders.length !== 1 ? 's' : ''} on record</>
                : 'Order History'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
              Full pipeline view — advance status, edit, or manage from here.
            </p>
          </motion.div>

          {isRawCapped && (
            <div className="mb-4 px-4 py-2.5 rounded-xl text-[11px] font-semibold" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)', color: '#f59e0b' }}>
              Showing your most recent {RAW_FETCH_CAP} orders. Older orders are not displayed.
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <OrderActivityPanel
              orders={logicalOrders}
              loading={loading}
              historyExpanded={historyExpanded}
              onToggleHistory={() => setHistoryExpanded(p => !p)}
              onEdit={openEditWorkspace}
              onInspect={setInspectOrder}
              onDelete={handleDelete}
            />
          </motion.div>
        </div>
      </section>

      <OrderInspectDialog
        order={inspectOrder}
        onClose={() => setInspectOrder(null)}
        onEdit={(lo) => { setInspectOrder(null); openEditWorkspace(lo) }}
      />

      <AnimatePresence>
        {bwAssignOrder && (
          <BWAccountAssignDialog
            key={bwAssignOrder.logicalKey}
            order={bwAssignOrder}
            accounts={accounts}
            onClose={() => setBwAssignOrder(null)}
            onSave={handleBWAssignSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fulfillOrder && (
          <FulfillmentMode
            key={fulfillOrder.logicalKey}
            order={fulfillOrder}
            onClose={() => setFulfillOrder(null)}
            onComplete={() => handleFulfillmentComplete(fulfillOrder)}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MULTI-WORKSPACE OVERLAY — VS Code-style tabbed order drafts
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {ws.open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto pt-16 pb-4 sm:pt-16 sm:pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div
              className="absolute inset-0 glass-modal-overlay"
              onClick={ws.closeOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />

            <motion.div
              className="relative w-full sm:max-w-[960px] sm:px-6"
              style={{ minHeight: 'calc(100svh - 5rem)' }}
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.985 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={ws.closeOverlay}
                aria-label="Minimize workspace"
                className="absolute top-4 right-4 sm:right-2 sm:top-0 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.55)' }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>

              <div
                className="overflow-y-auto"
                style={{ maxHeight: 'calc(100svh - 5rem)' }}
              >
                <div className="sm:my-8">
                  <div className="glass-workspace overflow-hidden">
                    <WorkspaceTabs
                      workspaces={ws.workspaces}
                      activeId={ws.activeId}
                      accounts={accounts}
                      onSelect={ws.setActiveId}
                      onClose={handleCloseTab}
                      onNew={ws.addWorkspace}
                    />

                    <AnimatePresence mode="wait">
                      {ws.activeWorkspace && (
                        <motion.div
                          key={ws.activeWorkspace.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.10 }}
                        >
                          <WorkspaceEditor
                            workspace={ws.activeWorkspace}
                            editOrder={
                              ws.activeWorkspace.editOrderId
                                ? rawOrdersMap.get(ws.activeWorkspace!.editOrderId) ?? null
                                : null
                            }
                            gamepasses={gamepasses}
                            accounts={accounts}
                            gameActivity={gameActivity}
                            onUpdate={ws.updateWorkspace}
                            onSubmit={handleWorkspaceSubmit}
                            onClose={() => ws.closeWorkspace(ws.activeWorkspace!.id)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
