'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { OrderFormData, GamepassWithGame } from '@/components/orders/OrderForm'
import WorkspaceTabs from '@/components/orders/WorkspaceTabs'
import WorkspaceEditor from '@/components/orders/WorkspaceEditor'
import OrderActivityPanel from '@/components/orders/OrderActivityPanel'
import OrderInspectDialog from '@/components/orders/OrderInspectDialog'
import BWAccountAssignDialog, { type AssignmentItemResult } from '@/components/orders/BWAccountAssignDialog'
import FinalizeOrdersDialog, {
  type FinalizeCandidate, type FinalizeProgressRow,
} from '@/components/orders/FinalizeOrdersDialog'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { RobloxAccount, OrderWithDetails, LineItem } from '@/lib/types/database'
import type { LogicalOrder, LogicalOrderItem } from '@/lib/types/logical-order'
import { createClient } from '@/lib/supabase/client'
import { calculateOrderTotals, formatPHP, formatPHPCompact, formatRobux } from '@/lib/utils/pricing'
import { isActiveLogicalOrder } from '@/lib/utils/orders'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { normalizeOrders, RAW_FETCH_CAP } from '@/lib/utils/normalize-orders'
import { getGameNameStyle } from '@/lib/utils/games'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { staggerContainer, staggerItem, fastStagger, fastStaggerItem } from '@/lib/motion'
import CountUp from '@/components/shared/CountUp'
import StatusBadge from '@/components/shared/StatusBadge'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, ClipboardList, Wallet, TrendingUp, CheckCircle2,
  Loader2, Edit2, ArrowUpRight, AlertCircle, X, MoreHorizontal, Trash2,
  Search, UserCheck,
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
function formatOrderAge(ageHours: number): string {
  const ageMinutes = Math.max(0, Math.round(ageHours * 60))
  if (ageMinutes < 1) return 'Just now'
  if (ageMinutes < 60) return `${ageMinutes}m ago`
  return `${Math.max(1, Math.round(ageMinutes / 60))}h ago`
}

function AccountStatusMini({ status }: { status: RobloxAccount['status'] }) {
  const color = status === 'active'
    ? '#22d3ee'
    : status === 'low'
      ? '#f59e0b'
      : status === 'banned'
        ? '#f43f5e'
        : 'rgba(255,255,255,0.46)'
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold capitalize" style={{ color: 'rgba(255,255,255,0.54)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />
      {status}
    </span>
  )
}

function isLogicalOrderUnassigned(lo: LogicalOrder): boolean {
  if (lo.source === 'budgetwise') return lo.items.some(i => i.robloxAccountId === null)
  return lo.robloxAccountId === null
}

function isLogicalOrderReady(lo: LogicalOrder): boolean {
  if (lo.hasMixedStatus || lo.status !== 'paid') return false
  if (lo.source === 'budgetwise') return lo.items.every(i => i.robloxAccountId !== null)
  return lo.robloxAccountId !== null
}

function getCompletionBlocker(lo: LogicalOrder): string {
  if (lo.hasMixedStatus) return 'Resolve mixed item statuses before completing this order.'
  if (lo.status !== 'paid') return lo.status === 'pending'
    ? 'Mark this order paid before completing it.'
    : 'This order is not in a completable status.'
  if (lo.source === 'budgetwise' && lo.items.some(i => i.robloxAccountId === null)) {
    return 'Assign every item before completing this order.'
  }
  if (lo.source !== 'budgetwise' && lo.robloxAccountId === null) {
    return 'Assign an account before completing this order.'
  }
  return 'This order is not ready to complete.'
}

// classify_for_finalize walks the same status/account rules as isLogicalOrderReady
// but also covers orders sitting in 'pending' (not just 'paid'), since Finalize
// Selected is allowed to catch up pending → paid → completed in one operation.
function classifyForFinalize(lo: LogicalOrder): FinalizeCandidate {
  if (lo.hasMixedStatus) {
    return { lo, kind: 'other_blocker', reason: 'Mixed item statuses — resolve individually.', steps: [] }
  }
  if (lo.status === 'completed') {
    return { lo, kind: 'already_completed', reason: 'Already completed.', steps: [] }
  }
  if (lo.status === 'cancelled' || lo.status === 'refunded') {
    return { lo, kind: 'invalid_status', reason: `Order is ${lo.status} — cannot finalize.`, steps: [] }
  }
  if (lo.status !== 'pending' && lo.status !== 'paid') {
    return { lo, kind: 'other_blocker', reason: `Order is ${lo.status} — finalize this one individually.`, steps: [] }
  }
  const missingAccount = lo.source === 'budgetwise'
    ? lo.items.some(item => item.robloxAccountId === null)
    : lo.robloxAccountId === null
  if (missingAccount) {
    return { lo, kind: 'needs_account', reason: 'Missing required account assignment.', steps: [] }
  }
  return { lo, kind: 'ready', reason: null, steps: lo.status === 'pending' ? ['paid', 'completed'] : ['completed'] }
}

function getQueuePriority(lo: LogicalOrder, nowMs: number): number {
  const isShop = lo.source === 'budgetwise'
  if (isShop && isLogicalOrderUnassigned(lo)) return 0
  if (isShop && isLogicalOrderReady(lo)) return 1
  if (isLogicalOrderUnassigned(lo)) return 2
  if (isLogicalOrderReady(lo)) return 3
  if ((nowMs - new Date(lo.createdAt).getTime()) / 3_600_000 > 48) return 4
  if (lo.status === 'pending' && !lo.hasMixedStatus) return 5
  return 6
}

function sortActiveOrdersForQueue(orders: LogicalOrder[], nowMs: number): LogicalOrder[] {
  return orders
    .filter(isActiveLogicalOrder)
    .sort((a, b) => {
      const ap = getQueuePriority(a, nowMs)
      const bp = getQueuePriority(b, nowMs)
      if (ap !== bp) return ap - bp
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

type StatusFailure = { id: string; message: string }
type StatusChangeResult = {
  ok: boolean
  succeeded: number
  failed: StatusFailure[]
  message?: string
}

type DeleteLogicalResult = {
  logicalKey: string
  orderNumber: string | null
  buyerName: string | null
  ok: boolean
  deletedRows: number
  totalRows: number
  error: string | null
}

function getDeleteOrderSummary(lo: LogicalOrder): string {
  const orderLabel = lo.orderNumber ?? lo.logicalKey
  const buyerLabel = lo.buyerName ?? lo.buyerRobloxUsername ?? 'Unknown customer'
  const itemLabel = `${lo.items.length} item${lo.items.length !== 1 ? 's' : ''}`
  return `${orderLabel}\n${buyerLabel}\n${itemLabel}`
}

function OrdersPageContent() {
  const [rawOrders, setRawOrders]             = useState<OrderWithDetails[]>([])
  const [isRawCapped, setIsRawCapped]         = useState(false)
  const [gamepasses, setGamepasses]           = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]               = useState<RobloxAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [statusChanging, setStatusChanging]   = useState<string | null>(null)
  const [inspectOrder, setInspectOrder]       = useState<LogicalOrder | null>(null)
  const [bwAssignOrder, setBwAssignOrder]     = useState<LogicalOrder | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [accountSearch, setAccountSearch]     = useState('')
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<Set<string>>(() => new Set())
  const [focusedOrderKey, setFocusedOrderKey] = useState<string | null>(null)
  const [centerMode, setCenterMode]           = useState<'shop' | 'manual'>('shop')
  const [batchAssigning, setBatchAssigning]   = useState(false)
  const [batchResults, setBatchResults]       = useState<AssignmentItemResult[] | null>(null)
  const [finalizeOpen, setFinalizeOpen]       = useState(false)
  const [finalizePhase, setFinalizePhase]     = useState<'preview' | 'processing' | 'done'>('preview')
  const [finalizeCandidates, setFinalizeCandidates] = useState<FinalizeCandidate[]>([])
  const [finalizeProgress, setFinalizeProgress]     = useState<FinalizeProgressRow[]>([])
  const [finalizing, setFinalizing]           = useState(false)
  const [deletingOrderKeys, setDeletingOrderKeys] = useState<Set<string>>(() => new Set())
  const [deleteResults, setDeleteResults]     = useState<DeleteLogicalResult[] | null>(null)
  const [accountDockOpen, setAccountDockOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'queue' | 'order' | 'accounts'>('queue')
  const [orderFeedback, setOrderFeedback]     = useState<Record<string, 'success' | 'error'>>({})
  const [nowMs] = useState<number>(Date.now)
  const lastQueueIndexRef = useRef<number | null>(null)
  const feedbackTimersRef = useRef<number[]>([])

  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const ws = useWorkspaces()
  const prefersReducedMotion = useReducedMotion()
  const quickMotion = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const }

  // Stable refs for submit callback — avoids stale closures without adding
  // large arrays to useCallback dependency lists.
  const workspacesRef  = useRef(ws.workspaces)
  const rawOrdersRef   = useRef(rawOrders)
  const accountsRef    = useRef(accounts)
  const fetchSeqRef    = useRef(0)
  const statusChangingRef = useRef<Set<string>>(new Set())
  useEffect(() => { workspacesRef.current = ws.workspaces }, [ws.workspaces])
  useEffect(() => { rawOrdersRef.current = rawOrders }, [rawOrders])
  useEffect(() => { accountsRef.current = accounts }, [accounts])
  useEffect(() => () => {
    feedbackTimersRef.current.forEach(timer => window.clearTimeout(timer))
  }, [])

  // ── Normalization ────────────────────────────────────────────────────────────
  const logicalOrders = useMemo(() => normalizeOrders(rawOrders), [rawOrders])
  const rawOrdersMap  = useMemo(() => new Map(rawOrders.map(o => [o.id, o])), [rawOrders])

  // ── ?create=1 URL param — GlobalOrderCommand lands here ───────────────────
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      const timer = window.setTimeout(() => {
        ws.openOrCreate()
        setCenterMode('manual')
        router.replace('/orders')
      }, 0)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Keyboard shortcuts for the inline manual workspace ────────────────────
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
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.open])

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async (): Promise<LogicalOrder[]> => {
    const requestId = ++fetchSeqRef.current
    setLoading(true)
    let nextLogicalOrders: LogicalOrder[] = []
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
        if (requestId === fetchSeqRef.current) toast.error(`Could not load orders: ${ordRes.error.message}`)
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

        if (requestId !== fetchSeqRef.current) return normalizeOrders(rawOrdersRef.current)
        setRawOrders(rows)
        setIsRawCapped(isCapped)
        nextLogicalOrders = normalizeOrders(rows)
      }

      if (gpRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load gamepasses:', gpRes.error)
        if (requestId === fetchSeqRef.current) toast.error(`Could not load gamepasses: ${gpRes.error.message}`)
      } else if (gpRes.data) {
        if (requestId === fetchSeqRef.current) setGamepasses(gpRes.data as GamepassWithGame[])
      }

      if (accRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('[orders] failed to load accounts:', accRes.error)
        if (requestId === fetchSeqRef.current) toast.error(`Could not load accounts: ${accRes.error.message}`)
      } else if (accRes.data) {
        if (requestId === fetchSeqRef.current) setAccounts(accRes.data)
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[orders] unexpected error loading page data:', err)
      if (requestId === fetchSeqRef.current) toast.error('Could not load orders — check your connection and try again.')
    } finally {
      if (requestId === fetchSeqRef.current) setLoading(false)
    }
    return requestId === fetchSeqRef.current ? nextLogicalOrders : normalizeOrders(rawOrdersRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData() }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchData])

  useEffect(() => {
    const channel = supabase
      .channel('xob-web-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roblox_accounts' }, () => { void fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'robux_reservations' }, () => { void fetchData() })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchData, supabase])

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
        if (newStatus === 'completed') {
          await supabase.rpc('claim_logical_order', { p_order_id: workspace.editOrderId })
        }
        const { error } = newStatus === 'completed'
          ? await supabase.rpc('complete_logical_order', { p_order_id: workspace.editOrderId })
          : await supabase.rpc('transition_order', { p_order_id: workspace.editOrderId, p_new_status: newStatus })
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
        if (data.status === 'completed') {
          await supabase.rpc('claim_logical_order', { p_order_id: newOrder.id })
          await supabase.rpc('complete_logical_order', { p_order_id: newOrder.id })
        } else {
          await supabase.rpc('transition_order', { p_order_id: newOrder.id, p_new_status: data.status })
        }
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

  async function handleStatusChange(
    lo: LogicalOrder,
    newStatus: string,
    options: { showToast?: boolean; refresh?: boolean } = {},
  ): Promise<StatusChangeResult> {
    const showToast = options.showToast ?? true
    const refresh = options.refresh ?? true
    if (!lo.hasMixedStatus && lo.status === newStatus) return { ok: true, succeeded: 0, failed: [] }
    if (statusChanging === lo.logicalKey || statusChangingRef.current.has(lo.logicalKey)) {
      return {
        ok: false,
        succeeded: 0,
        failed: lo.underlyingOrderIds.map(id => ({ id, message: 'Order is already updating.' })),
        message: 'Order is already updating.',
      }
    }
    statusChangingRef.current.add(lo.logicalKey)
    setStatusChanging(lo.logicalKey)

    if (newStatus === 'completed') {
      const { error: claimError } = await supabase.rpc('claim_logical_order', { p_order_id: lo.primaryOrderId })
      if (claimError) {
        statusChangingRef.current.delete(lo.logicalKey)
        setStatusChanging(null)
        const message = `Could not claim order: ${claimError.message}`
        if (showToast) toast.error(message)
        return {
          ok: false,
          succeeded: 0,
          failed: lo.underlyingOrderIds.map(id => ({ id, message })),
          message,
        }
      }

      const { error } = await supabase.rpc('complete_logical_order', { p_order_id: lo.primaryOrderId })
      statusChangingRef.current.delete(lo.logicalKey)
      setStatusChanging(null)
      if (error) {
        const message = `Could not complete order: ${error.message}`
        if (showToast) toast.error(message)
        if (refresh) await fetchData()
        return {
          ok: false,
          succeeded: 0,
          failed: lo.underlyingOrderIds.map(id => ({ id, message })),
          message,
        }
      }
      if (showToast) toast.success('Order marked completed.')
      if (refresh) await fetchData()
      return { ok: true, succeeded: lo.underlyingOrderIds.length, failed: [] }
    }

    const shouldClaimBeforeTransition =
      lo.status !== 'completed' && newStatus !== 'cancelled' && newStatus !== 'refunded'

    if (shouldClaimBeforeTransition) {
      const { error: claimError } = await supabase.rpc('claim_logical_order', { p_order_id: lo.primaryOrderId })
      if (claimError) {
        statusChangingRef.current.delete(lo.logicalKey)
        setStatusChanging(null)
        const message = `Could not claim order: ${claimError.message}`
        if (showToast) toast.error(message)
        return {
          ok: false,
          succeeded: 0,
          failed: lo.underlyingOrderIds.map(id => ({ id, message })),
          message,
        }
      }
    }

    const results = await Promise.all(
      lo.underlyingOrderIds.map(async id => {
        try {
          const { error } = await supabase.rpc('transition_order', { p_order_id: id, p_new_status: newStatus })
          return { id, message: error?.message ?? null }
        } catch (err) {
          return { id, message: err instanceof Error ? err.message : 'Unknown transition error' }
        }
      }),
    )
    const failed = results
      .filter((r): r is StatusFailure => r.message !== null)
      .map(r => ({ id: r.id, message: r.message }))
    const succeeded = results.length - failed.length
    const failedRows = failed.map(f => f.id.slice(0, 8)).join(', ')
    const failureMessage = failed.length > 0
      ? succeeded === 0
        ? `Could not update order status: ${failed[0].message}${failedRows ? ` (row ${failedRows})` : ''}`
        : `Only ${succeeded}/${results.length} order rows were marked ${newStatus}. Failed row(s): ${failedRows}. ${failed[0].message}`
      : undefined

    if (failed.length > 0) {
      if (showToast) toast.error(failureMessage ?? 'Could not update order status.')
    } else {
      if (showToast) toast.success(`Order marked ${newStatus}.`)
    }
    statusChangingRef.current.delete(lo.logicalKey)
    setStatusChanging(null)
    if (refresh) await fetchData()

    return { ok: failed.length === 0, succeeded, failed, message: failureMessage }
  }

  async function handleCompleteOrder(lo: LogicalOrder) {
    if (!isLogicalOrderReady(lo)) {
      const message = getCompletionBlocker(lo)
      flashOrderFeedback({ [lo.logicalKey]: 'error' })
      toast.error(message)
      return
    }

    const result = await handleStatusChange(lo, 'completed', { showToast: false, refresh: false })
    if (!result.ok) {
      const message = result.message ?? 'Could not complete order.'
      flashOrderFeedback({ [lo.logicalKey]: 'error' })
      toast.error(message)
      await fetchData()
      return
    }

    flashOrderFeedback({ [lo.logicalKey]: 'success' })
    toast.success('Order completed.')
    const refreshedOrders = await fetchData()
    const nextOrder = sortActiveOrdersForQueue(refreshedOrders, nowMs).find(order => order.logicalKey !== lo.logicalKey)
    setSelectedOrderKeys(prev => {
      if (!prev.has(lo.logicalKey)) return prev
      const next = new Set(prev)
      next.delete(lo.logicalKey)
      return next
    })
    setFocusedOrderKey(nextOrder?.logicalKey ?? null)
    setCenterMode('shop')
  }

  function setLogicalOrderDeleting(logicalKey: string, deleting: boolean) {
    setDeletingOrderKeys(prev => {
      const next = new Set(prev)
      if (deleting) next.add(logicalKey)
      else next.delete(logicalKey)
      return next
    })
  }

  async function isOrderRowMissing(orderId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()
    return !error && data === null
  }

  async function deleteLogicalOrder(lo: LogicalOrder): Promise<DeleteLogicalResult> {
    let deletedRows = 0
    let error: string | null = null

    for (const id of lo.underlyingOrderIds) {
      const { error: rpcError } = await supabase.rpc('delete_order', { p_order_id: id })
      if (rpcError) {
        const alreadyGone = await isOrderRowMissing(id)
        if (alreadyGone) {
          deletedRows += 1
          continue
        }
        error = rpcError.message
        break
      }
      deletedRows += 1
    }

    const ok = error === null && deletedRows === lo.underlyingOrderIds.length
    return {
      logicalKey: lo.logicalKey,
      orderNumber: lo.orderNumber,
      buyerName: lo.buyerName,
      ok,
      deletedRows,
      totalRows: lo.underlyingOrderIds.length,
      error: ok ? null : error ?? `Only ${deletedRows}/${lo.underlyingOrderIds.length} order rows were deleted.`,
    }
  }

  function removeDeletedRowsFromLocalState(results: DeleteLogicalResult[], orders: LogicalOrder[]) {
    const deletedIds = new Set(
      orders
        .filter(order => results.some(result => result.ok && result.logicalKey === order.logicalKey))
        .flatMap(order => order.underlyingOrderIds),
    )
    if (deletedIds.size === 0) return
    setRawOrders(prev => prev.filter(row => !deletedIds.has(row.id)))
  }

  function clearDeletedSelections(results: DeleteLogicalResult[]) {
    const deletedKeys = new Set(results.filter(result => result.ok).map(result => result.logicalKey))
    if (deletedKeys.size === 0) return
    setSelectedOrderKeys(prev => {
      const next = new Set(prev)
      deletedKeys.forEach(key => next.delete(key))
      return next
    })
  }

  async function refreshAfterDelete(results: DeleteLogicalResult[], orders: LogicalOrder[]) {
    const deletedKeys = new Set(results.filter(result => result.ok).map(result => result.logicalKey))
    const wasFocusedDeleted = focusedOrder ? deletedKeys.has(focusedOrder.logicalKey) : false
    const wasInspectDeleted = inspectOrder ? deletedKeys.has(inspectOrder.logicalKey) : false

    removeDeletedRowsFromLocalState(results, orders)
    clearDeletedSelections(results)
    if (wasInspectDeleted) setInspectOrder(null)

    const refreshedOrders = await fetchData()
    if (wasFocusedDeleted) {
      const nextOrder = sortActiveOrdersForQueue(refreshedOrders, nowMs).find(order => !deletedKeys.has(order.logicalKey))
      setFocusedOrderKey(nextOrder?.logicalKey ?? null)
      setCenterMode('shop')
    }
  }

  async function handleDelete(lo: LogicalOrder) {
    if (deletingOrderKeys.has(lo.logicalKey)) return
    const ok = await confirm({
      title: 'Delete this order?',
      description: `${getDeleteOrderSummary(lo)}\n\nThis permanently removes this order from XOB.`,
      confirmLabel: 'Delete Order',
      danger: true,
    })
    if (!ok) return

    setDeleteResults(null)
    setLogicalOrderDeleting(lo.logicalKey, true)
    try {
      const result = await deleteLogicalOrder(lo)
      setDeleteResults([result])
      await refreshAfterDelete([result], [lo])
      if (result.ok) {
        flashOrderFeedback({ [lo.logicalKey]: 'success' })
        toast.success('Order deleted.')
      } else {
        flashOrderFeedback({ [lo.logicalKey]: 'error' })
        toast.error(`Could not delete ${lo.orderNumber ?? 'order'}: ${result.error}`)
      }
    } catch (err) {
      flashOrderFeedback({ [lo.logicalKey]: 'error' })
      toast.error(err instanceof Error ? err.message : 'Could not delete order.')
      await fetchData()
    } finally {
      setLogicalOrderDeleting(lo.logicalKey, false)
    }
  }

  async function handleDeleteSelected() {
    if (selectedOrders.length === 0 || deletingOrderKeys.size > 0) return
    const count = selectedOrders.length
    const ok = await confirm({
      title: `Delete ${count} selected order${count !== 1 ? 's' : ''}?`,
      description: 'These orders will be permanently removed from XOB.\nThis is NOT the same as completing them.',
      confirmLabel: `Delete ${count} Order${count !== 1 ? 's' : ''}`,
      danger: true,
    })
    if (!ok) return

    setBatchResults(null)
    setDeleteResults([])
    selectedOrders.forEach(order => setLogicalOrderDeleting(order.logicalKey, true))

    const results: DeleteLogicalResult[] = []
    const feedback: Record<string, 'success' | 'error'> = {}
    try {
      for (const order of selectedOrders) {
        const result = await deleteLogicalOrder(order)
        results.push(result)
        feedback[order.logicalKey] = result.ok ? 'success' : 'error'
        setDeleteResults([...results])
      }

      await refreshAfterDelete(results, selectedOrders)
      flashOrderFeedback(feedback)

      const succeeded = results.filter(result => result.ok).length
      const failed = results.length - succeeded
      if (failed > 0) {
        toast.error(`${succeeded} deleted, ${failed} failed. Failed orders remain visible.`)
      } else {
        toast.success(`${succeeded} order${succeeded !== 1 ? 's' : ''} deleted.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete selected orders.')
      await fetchData()
    } finally {
      selectedOrders.forEach(order => setLogicalOrderDeleting(order.logicalKey, false))
    }
  }

  // ── Edit helper — routes BW orders to account assignment, XOB to workspace ───
  function openEditWorkspace(lo: LogicalOrder) {
    if (lo.source === 'budgetwise') {
      setBwAssignOrder(lo)
      return
    }
    const raw = rawOrdersMap.get(lo.primaryOrderId)
    if (raw) {
      setCenterMode('manual')
      ws.openOrCreate(raw)
    }
  }

  // ── BW account assignment save ────────────────────────────────────────────────
  //
  // Scenarios handled per item:
  //   unchanged       → skip (no DB call)
  //   null → account  → assign_order_account (atomic row update + reservation)
  //   account A → B   → reassign_order_account (fully atomic, updates both row + reservation)
  //   account → null  → release_order_reservation, then null out the orders row
  //
  async function saveBudgetWiseAssignments(
    order: LogicalOrder,
    assignments: Record<string, string | null>,
    options: { refresh?: boolean; toastResult?: boolean } = {},
  ): Promise<AssignmentItemResult[]> {
    const { refresh = true, toastResult = true } = options

    // Per-account combined Robux validation before touching the DB.
    // Effective available = current available + reservations on THIS order's items
    // that are being released (they'll free up when we reassign/remove them).
    const perAccountRequired = new Map<string, number>()
    for (const item of order.items) {
      const newId = assignments[item.id]
      if (!newId) continue
      perAccountRequired.set(newId, (perAccountRequired.get(newId) ?? 0) + item.robuxAmount)
    }
    const validationErrors = new Map<string, string>()
    for (const [accId, required] of perAccountRequired) {
      const acc = accounts.find(a => a.id === accId)
      if (!acc) continue
      const currentlyReservedForThisOrder = order.items
        .filter(i => i.robloxAccountId === accId)
        .reduce((s, i) => s + i.robuxAmount, 0)
      const effectiveAvail = getAvailableRobux(acc) + currentlyReservedForThisOrder
      if (effectiveAvail < required) {
        validationErrors.set(
          accId,
          `${required.toLocaleString()} R$ required but only ${effectiveAvail.toLocaleString()} R$ effectively available`,
        )
      }
    }
    if (validationErrors.size > 0) {
      if (refresh) fetchData()
      return order.items.map(item => {
        const newId = assignments[item.id] ?? null
        const err   = newId ? (validationErrors.get(newId) ?? null) : null
        return { itemId: item.id, gamepassName: item.gamepassName, accountId: newId, assignOk: !err, reserveOk: !err, error: err }
      })
    }

    const results: AssignmentItemResult[] = []
    for (const item of order.items) {
        const newId  = assignments[item.id] ?? null
        const prevId = item.robloxAccountId ?? null
        const base   = { itemId: item.id, gamepassName: item.gamepassName, accountId: newId }

        // Unchanged
        if (newId === prevId) {
          results.push({ ...base, assignOk: true, reserveOk: true, error: null })
          continue
        }

        // Removal: release reservation, then null out the order row
        if (newId === null) {
          const rel = await supabase.rpc('release_order_reservation', { p_order_id: item.id })
          if (rel.error) {
            results.push({ ...base, assignOk: false, reserveOk: false, error: rel.error.message })
            continue
          }
          const upd = await supabase.from('orders').update({ roblox_account_id: null }).eq('id', item.id)
          results.push({
            ...base,
            assignOk: !upd.error,
            reserveOk: true,
            error: upd.error?.message ?? null,
          })
          continue
        }

        // Reassignment A → B: use reassign_order_account (atomic, updates row + reservation)
        if (prevId !== null) {
          const res = await supabase.rpc('reassign_order_account', {
            p_order_id:       item.id,
            p_new_account_id: newId,
          })
          results.push({ ...base, assignOk: !res.error, reserveOk: !res.error, error: res.error?.message ?? null })
          continue
        }

        // Initial assignment: assign_order_account validates, reserves, and
        // updates the order row in a single PostgreSQL transaction.
        const assignRes = await supabase.rpc('assign_order_account', {
          p_order_id:   item.id,
          p_account_id: newId,
        })
        results.push({ ...base, assignOk: !assignRes.error, reserveOk: !assignRes.error, error: assignRes.error?.message ?? null })
    }

    if (refresh) fetchData()

    const allOk = results.every(r => r.assignOk && r.reserveOk)
    if (toastResult && allOk) {
      toast.success('Account assignments saved.')
      // Dialog calls onClose() on full success; we do NOT call setBwAssignOrder(null) here.
    } else if (toastResult) {
      const failCount = results.filter(r => !r.assignOk || !r.reserveOk).length
      toast.error(`${failCount} item${failCount !== 1 ? 's' : ''} could not be saved — see dialog for details.`)
    }

    return results
  }

  async function handleBWAssignSave(
    assignments: Record<string, string | null>,
  ): Promise<AssignmentItemResult[]> {
    if (!bwAssignOrder) return []
    return saveBudgetWiseAssignments(bwAssignOrder, assignments)
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
    sortActiveOrdersForQueue(logicalOrders, nowMs),
    [logicalOrders, nowMs],
  )

  // ── Action Center filter ─────────────────────────────────────────────────────
  type ActionFilter = 'all' | 'unassigned' | 'ready' | 'pending' | 'stalled'
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')

  const actionFilterCounts = useMemo(() => {
    const unassigned = activeOrdersSorted.filter(lo => {
      if (lo.source === 'budgetwise') return lo.items.some(i => i.robloxAccountId === null)
      return lo.robloxAccountId === null
    }).length
    const ready = activeOrdersSorted.filter(lo => {
      if (lo.hasMixedStatus || lo.status !== 'paid') return false
      if (lo.source === 'budgetwise') return lo.items.every(i => i.robloxAccountId !== null)
      return lo.robloxAccountId !== null
    }).length
    const pending = activeOrdersSorted.filter(lo => lo.status === 'pending' && !lo.hasMixedStatus).length
    const stalled = activeOrdersSorted.filter(lo =>
      (nowMs - new Date(lo.createdAt).getTime()) / 3_600_000 > 48
    ).length
    return { all: activeOrdersSorted.length, unassigned, ready, pending, stalled }
  }, [activeOrdersSorted, nowMs])

  const filteredActiveOrders = useMemo(() => {
    switch (actionFilter) {
      case 'unassigned':
        return activeOrdersSorted.filter(lo => {
          if (lo.source === 'budgetwise') return lo.items.some(i => i.robloxAccountId === null)
          return lo.robloxAccountId === null
        })
      case 'ready':
        return activeOrdersSorted.filter(lo => {
          if (lo.hasMixedStatus || lo.status !== 'paid') return false
          if (lo.source === 'budgetwise') return lo.items.every(i => i.robloxAccountId !== null)
          return lo.robloxAccountId !== null
        })
      case 'pending':
        return activeOrdersSorted.filter(lo => lo.status === 'pending' && !lo.hasMixedStatus)
      case 'stalled':
        return activeOrdersSorted.filter(lo =>
          (nowMs - new Date(lo.createdAt).getTime()) / 3_600_000 > 48
        )
      default:
        return activeOrdersSorted
    }
  }, [activeOrdersSorted, actionFilter, nowMs])

  const activeAccount = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  )

  const focusedOrder = (() => {
    if (focusedOrderKey) {
      const existing = activeOrdersSorted.find(lo => lo.logicalKey === focusedOrderKey)
      if (existing) return existing
    }
    return filteredActiveOrders[0] ?? null
  })()

  const getAssignableItems = useCallback((lo: LogicalOrder): LogicalOrderItem[] => {
    if (lo.source !== 'budgetwise' || !isActiveLogicalOrder(lo)) return []
    return lo.items.filter(item => item.robloxAccountId === null)
  }, [])

  const selectedOrders = activeOrdersSorted.filter(lo => selectedOrderKeys.has(lo.logicalKey))
  const selectedAssignableItems = selectedOrders.flatMap(lo => getAssignableItems(lo))
  const selectedRequiredRobux = selectedAssignableItems.reduce((sum, item) => sum + item.robuxAmount, 0)
  const selectedIncompatibleCount = selectedOrders.filter(lo => getAssignableItems(lo).length === 0).length
  const selectedPendingCount = selectedOrders.filter(lo => !lo.hasMixedStatus && lo.status === 'pending').length
  const selectedPaidCount = selectedOrders.filter(lo => !lo.hasMixedStatus && lo.status === 'paid').length
  const selectedFinalizeRequiredRobux = selectedOrders
    .filter(lo => !lo.hasMixedStatus && (lo.status === 'pending' || lo.status === 'paid'))
    .reduce((sum, lo) => sum + lo.totalRobux, 0)
  const activeAvailableRobux = activeAccount ? getAvailableRobux(activeAccount) : 0
  const selectedRemainingRobux = activeAvailableRobux - selectedRequiredRobux
  const selectedOrderSequence = Array.from(selectedOrderKeys)

  function toggleQueueSelection(lo: LogicalOrder, index: number, shiftKey: boolean) {
    setBatchResults(null)
    setSelectedOrderKeys(prev => {
      const next = new Set(prev)
      if (shiftKey && lastQueueIndexRef.current !== null) {
        const [start, end] = [lastQueueIndexRef.current, index].sort((a, b) => a - b)
        filteredActiveOrders.slice(start, end + 1).forEach(order => next.add(order.logicalKey))
      } else if (next.has(lo.logicalKey)) {
        next.delete(lo.logicalKey)
      } else {
        next.add(lo.logicalKey)
      }
      return next
    })
    lastQueueIndexRef.current = index
  }

  function flashOrderFeedback(nextFeedback: Record<string, 'success' | 'error'>) {
    setOrderFeedback(prev => ({ ...prev, ...nextFeedback }))
    const timer = window.setTimeout(() => {
      setOrderFeedback(prev => {
        const next = { ...prev }
        Object.keys(nextFeedback).forEach(key => { delete next[key] })
        return next
      })
    }, prefersReducedMotion ? 0 : 1400)
    feedbackTimersRef.current.push(timer)
  }

  async function handleAssignSelectedToActiveAccount() {
    if (!activeAccount) {
      toast.error('Select an active account first.')
      return
    }
    if (selectedAssignableItems.length === 0) {
      toast.error('Select at least one unassigned BudgetWise order.')
      return
    }
    if (selectedIncompatibleCount > 0) {
      toast.error(`${selectedIncompatibleCount} selected order${selectedIncompatibleCount !== 1 ? 's are' : ' is'} not assignable.`)
      return
    }
    if (selectedRemainingRobux < 0) {
      toast.error(`${formatRobux(selectedRequiredRobux)} required, but ${activeAccount.username} has ${formatRobux(activeAvailableRobux)} available.`)
      return
    }

    setBatchAssigning(true)
    setBatchResults(null)
    const allResults: AssignmentItemResult[] = []
    const nextFeedback: Record<string, 'success' | 'error'> = {}
    try {
      for (const order of selectedOrders) {
        const assignableItems = getAssignableItems(order)
        if (assignableItems.length === 0) continue
        const attemptedIds = new Set(assignableItems.map(item => item.id))
        const assignments = Object.fromEntries(
          order.items.map(item => [item.id, item.robloxAccountId ?? null]),
        ) as Record<string, string | null>
        for (const item of assignableItems) assignments[item.id] = activeAccount.id
        const results = await saveBudgetWiseAssignments(order, assignments, { refresh: false, toastResult: false })
        const attemptedResults = results.filter(result => attemptedIds.has(result.itemId))
        allResults.push(...attemptedResults)
        nextFeedback[order.logicalKey] = attemptedResults.some(r => !r.assignOk || !r.reserveOk) ? 'error' : 'success'
      }

      setBatchResults(allResults)
      flashOrderFeedback(nextFeedback)
      const failed = allResults.filter(r => !r.assignOk || !r.reserveOk)
      const succeeded = allResults.length - failed.length
      if (failed.length > 0) {
        toast.error(`${succeeded} assigned, ${failed.length} failed. Account state refreshed.`)
      } else {
        toast.success(`Assigned ${succeeded} item${succeeded !== 1 ? 's' : ''} to ${activeAccount.username}.`)
        const completedKeys = new Set(selectedOrders.map(lo => lo.logicalKey))
        setSelectedOrderKeys(prev => {
          const next = new Set(prev)
          completedKeys.forEach(key => next.delete(key))
          return next
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not assign selected orders.')
    } finally {
      await fetchData()
      setBatchAssigning(false)
    }
  }

  async function handleAssignFocusedToActiveAccount(lo: LogicalOrder) {
    if (!activeAccount) {
      toast.error('Select an active account first.')
      return
    }
    const assignableItems = getAssignableItems(lo)
    if (assignableItems.length === 0) {
      toast.error('This order has no unassigned BudgetWise items.')
      return
    }
    const required = assignableItems.reduce((sum, item) => sum + item.robuxAmount, 0)
    if (getAvailableRobux(activeAccount) < required) {
      toast.error(`${activeAccount.username} needs ${formatRobux(required)} but only has ${formatRobux(getAvailableRobux(activeAccount))} available.`)
      return
    }

    setBatchAssigning(true)
    setBatchResults(null)
    try {
      const attemptedIds = new Set(assignableItems.map(item => item.id))
      const assignments = Object.fromEntries(
        lo.items.map(item => [item.id, item.robloxAccountId ?? null]),
      ) as Record<string, string | null>
      for (const item of assignableItems) assignments[item.id] = activeAccount.id
      const results = await saveBudgetWiseAssignments(lo, assignments, { refresh: false, toastResult: false })
      const attemptedResults = results.filter(result => attemptedIds.has(result.itemId))
      setBatchResults(attemptedResults)
      flashOrderFeedback({ [lo.logicalKey]: attemptedResults.some(r => !r.assignOk || !r.reserveOk) ? 'error' : 'success' })
      const failed = attemptedResults.filter(r => !r.assignOk || !r.reserveOk)
      if (failed.length > 0) {
        toast.error(`${attemptedResults.length - failed.length} assigned, ${failed.length} failed. Account state refreshed.`)
      } else {
        toast.success(`Assigned ${attemptedResults.length} item${attemptedResults.length !== 1 ? 's' : ''} to ${activeAccount.username}.`)
        setSelectedOrderKeys(prev => {
          const next = new Set(prev)
          next.delete(lo.logicalKey)
          return next
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not assign this order.')
    } finally {
      await fetchData()
      setBatchAssigning(false)
    }
  }

  // ── Bulk Finalize ────────────────────────────────────────────────────────────
  //
  // Catches up orders the seller already finished in Roblox but hasn't updated
  // in XOB yet. Every underlying transition still goes through handleStatusChange
  // → transition_order, exactly like a manual Mark Paid / Complete Order click —
  // this is a sequencing convenience, not a new completion path. LogicalOrders
  // are processed one at a time (never Promise.all across orders) because two
  // selected orders can share the same Roblox account; Postgres row locks would
  // serialize concurrent RPCs anyway, but sequential keeps the operation legible
  // and its progress UI meaningful.

  function openFinalizeDialog() {
    const candidates = selectedOrders.map(classifyForFinalize)
    setFinalizeCandidates(candidates)
    setFinalizeProgress(
      candidates
        .filter(c => c.kind === 'ready')
        .map(c => ({ logicalKey: c.lo.logicalKey, orderNumber: c.lo.orderNumber, buyerName: c.lo.buyerName, state: 'waiting', error: null })),
    )
    setFinalizePhase('preview')
    setFinalizeOpen(true)
  }

  function closeFinalizeDialog() {
    if (finalizing) return
    setFinalizeOpen(false)
    setFinalizeCandidates([])
    setFinalizeProgress([])
    setFinalizePhase('preview')
  }

  async function runFinalize() {
    const ready = finalizeCandidates.filter(c => c.kind === 'ready')
    if (ready.length === 0) return

    setFinalizing(true)
    setFinalizePhase('processing')

    const wasFocusedKey = focusedOrder?.logicalKey ?? null
    const completedKeys: string[] = []

    for (const candidate of ready) {
      const { lo, steps } = candidate
      setFinalizeProgress(prev => prev.map(p => p.logicalKey === lo.logicalKey ? { ...p, state: 'processing' } : p))

      let failMessage: string | null = null
      for (const step of steps) {
        const result = await handleStatusChange(lo, step, { showToast: false, refresh: false })
        if (!result.ok) {
          failMessage = result.message ?? `Could not mark order ${step}.`
          break
        }
      }

      if (failMessage) {
        setFinalizeProgress(prev => prev.map(p => p.logicalKey === lo.logicalKey ? { ...p, state: 'failed', error: failMessage } : p))
        flashOrderFeedback({ [lo.logicalKey]: 'error' })
      } else {
        setFinalizeProgress(prev => prev.map(p => p.logicalKey === lo.logicalKey ? { ...p, state: 'done' } : p))
        flashOrderFeedback({ [lo.logicalKey]: 'success' })
        completedKeys.push(lo.logicalKey)
      }
    }

    setSelectedOrderKeys(prev => {
      const next = new Set(prev)
      completedKeys.forEach(key => next.delete(key))
      return next
    })

    const refreshedOrders = await fetchData()
    if (wasFocusedKey && completedKeys.includes(wasFocusedKey)) {
      const nextOrder = sortActiveOrdersForQueue(refreshedOrders, nowMs).find(order => order.logicalKey !== wasFocusedKey)
      setFocusedOrderKey(nextOrder?.logicalKey ?? null)
      setCenterMode('shop')
    }

    const failedCount = ready.length - completedKeys.length
    if (failedCount > 0) {
      toast.error(`${completedKeys.length} order${completedKeys.length !== 1 ? 's' : ''} completed, ${failedCount} need attention.`)
    } else {
      toast.success(`${completedKeys.length} order${completedKeys.length !== 1 ? 's' : ''} finalized.`)
    }

    setFinalizing(false)
    setFinalizePhase('done')
  }

  // Button label — reflects whether there are saved workspaces to return to
  const wsButtonLabel = ws.workspaces.length > 0
    ? `Resume Workspace${ws.workspaces.length > 1 ? ` (${ws.workspaces.length})` : ''}`
    : 'Create Order'

  // ── Render ──────────────────────────────────────────────────────────────────
  const focusedAssignableItems = focusedOrder ? getAssignableItems(focusedOrder) : []
  const focusedRequiredRobux = focusedAssignableItems.reduce((sum, item) => sum + item.robuxAmount, 0)
  const focusedAssignedItems = focusedOrder
    ? focusedOrder.items.length - focusedOrder.items.filter(item => item.robloxAccountId === null).length
    : 0
  const focusedReadyToComplete = focusedOrder ? isLogicalOrderReady(focusedOrder) : false
  const focusedCompletionBlocker = focusedOrder && !focusedOrder.hasMixedStatus && focusedOrder.status === 'paid' && !focusedReadyToComplete
    ? getCompletionBlocker(focusedOrder)
    : null
  const focusedAgeHours = focusedOrder
    ? (nowMs - new Date(focusedOrder.createdAt).getTime()) / 3_600_000
    : 0
  const focusedRemainingRobux = activeAccount ? getAvailableRobux(activeAccount) - focusedRequiredRobux : null
  const focusedAssignmentIssue = focusedOrder?.source === 'budgetwise'
    ? focusedAssignableItems.length === 0
      ? 'Already assigned elsewhere.'
      : activeAccount
        ? focusedRemainingRobux !== null && focusedRemainingRobux < 0
          ? `Needs ${formatRobux(focusedRequiredRobux)} - active account has ${formatRobux(activeAvailableRobux)}`
          : null
        : 'Select an account to assign this order.'
    : null
  const selectedAssignmentIssue = selectedOrders.length === 0
    ? null
    : !activeAccount
      ? 'Select an account to assign checked orders.'
      : selectedIncompatibleCount > 0
        ? `${selectedIncompatibleCount} checked order${selectedIncompatibleCount !== 1 ? 's are' : ' is'} not assignable.`
        : selectedRemainingRobux < 0
          ? `Needs ${formatRobux(selectedRequiredRobux)} - active account has ${formatRobux(activeAvailableRobux)}`
          : null
  const showBatchAssignAction = selectedOrders.length > 0
    && !(selectedOrders.length === 1 && focusedOrder?.logicalKey === selectedOrders[0]?.logicalKey)
  const switchAccountQuery = accountSearch.trim().toLowerCase()
  const switchAccountRequiredRobux = selectedRequiredRobux > 0 ? selectedRequiredRobux : focusedRequiredRobux
  const switchAccountList = [...accounts]
    .filter(a => a.id !== activeAccountId)
    .filter(a => !switchAccountQuery || a.username.toLowerCase().includes(switchAccountQuery) || (a.chrome_profile ?? '').toLowerCase().includes(switchAccountQuery))
    .sort((a, b) => {
      const aAvailable = getAvailableRobux(a)
      const bAvailable = getAvailableRobux(b)
      const aCovers = switchAccountRequiredRobux > 0 && aAvailable >= switchAccountRequiredRobux ? 1 : 0
      const bCovers = switchAccountRequiredRobux > 0 && bAvailable >= switchAccountRequiredRobux ? 1 : 0
      if (aCovers !== bCovers) return bCovers - aCovers
      const aUsable = a.status === 'active' ? 1 : 0
      const bUsable = b.status === 'active' ? 1 : 0
      if (aUsable !== bUsable) return bUsable - aUsable
      if (aAvailable !== bAvailable) return bAvailable - aAvailable
      if (a.is_plus_account !== b.is_plus_account) return a.is_plus_account ? -1 : 1
      return a.username.localeCompare(b.username)
    })

  return (
    <div className="xob-orders-workspace relative overflow-x-hidden">
      <section className="relative px-4 sm:px-6 xl:px-8 pt-4 pb-8">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-[28px] sm:text-[34px] font-black leading-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
                Orders
              </h1>
              <p className="text-[12px] mt-1 font-semibold" style={{ color: 'rgba(255,255,255,0.44)' }}>
                {orderStats.activeOrders} active / {actionFilterCounts.unassigned} unassigned / {actionFilterCounts.ready} ready
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                ['Active', orderStats.activeOrders, '#22d3ee'],
                ['Unassigned', actionFilterCounts.unassigned, '#f59e0b'],
                ['Ready', actionFilterCounts.ready, '#34d399'],
                ['Stalled', actionFilterCounts.stalled, '#f43f5e'],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-lg px-3 py-2 min-w-[92px]" style={{ background: 'rgba(255,255,255,0.035)', border: `1px solid ${color}24` }}>
                  <p className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</p>
                  <p className="text-[16px] font-black tabular-nums leading-none mt-1" style={{ color }}>{value}</p>
                </div>
              ))}
              <button type="button" onClick={() => { setMobilePanel('accounts'); setAccountDockOpen(true) }} className="xl:hidden h-11 min-w-0 px-3 rounded-xl flex items-center gap-2 text-left cursor-pointer" style={{ background: 'rgba(52,211,153,0.060)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(255,255,255,0.78)' }}>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase" style={{ color: '#34d399' }}>Account</span>
                  <span className="block text-[11px] font-bold truncate max-w-[150px]" title={activeAccount?.username ?? 'No account selected'}>{activeAccount?.username ?? 'Choose account'}</span>
                </span>
                <span className="text-[12px] font-black tabular-nums flex-shrink-0" style={{ color: activeAccount ? '#34d399' : '#f59e0b' }}>{formatRobux(activeAvailableRobux)}</span>
              </button>
              <button type="button" onClick={() => { setCenterMode('manual'); ws.openOrCreate() }} className="h-11 px-4 rounded-xl flex items-center gap-2 text-[12px] font-black transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.76)' }}>
                <Plus className="w-4 h-4" />
                {ws.workspaces.length > 0 ? wsButtonLabel : 'Create Manual Order'}
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 lg:hidden">
            {([
              ['queue', 'Queue', filteredActiveOrders.length],
              ['order', 'Order', focusedOrder ? focusedOrder.items.length : 0],
              ['accounts', 'Accounts', accounts.length],
            ] as const).map(([panel, label, count]) => (
              <button
                key={panel}
                type="button"
                onClick={() => {
                  setMobilePanel(panel)
                  if (panel === 'accounts') setAccountDockOpen(true)
                }}
                className={`min-h-11 rounded-lg border px-2 text-[12px] font-black ${mobilePanel === panel ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-border bg-card text-muted-foreground'}`}
              >
                {label}
                <span className="ml-1 tabular-nums">{count}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(270px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,315px)_minmax(0,1fr)_minmax(285px,320px)] 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(300px,340px)] gap-2 xl:gap-3 items-start">
            <aside className={`${mobilePanel === 'queue' ? 'block' : 'hidden'} lg:block rounded-xl overflow-hidden min-w-0`} style={{ background: 'rgba(255,255,255,0.024)', border: '1px solid rgba(255,255,255,0.070)' }}>
              <div className="px-3.5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <h2 className="text-[13px] font-black" style={{ color: 'rgba(255,255,255,0.82)' }}>Order Queue</h2>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>Oldest actionable orders first. Shift-click selects a range.</p>
                </div>
                <span className="text-[12px] font-black tabular-nums" style={{ color: '#f59e0b' }}>{filteredActiveOrders.length}</span>
              </div>
              <div className="px-3 pt-3 flex items-center gap-1.5 flex-wrap">
                {([
                  { value: 'all', label: 'All', count: actionFilterCounts.all, color: 'rgba(255,255,255,0.56)' },
                  { value: 'unassigned', label: 'Unassigned', count: actionFilterCounts.unassigned, color: '#f59e0b' },
                  { value: 'ready', label: 'Ready', count: actionFilterCounts.ready, color: '#34d399' },
                  { value: 'pending', label: 'Pending', count: actionFilterCounts.pending, color: '#22d3ee' },
                  { value: 'stalled', label: 'Stalled', count: actionFilterCounts.stalled, color: '#f43f5e' },
                ] as { value: ActionFilter; label: string; count: number; color: string }[]).map(chip => {
                  const isActive = actionFilter === chip.value
                  return (
                    <button key={chip.value} type="button" onClick={() => setActionFilter(chip.value)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer" style={{ background: isActive ? `${chip.color}18` : 'rgba(255,255,255,0.035)', border: `1px solid ${isActive ? `${chip.color}3d` : 'rgba(255,255,255,0.07)'}`, color: isActive ? chip.color : 'rgba(255,255,255,0.38)' }}>
                      {chip.label} <span className="tabular-nums">{chip.count}</span>
                    </button>
                  )
                })}
              </div>
              {selectedOrderKeys.size > 0 && (
                <div className="px-3 pt-3">
                  <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(52,211,153,0.045)', border: '1px solid rgba(52,211,153,0.18)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black" style={{ color: 'rgba(255,255,255,0.80)' }}>{selectedOrderKeys.size} selected</p>
                      <button type="button" onClick={() => setSelectedOrderKeys(new Set())} className="text-[10px] font-bold cursor-pointer" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.16)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.32)' }}>Pending</p>
                        <p className="text-[13px] font-black tabular-nums" style={{ color: '#94a3b8' }}>{selectedPendingCount}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.16)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.32)' }}>Paid</p>
                        <p className="text-[13px] font-black tabular-nums" style={{ color: '#38bdf8' }}>{selectedPaidCount}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.16)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.32)' }}>Required</p>
                        <p className="text-[13px] font-black tabular-nums" style={{ color: '#f59e0b' }}>{formatRobux(selectedFinalizeRequiredRobux)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={finalizing}
                      onClick={openFinalizeDialog}
                      className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-black disabled:opacity-45 transition-opacity cursor-pointer"
                      style={{ background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.34)', color: '#34d399' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Finalize {selectedOrderKeys.size} Order{selectedOrderKeys.size !== 1 ? 's' : ''}
                    </button>
                    <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <button
                        type="button"
                        disabled={deletingOrderKeys.size > 0}
                        onClick={() => { void handleDeleteSelected() }}
                        className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-black disabled:opacity-45 transition-opacity cursor-pointer"
                        style={{ background: 'rgba(244,63,94,0.11)', border: '1px solid rgba(244,63,94,0.30)', color: '#f43f5e' }}
                      >
                        {deletingOrderKeys.size > 0 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete {selectedOrders.length} Selected
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {deleteResults && deleteResults.length > 0 && (
                <div className="px-3 pt-3">
                  <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(244,63,94,0.045)', border: '1px solid rgba(244,63,94,0.18)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black" style={{ color: 'rgba(255,255,255,0.78)' }}>Delete Results</p>
                      <button type="button" onClick={() => setDeleteResults(null)} className="text-[10px] font-bold cursor-pointer" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {deleteResults.map(result => (
                        <div key={result.logicalKey} className="rounded-lg px-2.5 py-2 flex items-start gap-2" style={{ background: result.ok ? 'rgba(52,211,153,0.045)' : 'rgba(244,63,94,0.07)', border: `1px solid ${result.ok ? 'rgba(52,211,153,0.14)' : 'rgba(244,63,94,0.18)'}` }}>
                          {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#34d399' }} /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f43f5e' }} />}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10.5px] font-mono font-black truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>{result.orderNumber ?? result.logicalKey}</p>
                            <p className="text-[10px] truncate" style={{ color: result.ok ? '#34d399' : '#f43f5e' }}>
                              {result.ok ? 'Deleted' : `Could not delete - ${result.error}`}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: 'rgba(255,255,255,0.38)' }}>
                            {result.deletedRows}/{result.totalRows}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="p-3 space-y-2">
                {loading ? (
                  <div className="rounded-xl px-3 py-8 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.025)' }}>Loading orders...</div>
                ) : filteredActiveOrders.length === 0 ? (
                  <div className="rounded-xl px-3 py-8 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.025)' }}>No orders match this filter.</div>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredActiveOrders.map((lo, index) => {
                  const selected = selectedOrderKeys.has(lo.logicalKey)
                  const focused = focusedOrder?.logicalKey === lo.logicalKey
                  const assignableItems = getAssignableItems(lo)
                  const assignedItems = lo.items.length - lo.items.filter(item => item.robloxAccountId === null).length
                  const ageHours = (nowMs - new Date(lo.createdAt).getTime()) / 3_600_000
                  const firstItem = lo.items[0]
                  const assignableRobux = assignableItems.reduce((sum, item) => sum + item.robuxAmount, 0)
                  const fitsActiveAccount = activeAccount && assignableRobux > 0
                    ? getAvailableRobux(activeAccount) >= assignableRobux
                    : null
                  const activeShortfall = fitsActiveAccount === false ? assignableRobux - activeAvailableRobux : 0
                  const isNewShopWork = lo.source === 'budgetwise' && assignableItems.length > 0 && ageHours < 6
                  const selectedIndex = selected ? selectedOrderSequence.indexOf(lo.logicalKey) + 1 : 0
                  const feedback = orderFeedback[lo.logicalKey]
                  const queueBg = feedback === 'success'
                    ? 'rgba(52,211,153,0.075)'
                    : feedback === 'error'
                      ? 'rgba(244,63,94,0.075)'
                      : focused
                        ? 'rgba(34,211,238,0.055)'
                        : isNewShopWork
                          ? 'rgba(34,211,238,0.040)'
                          : 'rgba(255,255,255,0.026)'
                  const queueBorder = feedback === 'success'
                    ? 'rgba(52,211,153,0.28)'
                    : feedback === 'error'
                      ? 'rgba(244,63,94,0.28)'
                      : focused
                        ? 'rgba(34,211,238,0.30)'
                        : isNewShopWork
                          ? 'rgba(34,211,238,0.16)'
                          : 'rgba(255,255,255,0.060)'
                  const queueShadow = [
                    focused ? 'inset 4px 0 0 rgba(34,211,238,0.88)' : null,
                    selected ? 'inset -3px 0 0 rgba(245,158,11,0.85)' : null,
                  ].filter(Boolean).join(', ')
                  return (
                    <motion.div
                      key={lo.logicalKey}
                      role="button"
                      tabIndex={0}
                      layout={!prefersReducedMotion}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                      transition={quickMotion}
                      whileHover={prefersReducedMotion ? undefined : { backgroundColor: focused ? 'rgba(34,211,238,0.070)' : 'rgba(255,255,255,0.042)' }}
                      onClick={() => { setFocusedOrderKey(lo.logicalKey); setCenterMode('shop'); setMobilePanel('order') }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        setFocusedOrderKey(lo.logicalKey)
                        setCenterMode('shop')
                        setMobilePanel('order')
                      }}
                      className="w-full rounded-xl p-3 text-left transition-colors cursor-pointer min-w-0"
                      style={{ background: queueBg, border: `1px solid ${queueBorder}`, boxShadow: queueShadow || 'none' }}
                    >
                      <span className="flex items-start gap-2.5">
                        <motion.span role="checkbox" aria-checked={selected} aria-label={`Select ${lo.orderNumber ?? 'order'}`} onClick={(e) => { e.stopPropagation(); toggleQueueSelection(lo, index, e.shiftKey) }} className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-black tabular-nums" style={{ background: selected ? 'rgba(245,158,11,0.24)' : 'rgba(255,255,255,0.065)', border: `1px solid ${selected ? 'rgba(245,158,11,0.62)' : 'rgba(255,255,255,0.18)'}`, color: '#f59e0b' }} animate={prefersReducedMotion ? undefined : { scale: selected ? 1.03 : 1 }} transition={quickMotion}>
                          <AnimatePresence initial={false} mode="wait">
                            {selected ? (
                              <motion.span key="index" initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={quickMotion}>{selectedIndex}</motion.span>
                            ) : (
                              <motion.span key="empty" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={quickMotion} />
                            )}
                          </AnimatePresence>
                        </motion.span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-mono font-black truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>{lo.orderNumber ?? lo.logicalKey}</span>
                            {isNewShopWork && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.24)' }}>NEW</span>}
                            {feedback === 'success' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: '#34d399', background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.18)' }}>ASSIGNED</span>}
                            {feedback === 'error' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.18)' }}>FAILED</span>}
                            <StatusBadge status={lo.hasMixedStatus ? 'mixed' : lo.status} />
                            {ageHours > 48 && <AlertCircle className="w-3 h-3" style={{ color: '#f43f5e' }} />}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                disabled={deletingOrderKeys.has(lo.logicalKey)}
                                onClick={(e) => e.stopPropagation()}
                                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-45 flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.44)' }}
                                aria-label={`More actions for ${lo.orderNumber ?? 'order'}`}
                              >
                                {deletingOrderKeys.has(lo.logicalKey)
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <MoreHorizontal className="w-3.5 h-3.5" />}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleDelete(lo)
                                  }}
                                  className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                          <span className="block text-[13px] font-black truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{lo.buyerName ?? lo.buyerRobloxUsername ?? 'Unknown buyer'}</span>
                          <span className="block text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.42)' }}>
                            {lo.items.length > 1 ? `${lo.items.length} items` : (firstItem?.gamepassName ?? firstItem?.gameName ?? 'No item')} / {formatOrderAge(ageHours)}
                          </span>
                        </span>
                        <span className="text-right flex-shrink-0">
                          <span className="flex items-baseline justify-end gap-1.5">
                            <span className="text-[16px] font-black tabular-nums leading-none" style={{ color: assignableItems.length > 0 ? '#f59e0b' : 'rgba(255,255,255,0.84)' }}>{formatRobux(lo.totalRobux)}</span>
                            <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: 'rgba(196,181,253,0.92)' }}>
                              {lo.totalSellingPrice ? formatPHPCompact(lo.totalSellingPrice) : '—'}
                            </span>
                          </span>
                          <span className="block text-[10px] font-bold mt-1" style={{ color: assignableItems.length > 0 ? '#f59e0b' : '#34d399' }}>
                            {assignableItems.length > 0 ? `${assignableItems.length} unassigned` : `${assignedItems}/${lo.items.length} assigned`}
                          </span>
                          {activeShortfall > 0 && (
                            <span className="block text-[9px] font-bold mt-0.5" style={{ color: '#f43f5e' }}>
                              short {formatRobux(activeShortfall)}
                            </span>
                          )}
                        </span>
                      </span>
                    </motion.div>
                  )
                    })}
                  </AnimatePresence>
                )}
              </div>
            </aside>

            <main className={`${mobilePanel === 'order' ? 'block' : 'hidden'} lg:block rounded-2xl overflow-hidden min-w-0`} style={{ background: 'rgba(255,255,255,0.024)', border: '1px solid rgba(255,255,255,0.075)' }}>
              <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <h2 className="text-[14px] font-black" style={{ color: 'rgba(255,255,255,0.84)' }}>
                    {centerMode === 'manual' ? 'Manual Order' : 'Shop Order'}
                  </h2>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    {centerMode === 'manual' ? 'Manual XOB creation stays secondary to the Shop queue.' : 'Selected Shop order details and account actions.'}
                  </p>
                </div>
                <button type="button" onClick={() => {
                  if (centerMode === 'manual') {
                    setCenterMode('shop')
                  } else {
                    setCenterMode('manual')
                    ws.openOrCreate()
                  }
                }} className="h-9 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.68)' }}>
                  <Plus className="w-3.5 h-3.5" />
                  {centerMode === 'manual' ? 'Back to Shop Order' : 'Create Manual Order'}
                </button>
              </div>
              <AnimatePresence mode="wait" initial={false}>
              {centerMode === 'manual' && ws.open && ws.activeWorkspace ? (
                <motion.div key={`manual-${ws.activeWorkspace.id}`} initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={quickMotion} className="p-3">
                  <div className="glass-workspace overflow-hidden">
                    <WorkspaceTabs workspaces={ws.workspaces} activeId={ws.activeId} accounts={accounts} onSelect={ws.setActiveId} onClose={handleCloseTab} onNew={ws.addWorkspace} />
                    <WorkspaceEditor
                      workspace={ws.activeWorkspace}
                      editOrder={ws.activeWorkspace.editOrderId ? rawOrdersMap.get(ws.activeWorkspace.editOrderId) ?? null : null}
                      gamepasses={gamepasses}
                      accounts={accounts}
                      gameActivity={gameActivity}
                      onUpdate={ws.updateWorkspace}
                      onSubmit={handleWorkspaceSubmit}
                      onClose={() => ws.closeWorkspace(ws.activeWorkspace!.id)}
                    />
                  </div>
                </motion.div>
              ) : focusedOrder ? (
                <motion.div key={`shop-${focusedOrder.logicalKey}`} initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={quickMotion} className="p-3 sm:p-4 min-w-0">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-mono font-black" style={{ color: 'rgba(255,255,255,0.70)' }}>{focusedOrder.orderNumber ?? focusedOrder.logicalKey}</span>
                        <StatusBadge status={focusedOrder.hasMixedStatus ? 'mixed' : focusedOrder.status} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: focusedOrder.source === 'budgetwise' ? '#22d3ee' : '#34d399' }}>{focusedOrder.source === 'budgetwise' ? 'BudgetWise' : 'XOB Native'}</span>
                      </div>
                      <h2 className="text-[22px] font-black truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>{focusedOrder.buyerName ?? 'Unknown buyer'}</h2>
                      <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.44)' }}>
                        {focusedOrder.buyerRobloxUsername ? `@${focusedOrder.buyerRobloxUsername}` : 'No Roblox username'} / {formatOrderAge(focusedAgeHours)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {focusedOrder.source === 'budgetwise' && activeAccount && focusedAssignableItems.length > 0 && (
                        <button type="button" disabled={batchAssigning || (focusedRemainingRobux !== null && focusedRemainingRobux < 0)} onClick={() => handleAssignFocusedToActiveAccount(focusedOrder)} className="h-9 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-45" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)', color: '#f59e0b' }}>
                          {batchAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                          Assign This Order
                        </button>
                      )}
                      {!focusedOrder.hasMixedStatus && focusedOrder.status === 'pending' && (
                        <button type="button" disabled={statusChanging === focusedOrder.logicalKey} onClick={() => handleStatusChange(focusedOrder, 'paid')} className="h-9 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-45" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.22)', color: '#22d3ee' }}>
                          {statusChanging === focusedOrder.logicalKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Mark Paid
                        </button>
                      )}
                      <button type="button" onClick={() => openEditWorkspace(focusedOrder)} className="h-9 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer" style={{ background: 'rgba(255,255,255,0.050)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.72)' }}>
                        <Edit2 className="w-3.5 h-3.5" />
                        {focusedOrder.source === 'budgetwise' ? 'Edit Item Accounts' : 'Edit'}
                      </button>
                      {focusedOrder.status === 'paid' && !focusedOrder.hasMixedStatus && (
                        <button type="button" disabled={!focusedReadyToComplete || statusChanging === focusedOrder.logicalKey} onClick={() => { void handleCompleteOrder(focusedOrder) }} className="h-9 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-45" style={{ background: 'rgba(52,211,153,0.09)', border: '1px solid rgba(52,211,153,0.22)', color: '#34d399' }} title={focusedCompletionBlocker ?? undefined}>
                          {statusChanging === focusedOrder.logicalKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {statusChanging === focusedOrder.logicalKey ? 'Completing...' : 'Complete Order'}
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={deletingOrderKeys.has(focusedOrder.logicalKey)}
                          className="h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-45"
                          style={{ background: 'rgba(255,255,255,0.050)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.56)' }}
                          aria-label="More order actions"
                        >
                          {deletingOrderKeys.has(focusedOrder.logicalKey) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem
                            onClick={() => { void handleDelete(focusedOrder) }}
                            className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                    {([
                      ['Total', focusedOrder.totalSellingPrice ? formatPHPCompact(focusedOrder.totalSellingPrice) : '—', 'rgba(196,181,253,0.92)'],
                      ['Items', `${focusedAssignedItems}/${focusedOrder.items.length} assigned`, 'rgba(255,255,255,0.70)'],
                      ['Required', formatRobux(focusedOrder.totalRobux), '#f59e0b'],
                      ['Unassigned', focusedAssignableItems.length.toLocaleString(), focusedAssignableItems.length > 0 ? '#f59e0b' : '#34d399'],
                      ['Remaining', focusedRemainingRobux === null ? 'No active' : formatRobux(focusedRemainingRobux), focusedRemainingRobux !== null && focusedRemainingRobux < 0 ? '#f43f5e' : '#34d399'],
                    ] as const).map(([label, value, color]) => (
                      <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.065)' }}>
                        <p className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</p>
                        <p className="text-[14px] font-black tabular-nums mt-1" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {focusedCompletionBlocker && (
                    <div className="rounded-xl px-3 py-2 mb-4 flex items-center justify-between gap-3" style={{ background: 'rgba(245,158,11,0.065)', border: '1px solid rgba(245,158,11,0.18)' }}>
                      <p className="text-[11px] font-bold flex items-center gap-1.5 min-w-0" style={{ color: '#f59e0b' }}>
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="min-w-0">{focusedCompletionBlocker}</span>
                      </p>
                      <button type="button" onClick={() => openEditWorkspace(focusedOrder)} className="h-7 px-2.5 rounded-lg text-[10px] font-black flex-shrink-0 cursor-pointer" style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.11)', color: 'rgba(255,255,255,0.72)' }}>
                        {focusedOrder.source === 'budgetwise' ? 'Assign Account' : 'Edit Order'}
                      </button>
                    </div>
                  )}
                  {focusedAssignmentIssue && !focusedCompletionBlocker && (
                    <div className="rounded-xl px-3 py-2 mb-4 text-[11px] font-bold" style={{ background: focusedRemainingRobux !== null && focusedRemainingRobux < 0 ? 'rgba(244,63,94,0.075)' : 'rgba(245,158,11,0.065)', border: `1px solid ${focusedRemainingRobux !== null && focusedRemainingRobux < 0 ? 'rgba(244,63,94,0.20)' : 'rgba(245,158,11,0.18)'}`, color: focusedRemainingRobux !== null && focusedRemainingRobux < 0 ? '#f43f5e' : '#f59e0b' }}>
                      {focusedAssignmentIssue}
                    </div>
                  )}
                  <div className="space-y-2">
                    {focusedOrder.items.map(item => {
                      const account = item.account ?? (item.robloxAccountId ? accounts.find(a => a.id === item.robloxAccountId) ?? null : null)
                      return (
                        <div key={item.id} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.065)' }}>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.86)' }}>{item.gamepassName}</p>
                            <p className="text-[10px] mt-0.5 truncate"><span style={getGameNameStyle(item.isDiscounted)}>{item.gameName ?? 'Unknown game'}</span><span style={{ color: 'rgba(255,255,255,0.38)' }}> / {formatRobux(item.robuxAmount)}</span></p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] font-bold" style={{ color: account ? '#34d399' : '#f59e0b' }}>{account ? account.username : 'Unassigned'}</p>
                            <p className="text-[10px] tabular-nums mt-0.5" style={{ color: 'rgba(255,255,255,0.34)' }}>{formatPHP(item.sellingPrice)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty-shop-order" initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={quickMotion} className="p-10 text-center">
                  {activeOrdersSorted.length === 0 ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-3" style={{ color: '#34d399', opacity: 0.55 }} />
                      <p className="text-[15px] font-black mb-1" style={{ color: 'rgba(255,255,255,0.74)' }}>Queue clear</p>
                      <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.40)' }}>No active orders remaining.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold mb-3" style={{ color: 'rgba(255,255,255,0.54)' }}>No active Shop order selected.</p>
                      <button type="button" onClick={() => { setCenterMode('manual'); ws.openOrCreate() }} className="h-9 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.72)' }}>
                        <Plus className="w-3.5 h-3.5" />
                        Create Manual Order
                      </button>
                    </>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
            </main>

            {accountDockOpen && (
              <button
                type="button"
                aria-label="Close account switcher"
                onClick={() => setAccountDockOpen(false)}
                className="fixed inset-0 z-30 xl:hidden cursor-default"
                style={{ background: 'rgba(0,0,0,0.32)' }}
              />
            )}
            <aside className={`${accountDockOpen || mobilePanel === 'accounts' ? 'fixed right-3 top-20 bottom-4 z-40 w-[min(340px,calc(100vw-1.5rem))]' : 'hidden'} xl:block xl:static xl:sticky xl:top-20 rounded-2xl overflow-hidden min-w-0`} style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.075)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Account In Use</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>Selected for fulfillment. Status remains the account status.</p>
              </div>
              <div className="p-3 xl:p-4 space-y-4 overflow-y-auto max-h-full">
                {activeAccount ? (
                  <motion.div key={activeAccount.id} layout={!prefersReducedMotion} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={quickMotion} className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.055)', border: '1px solid rgba(52,211,153,0.20)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <RobloxAvatar username={activeAccount.username} userId={activeAccount.roblox_user_id} size={46} glow="none" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-black truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>{activeAccount.username}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ color: '#34d399', background: 'rgba(52,211,153,0.13)', border: '1px solid rgba(52,211,153,0.28)' }}>IN USE</span>
                          <AccountStatusMini status={activeAccount.status} />
                          {activeAccount.is_plus_account && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' }}>PLUS</span>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['Current', activeAccount.current_robux ?? 0, 'rgba(255,255,255,0.74)'],
                        ['Reserved', activeAccount.reserved_robux ?? 0, '#f59e0b'],
                        ['Available', getAvailableRobux(activeAccount), '#34d399'],
                      ] as const).map(([label, value, color]) => (
                        <div key={label} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.34)' }}>{label}</p>
                          <p className="text-[13px] font-black tabular-nums mt-1" style={{ color }}>{formatRobux(value)}</p>
                        </div>
                      ))}
                    </div>
                    {activeAccount.chrome_profile && <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.38)' }}>Chrome: {activeAccount.chrome_profile}</p>}
                  </motion.div>
                ) : (
                  <div className="rounded-2xl p-4 text-[12px]" style={{ background: 'rgba(245,158,11,0.055)', border: '1px solid rgba(245,158,11,0.18)', color: '#f59e0b' }}>Choose an account below to start assigning.</div>
                )}
                <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)' }}>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>Active Available</p>
                      <p className="text-[15px] font-black tabular-nums" style={{ color: activeAccount ? '#34d399' : 'rgba(255,255,255,0.32)' }}>{formatRobux(activeAvailableRobux)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>Selected Requirement</p>
                      <p className="text-[15px] font-black tabular-nums" style={{ color: selectedRequiredRobux > 0 ? '#f59e0b' : 'rgba(255,255,255,0.32)' }}>{formatRobux(selectedRequiredRobux)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: selectedRemainingRobux < 0 ? 'rgba(244,63,94,0.08)' : 'rgba(52,211,153,0.055)', border: `1px solid ${selectedRemainingRobux < 0 ? 'rgba(244,63,94,0.22)' : 'rgba(52,211,153,0.16)'}` }}>
                      <p className="text-[10px] font-black uppercase" style={{ color: selectedRemainingRobux < 0 ? '#f43f5e' : '#34d399' }}>Remaining After</p>
                      <p className="text-[17px] font-black tabular-nums" style={{ color: selectedRemainingRobux < 0 ? '#f43f5e' : '#34d399' }}>{formatRobux(selectedRemainingRobux)}</p>
                    </div>
                  </div>
                  {selectedAssignmentIssue && <p className="text-[11px] mb-2 font-bold" style={{ color: selectedRemainingRobux < 0 ? '#f43f5e' : '#f59e0b' }}>{selectedAssignmentIssue}</p>}
                  {batchResults && batchResults.some(r => !r.assignOk || !r.reserveOk) && (
                    <div className="mb-2 rounded-lg p-2 space-y-1" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)' }}>
                      {batchResults.filter(r => !r.assignOk || !r.reserveOk).slice(0, 3).map(result => <p key={result.itemId} className="text-[10px]" style={{ color: '#f43f5e' }}>{result.gamepassName}: {result.error}</p>)}
                    </div>
                  )}
                  {showBatchAssignAction ? (
                    <button type="button" disabled={batchAssigning || !activeAccount || selectedAssignableItems.length === 0 || selectedIncompatibleCount > 0 || selectedRemainingRobux < 0} onClick={handleAssignSelectedToActiveAccount} className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[12px] font-black disabled:opacity-45 transition-opacity cursor-pointer" style={{ background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.30)', color: '#f59e0b' }}>
                      {batchAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Assign {selectedOrders.length} Selected
                    </button>
                  ) : selectedOrders.length === 1 ? (
                    <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.36)' }}>Checked order is open in the center.</p>
                  ) : (
                    <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.34)' }}>Check orders in the queue for batch assignment.</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.34)' }}>Switch Account</p>
                  <p className="text-[10px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.34)' }}>{switchAccountList.length}</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.30)' }} />
                  <input type="text" value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Search accounts" className="w-full h-10 pl-8 pr-3 rounded-xl text-[12px] outline-none" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)' }} />
                </div>
                <div className="space-y-2">
                  {switchAccountList.length === 0 && (
                    <div className="rounded-xl px-3 py-4 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.025)' }}>No other accounts match.</div>
                  )}
                  {switchAccountList.slice(0, 12).map(account => {
                    const available = getAvailableRobux(account)
                    return (
                      <button key={account.id} type="button" onClick={() => { setActiveAccountId(account.id); setAccountDockOpen(false) }} className="w-full rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.026)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <RobloxAvatar username={account.username} userId={account.roblox_user_id} size={32} glow="none" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-black truncate" style={{ color: 'rgba(255,255,255,0.86)' }}>{account.username}</span>
                          <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <StatusBadge status={account.status} />
                            {account.is_plus_account && <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.18)' }}>PLUS</span>}
                          </span>
                        </span>
                        <span className="text-right flex-shrink-0"><span className="block text-[12px] font-black tabular-nums" style={{ color: available < 100 ? '#f43f5e' : available < 500 ? '#f59e0b' : '#34d399' }}>{formatRobux(available)}</span><span className="block text-[9px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.30)' }}>avail</span></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          § 01 · ORDER OPERATIONS — headline + Create Order / Statistics
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="hidden"
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
        className="hidden"
        style={{ paddingTop: '6rem', paddingBottom: '6rem' }}
      >
        <Blob color="rgba(245,158,11,0.07)" width={600} height={600} style={{ top: -80, right: -200 }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="02" label="Action Center" />

          <motion.div
            className="mb-6 max-w-2xl"
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

          {/* ── Action filter chips ── */}
          {activeOrdersSorted.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-6">
              {(
                [
                  { value: 'all',        label: 'All',       count: actionFilterCounts.all,        color: 'rgba(255,255,255,0.50)' },
                  { value: 'unassigned', label: 'Unassigned',count: actionFilterCounts.unassigned,  color: '#f59e0b' },
                  { value: 'ready',      label: 'Ready',     count: actionFilterCounts.ready,       color: '#34d399' },
                  { value: 'pending',    label: 'Pending',   count: actionFilterCounts.pending,     color: '#22d3ee' },
                  { value: 'stalled',    label: 'Stalled',   count: actionFilterCounts.stalled,     color: '#f43f5e' },
                ] as { value: ActionFilter; label: string; count: number; color: string }[]
              ).map(chip => {
                const isActive = actionFilter === chip.value
                const hasAlert = !isActive && chip.count > 0 && (chip.value === 'unassigned' || chip.value === 'stalled')
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setActionFilter(chip.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                      background: isActive ? `${chip.color}18` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? `${chip.color}40` : 'rgba(255,255,255,0.09)'}`,
                      color: isActive ? chip.color : hasAlert ? chip.color : 'rgba(255,255,255,0.42)',
                    }}
                  >
                    {chip.label}
                    <span
                      className="text-[10px] font-bold tabular-nums px-1 py-0.5 rounded-md"
                      style={{
                        background: isActive ? `${chip.color}20` : 'rgba(255,255,255,0.06)',
                        color: isActive ? chip.color : hasAlert ? chip.color : 'rgba(255,255,255,0.30)',
                      }}
                    >
                      {chip.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

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
          ) : filteredActiveOrders.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)' }}
            >
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                No orders match this filter.
              </p>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              variants={fastStagger}
              initial="initial"
              animate="animate"
            >
              {filteredActiveOrders.map((lo) => {
                const ageHours = (nowMs - new Date(lo.createdAt).getTime()) / 3_600_000
                const ageColor   = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'rgba(255,255,255,0.35)'
                const isStale    = ageHours > 48
                const action     = lo.hasMixedStatus ? null : STATUS_ACTION[lo.status]
                const nextStatus = lo.hasMixedStatus ? null : STATUS_NEXT[lo.status]
                const isBusy     = statusChanging === lo.logicalKey || deletingOrderKeys.has(lo.logicalKey)
                const firstItem  = lo.items[0]
                const readyToComplete = isLogicalOrderReady(lo)

                return (
                  <motion.div
                    key={lo.logicalKey}
                    variants={fastStaggerItem}
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
                      {readyToComplete && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); void handleCompleteOrder(lo) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={{ background: 'rgba(52,211,153,0.09)', color: '#34d399', border: '1px solid rgba(52,211,153,0.22)' }}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 style={{ width: 11, height: 11 }} />}
                          {isBusy ? 'Completing...' : 'Complete Order'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditWorkspace(lo) }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}
                        title={lo.source === 'budgetwise' ? 'Assign Account' : 'Edit Order'}
                      >
                        <Edit2 style={{ width: 12, height: 12 }} />
                      </button>
                      {action && nextStatus && nextStatus !== 'completed' && (
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
                             <DropdownMenuItem onClick={() => { void handleStatusChange(lo, 'refunded') }} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                              <X className="w-3.5 h-3.5" /> Mark Refunded
                            </DropdownMenuItem>
                          )}
                           {lo.status !== 'cancelled' && (
                             <DropdownMenuItem onClick={() => { void handleStatusChange(lo, 'cancelled') }} className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400">
                              <X className="w-3.5 h-3.5" /> Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-border/50" />
                           <DropdownMenuItem onClick={() => { void handleDelete(lo) }} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
                             <Trash2 className="w-3.5 h-3.5" /> Delete Order
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
        onDelete={(lo) => { void handleDelete(lo) }}
      />

      <AnimatePresence>
        {bwAssignOrder && (
          <BWAccountAssignDialog
            key={bwAssignOrder.logicalKey}
            order={bwAssignOrder}
            accounts={accounts}
            rawOrders={rawOrders}
            onClose={() => setBwAssignOrder(null)}
            onSave={handleBWAssignSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {finalizeOpen && (
          <FinalizeOrdersDialog
            candidates={finalizeCandidates}
            phase={finalizePhase}
            progress={finalizeProgress}
            finalizing={finalizing}
            onConfirm={() => { void runFinalize() }}
            onClose={closeFinalizeDialog}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MULTI-WORKSPACE OVERLAY — VS Code-style tabbed order drafts
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {false && ws.open && (
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
                          key={ws.activeWorkspace!.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.10 }}
                        >
                          <WorkspaceEditor
                            workspace={ws.activeWorkspace!}
                            editOrder={
                              ws.activeWorkspace!.editOrderId
                                ? rawOrdersMap.get(ws.activeWorkspace!.editOrderId!) ?? null
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
