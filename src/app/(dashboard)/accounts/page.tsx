'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import StatCard from '@/components/shared/StatCard'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import AccountCard from '@/components/accounts/AccountCard'
import AccountModal, { parseRobloxUserId } from '@/components/accounts/AccountModal'
import LiquidationForecast from '@/components/accounts/LiquidationForecast'
import CapitalReadinessTracker from '@/components/accounts/CapitalReadinessTracker'
import RestockAdvisor from '@/components/accounts/RestockAdvisor'
import {
  RobloxAccount, ReservationWithDetails, OrderWithItems,
  TransferLog, TransferReservation, AllowanceSummary, InstantSendPriceTier, AccountBatch,
} from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { getAvailableRobux, isDepleted, isPlusReminderActive, MIN_SELECTABLE_ROBUX, getAgingState, getAgingRemainingMs, INVENTORY_DEADLINE_DAYS } from '@/lib/utils/accounts'
import { calculateBusinessValue, classifyPurchase } from '@/lib/utils/capital'
import { formatRobux } from '@/lib/utils/pricing'
import { getStartOfTodayISO, DAILY_TRANSFER_LIMIT } from '@/lib/utils/transfers'
import ReserveTransferDialog from '@/components/accounts/ReserveTransferDialog'
import LogTransferDialog from '@/components/accounts/LogTransferDialog'
import LogInstantSendSaleDialog from '@/components/accounts/LogInstantSendSaleDialog'
import PriceTierManager, { DefaultPriceTier } from '@/components/accounts/PriceTierManager'
import {
  Coins, Wallet, Users, Lock, ChevronDown, X,
  CheckSquare, RefreshCw, Archive, Zap, ArrowUpDown, Sparkles, BadgeCheck, Layers,
  MousePointer2, Tag, Palette, Eraser, MoreHorizontal, AlertTriangle, Timer, Search,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { springToggle, fadeUpVariants, cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import { SkeletonChart, SkeletonCard } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { useUrlState } from '@/hooks/useUrlState'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BATCH_PALETTE, BatchColorKey, getBatchColor } from '@/lib/constants/batches'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

type StatsMode = 'all' | 'selected'
type PageTab = 'accounts' | 'planning'
const PAGE_TABS: readonly PageTab[] = ['accounts', 'planning']

// Daily Transfer Tracker — every account has a 1000 R$/day instant-transfer
// allowance. sent_today / reserved / available all come from the
// get_transfer_allowance_summary RPC (server-aggregated — transfer_logs is
// permanent/append-only and will keep growing, so it's never summed client-side).
type TransferFilter = 'all' | 'canSend' | 'hasReservations' | 'fullyReserved' | 'limitReached'
const TRANSFER_FILTERS: readonly { value: TransferFilter; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'canSend',          label: 'Can Send Today' },
  { value: 'hasReservations',  label: 'Has Reservations' },
  { value: 'fullyReserved',    label: 'Fully Reserved' },
  { value: 'limitReached',     label: 'Daily Limit Reached' },
]

type TransferSort = 'none' | 'mostAvailable' | 'leastAvailable' | 'mostReserved' | 'mostRecentlyUsed'
const TRANSFER_SORTS: readonly { value: TransferSort; label: string }[] = [
  { value: 'none',             label: 'Default Order' },
  { value: 'mostAvailable',    label: 'Most Available Allowance' },
  { value: 'leastAvailable',   label: 'Least Available Allowance' },
  { value: 'mostReserved',     label: 'Most Reserved' },
  { value: 'mostRecentlyUsed', label: 'Most Recently Used' },
]

type AccountSort = 'robux' | 'name' | 'status' | 'batch' | 'expiring'
const ACCOUNT_SORTS: readonly { value: AccountSort; label: string }[] = [
  { value: 'robux',    label: 'Sort by Robux' },
  { value: 'name',     label: 'Sort by Name' },
  { value: 'status',   label: 'Sort by Status' },
  { value: 'batch',    label: 'Sort by Batch' },
  { value: 'expiring', label: 'Expiring Soon' },
]

type BatchDialogState =
  | { mode: 'assign' }
  | { mode: 'rename'; batch: AccountBatch }
  | { mode: 'color'; batch: AccountBatch }
  | null

type DragSelectionBox = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

// Roblox Discount Active — purely operational tagging, never read by any
// inventory/profit/capital/forecast calculation.
type DiscountFilter = 'all' | 'active' | 'inactive'
const DISCOUNT_FILTERS: readonly { value: DiscountFilter; label: string }[] = [
  { value: 'all',      label: 'All Accounts' },
  { value: 'active',   label: 'Discount Active' },
  { value: 'inactive', label: 'No Active Discount' },
]

type DiscountSort = 'none' | 'first' | 'last'
const DISCOUNT_SORTS: readonly { value: DiscountSort; label: string }[] = [
  { value: 'none',  label: 'No Discount Sort' },
  { value: 'first', label: 'Discount Active First' },
  { value: 'last',  label: 'Discount Active Last' },
]

// Roblox Plus — purely operational tagging too; the actual cost discount
// lives in getEffectiveCostRate (pricing.ts), not here.
type PlusFilter = 'all' | 'plus' | 'nonPlus' | 'needsAttention'
const PLUS_FILTERS: readonly { value: PlusFilter; label: string }[] = [
  { value: 'all',            label: 'All Accounts' },
  { value: 'plus',           label: 'Plus Accounts' },
  { value: 'nonPlus',        label: 'Non-Plus Accounts' },
  { value: 'needsAttention', label: 'Needs Plus Attention' },
]

const LS_SELECTED = 'xob-selected-accounts'
const LS_MODE     = 'xob-stats-mode'

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

function AccountsPageContent() {
  const [accounts, setAccounts]         = useState<RobloxAccount[]>([])
  const [batches, setBatches]           = useState<AccountBatch[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [completedOrders, setCompletedOrders] = useState<OrderWithItems[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editAccount, setEditAccount]   = useState<RobloxAccount | null>(null)
  const [resExpanded, setResExpanded]   = useState(false)
  const [depletedExpanded, setDepletedExpanded] = useState(false)
  const [pageTab, setPageTab]           = useUrlState<PageTab>('tab', 'accounts', PAGE_TABS)
  const [refreshingAvatars, setRefreshingAvatars] = useState(false)

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [statsMode, setStatsMode]       = useState<StatsMode>('all')
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [dragSelection, setDragSelection] = useState<DragSelectionBox | null>(null)

  // ── Daily Transfer Tracker state ────────────────────────────────────────────
  const [allowanceByAccount, setAllowanceByAccount] = useState<Map<string, AllowanceSummary>>(new Map())
  const [historyByAccount, setHistoryByAccount] = useState<Map<string, TransferLog[]>>(new Map())
  const [transferQueueByAccount, setTransferQueueByAccount] = useState<Map<string, TransferReservation[]>>(new Map())
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all')
  const [transferSort, setTransferSort] = useState<TransferSort>('none')
  const [accountSort, setAccountSort] = useState<AccountSort>('robux')
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all')
  const [discountSort, setDiscountSort] = useState<DiscountSort>('none')
  const [plusFilter, setPlusFilter] = useState<PlusFilter>('all')
  const [chromeProfileFilter, setChromeProfileFilter] = useState<string>('all')
  const [accountSearch, setAccountSearch] = useState('')
  const [reserveDialogAccount, setReserveDialogAccount] = useState<RobloxAccount | null>(null)
  const [logDialogAccount, setLogDialogAccount] = useState<RobloxAccount | null>(null)
  const [editingTransferLog, setEditingTransferLog] = useState<TransferLog | null>(null)

  // ── Instant Send Sales state ────────────────────────────────────────────────
  const [priceTiers, setPriceTiers] = useState<InstantSendPriceTier[]>([])
  const [saleDialogAccount, setSaleDialogAccount] = useState<RobloxAccount | null>(null)
  const [priceTierManagerOpen, setPriceTierManagerOpen] = useState(false)
  const [batchDialog, setBatchDialog] = useState<BatchDialogState>(null)
  const [batchName, setBatchName] = useState('')
  const [batchColor, setBatchColor] = useState<BatchColorKey>('blue')
  const [batchSaving, setBatchSaving] = useState(false)

  // Shared clock — all aging countdowns derive from this single Date.
  // Updates once per minute; one interval for the whole page.
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const toast = useToast()
  const confirm = useConfirm()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const dragBaseIdsRef = useRef<Set<string>>(new Set())
  const selectionOrderRef = useRef<string[]>([])

  // Every account has a row from get_transfer_allowance_summary (it LEFT JOINs
  // from roblox_accounts), so this default is just a defensive fallback.
  // useCallback so it has a stable identity across renders when the map
  // itself hasn't changed — lets the useMemos below depend on it safely.
  const getAllowance = useCallback((accountId: string): AllowanceSummary => {
    return allowanceByAccount.get(accountId) ?? {
      roblox_account_id: accountId, sent_today: 0, reserved: 0, lifetime_sent: 0, available: DAILY_TRANSFER_LIMIT, last_sent_at: null,
    }
  }, [allowanceByAccount])

  // Persist & restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_SELECTED)
      if (saved) setSelectedIds(new Set(JSON.parse(saved) as string[]))
      const savedMode = localStorage.getItem(LS_MODE)
      if (savedMode === 'all' || savedMode === 'selected') setStatsMode(savedMode)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_SELECTED, JSON.stringify([...selectedIds])) } catch {}
  }, [selectedIds])

  useEffect(() => {
    try { localStorage.setItem(LS_MODE, statsMode) } catch {}
  }, [statsMode])

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const startOfToday = getStartOfTodayISO()
    const [accRes, batchRes, resRes, ordersRes, walletRes, allowanceRes, historyRes, queueRes, tiersRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('account_batches').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').eq('status', 'completed'),
      supabase.rpc('get_wallet_balance'),
      supabase.rpc('get_transfer_allowance_summary', { p_start_of_today: startOfToday }),
      supabase.from('transfer_logs').select('*').gte('sent_at', startOfToday).order('sent_at', { ascending: false }),
      supabase.from('transfer_reservations').select('*').eq('status', 'reserved').order('created_at', { ascending: false }),
      supabase.from('instant_send_price_tiers').select('*').order('robux_amount', { ascending: true }),
    ])
    if (!accRes.error && accRes.data) setAccounts(accRes.data)
    if (!batchRes.error && batchRes.data) setBatches(batchRes.data)
    if (!resRes.error && resRes.data)  setReservations(resRes.data as ReservationWithDetails[])
    if (!ordersRes.error && ordersRes.data) setCompletedOrders(ordersRes.data as OrderWithItems[])
    if (!walletRes.error && walletRes.data != null) setWalletBalance(Number(walletRes.data))
    if (!allowanceRes.error && allowanceRes.data) {
      setAllowanceByAccount(new Map((allowanceRes.data as AllowanceSummary[]).map(r => [r.roblox_account_id, r])))
    }
    if (!historyRes.error && historyRes.data) {
      const map = new Map<string, TransferLog[]>()
      for (const log of historyRes.data as TransferLog[]) {
        const list = map.get(log.roblox_account_id) ?? []
        list.push(log)
        map.set(log.roblox_account_id, list)
      }
      setHistoryByAccount(map)
    }
    if (!queueRes.error && queueRes.data) {
      const map = new Map<string, TransferReservation[]>()
      for (const res of queueRes.data as TransferReservation[]) {
        const list = map.get(res.roblox_account_id) ?? []
        list.push(res)
        map.set(res.roblox_account_id, list)
      }
      setTransferQueueByAccount(map)
    }
    if (!tiersRes.error && tiersRes.data) setPriceTiers(tiersRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSave(data: {
    username: string; current_robux: number; reserved_robux: number
    robux_cost_rate: number; status: 'active' | 'inactive' | 'banned' | 'low'; notes?: string
    roblox_profile?: string
    purchase_cost?: number; supplier?: string; purchase_date?: string
    has_active_discount?: boolean
    has_super_discount?: boolean
    is_plus_account?: boolean
    chrome_profile?: string
  }) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Manual profile link wins; otherwise auto-resolve the avatar from the username
    let robloxUserId = parseRobloxUserId(data.roblox_profile)
    if (!robloxUserId && data.username) {
      try {
        const res = await fetch(`/api/roblox-lookup?username=${encodeURIComponent(data.username)}`)
        if (res.ok) robloxUserId = (await res.json()).userId ?? null
      } catch {}
    }

    // A purchase cost on a new account derives its cost basis directly —
    // Purchase Cost ÷ Robux Acquired × 1,000 — instead of asking for the rate twice.
    const purchaseCost = data.purchase_cost ?? 0
    const robuxCostRate = !editAccount && purchaseCost > 0 && data.current_robux > 0
      ? (purchaseCost / data.current_robux) * 1000
      : data.robux_cost_rate ?? 0

    if (editAccount) {
      // Inventory fields (current_robux, reserved_robux, robux_cost_rate) are read-only
      // once an account exists — they can only change via the order financial engine or
      // adjust_account_field (handleAdjust below), both of which leave an audit trail.
      const wasPlus   = editAccount.is_plus_account
      const isNowPlus = data.is_plus_account ?? false
      const plusTimestamps: Record<string, string | null> = {}
      if (!wasPlus && isNowPlus) {
        plusTimestamps.plus_enabled_at = new Date().toISOString()
        plusTimestamps.plus_reminder_dismissed_at = null
      } else if (wasPlus && !isNowPlus) {
        plusTimestamps.plus_enabled_at = null
        plusTimestamps.plus_reminder_dismissed_at = null
      }
      const payload = { username: data.username, status: data.status, notes: data.notes ?? null, roblox_user_id: robloxUserId, has_active_discount: data.has_active_discount ?? false, has_super_discount: data.has_super_discount ?? false, is_plus_account: isNowPlus, chrome_profile: data.chrome_profile?.trim() || null, ...plusTimestamps }
      await supabase.from('roblox_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editAccount.id)
    } else {
      const isNowPlus = data.is_plus_account ?? false
      const plusTimestamps = isNowPlus
        ? { plus_enabled_at: new Date().toISOString(), plus_reminder_dismissed_at: null as string | null }
        : {}
      const payload = { username: data.username, current_robux: data.current_robux, reserved_robux: data.reserved_robux, robux_cost_rate: robuxCostRate, status: data.status, notes: data.notes ?? null, roblox_user_id: robloxUserId, has_active_discount: data.has_active_discount ?? false, has_super_discount: data.has_super_discount ?? false, is_plus_account: isNowPlus, chrome_profile: data.chrome_profile?.trim() || null, ...plusTimestamps }
      const { data: inserted } = await supabase.from('roblox_accounts').insert({ ...payload, user_id: user.id }).select('id').single()

      // Phase 2: every new stock purchase automatically logs a Capital Event
      if (inserted && purchaseCost > 0) {
        const businessValueBefore = calculateBusinessValue(accounts, walletBalance)
        await supabase.from('capital_events').insert({
          user_id: user.id,
          accounts_purchased: 1,
          robux_acquired: data.current_robux,
          cost: purchaseCost,
          business_value_before: businessValueBefore,
          supplier: data.supplier?.trim() || null,
          roblox_account_id: inserted.id,
          created_at: data.purchase_date ? new Date(data.purchase_date).toISOString() : undefined,
          ...classifyPurchase(businessValueBefore, purchaseCost),
        })
      }
    }
    setSaving(false)
    setModalOpen(false)
    const wasEdit = !!editAccount
    setEditAccount(null)
    fetchData()
    toast.success(wasEdit ? 'Account updated.' : 'Account added.')
  }

  // The only path allowed to change current_robux/reserved_robux/robux_cost_rate on an
  // existing account — adjust_account_field() records who/when/old/new in
  // account_adjustments (and a transactions row for current_robux changes).
  async function handleAdjust(field: 'current_robux' | 'reserved_robux' | 'robux_cost_rate', newValue: number, reason: string) {
    if (!editAccount) return
    const { error } = await supabase.rpc('adjust_account_field', {
      p_account_id: editAccount.id,
      p_field: field,
      p_new_value: newValue,
      p_reason: reason,
    })
    if (error) throw error
    setEditAccount(prev => prev ? { ...prev, [field]: newValue } : prev)
    fetchData()
    toast.success('Adjustment recorded with audit trail.')
  }

  // Daily Transfer Tracker — every mutation goes through a server-side RPC
  // that locks the account row and re-validates the 1000 R$ ceiling, so two
  // concurrent actions on the same account can't both squeeze past a stale
  // check. Refetch-after-mutation rather than optimistic local state, since
  // a single action here can move numbers across three different views at
  // once (allowance summary, history list, reservation queue). Each handler
  // returns its promise so AccountCard can show a per-button spinner while
  // it's in flight rather than a blanket page-level busy flag.
  async function handleRecordTransfer(accountId: string, amount: number) {
    const { error } = await supabase.rpc('record_transfer', {
      p_account_id: accountId, p_amount: amount, p_start_of_today: getStartOfTodayISO(),
    })
    if (error) { toast.error(error.message || 'Could not record the transfer.'); return }
    toast.success(`+${formatRobux(amount)} sent.`)
    fetchData()
  }

  function handleOpenReserveDialog(account: RobloxAccount) {
    setReserveDialogAccount(account)
  }

  async function handleCreateReservation(data: {
    amount: number; customerLabel?: string; note?: string; scheduledFor?: string
  }) {
    if (!reserveDialogAccount) return
    const { error } = await supabase.rpc('create_transfer_reservation', {
      p_account_id: reserveDialogAccount.id,
      p_amount: data.amount,
      p_customer_label: data.customerLabel || null,
      p_note: data.note || null,
      p_scheduled_for: data.scheduledFor || null,
      p_start_of_today: getStartOfTodayISO(),
    })
    if (error) { toast.error(error.message || 'Could not create the reservation.'); return }
    toast.success('Reservation created.')
    setReserveDialogAccount(null)
    fetchData()
  }

  async function handleFulfillReservation(reservationId: string) {
    const { error } = await supabase.rpc('fulfill_transfer_reservation', { p_reservation_id: reservationId })
    if (error) { toast.error(error.message || 'Could not fulfill the reservation.'); return }
    toast.success('Reservation fulfilled — moved to sent.')
    fetchData()
  }

  async function handleCancelReservation(reservationId: string) {
    const ok = await confirm({
      title: 'Cancel this reservation?',
      description: 'The reserved amount will be released back into the available allowance.',
      confirmLabel: 'Cancel Reservation',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.rpc('cancel_transfer_reservation', { p_reservation_id: reservationId })
    if (error) { toast.error(error.message || 'Could not cancel the reservation.'); return }
    toast.success('Reservation cancelled.')
    fetchData()
  }

  // Logging/editing a transfer after the fact — backdated entries are
  // validated against that day's other logs only (not live reservations,
  // which have nothing to do with a day that's already passed).
  function handleOpenLogDialog(account: RobloxAccount) {
    setLogDialogAccount(account)
    setEditingTransferLog(null)
  }

  function handleOpenEditLog(account: RobloxAccount, log: TransferLog) {
    setLogDialogAccount(account)
    setEditingTransferLog(log)
  }

  async function handleSubmitLogTransfer(data: { amount: number; sentAt: string; note?: string }) {
    if (!logDialogAccount) return
    const { error } = editingTransferLog
      ? await supabase.rpc('update_transfer_log', {
          p_log_id: editingTransferLog.id, p_amount: data.amount, p_sent_at: data.sentAt, p_note: data.note || null,
        })
      : await supabase.rpc('record_transfer', {
          p_account_id: logDialogAccount.id, p_amount: data.amount, p_sent_at: data.sentAt, p_note: data.note || null,
        })
    if (error) { toast.error(error.message || 'Could not save the transfer.'); return }
    toast.success(editingTransferLog ? 'Transfer updated.' : 'Transfer logged.')
    setLogDialogAccount(null)
    setEditingTransferLog(null)
    fetchData()
  }

  async function handleDeleteTransferLog(log: TransferLog) {
    const ok = await confirm({
      title: 'Delete this transfer entry?',
      description: `Removes the ${formatRobux(log.amount)} entry from the day's record. This cannot be undone.`,
      confirmLabel: 'Delete Entry',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('transfer_logs').delete().eq('id', log.id)
    if (error) { toast.error(error.message || 'Could not delete the entry.'); return }
    toast.success('Entry deleted.')
    fetchData()
  }

  // Instant Send Sales — a customer's total purchase, decomposed into priced
  // tier chunks and routed through record_transfer per chunk (so the daily/
  // lifetime ceilings and the current_robux-deduction trigger apply exactly
  // as they would for any other logged transfer — no separate Robux
  // deduction here). Credits the wallet once for the combined price.
  function handleOpenSaleDialog(account: RobloxAccount) {
    setSaleDialogAccount(account)
  }

  async function handleSubmitSale(data: { chunks: { amount: number; sentAt: string }[]; customerLabel?: string }) {
    if (!saleDialogAccount) return
    const { error } = await supabase.rpc('log_instant_send_sale', {
      p_account_id: saleDialogAccount.id,
      p_chunks: data.chunks.map(c => ({ amount: c.amount, sent_at: c.sentAt })),
      p_customer_label: data.customerLabel || null,
      p_start_of_today: getStartOfTodayISO(),
    })
    if (error) { toast.error(error.message || 'Could not log this sale.'); return }
    toast.success('Sale logged — wallet credited.')
    setSaleDialogAccount(null)
    fetchData()
  }

  async function handleAddPriceTier(data: { robux_amount: number; price: number; profit: number; status?: string }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('instant_send_price_tiers').insert({
      user_id: user.id, robux_amount: data.robux_amount, price: data.price, profit: data.profit, status: data.status,
    })
    if (error) { toast.error(error.message || 'Could not add this tier.'); return }
    toast.success('Tier added.')
    fetchData()
  }

  async function handleDeletePriceTier(id: string) {
    const { error } = await supabase.from('instant_send_price_tiers').delete().eq('id', id)
    if (error) { toast.error(error.message || 'Could not delete this tier.'); return }
    fetchData()
  }

  async function handleLoadDefaultTiers(missing: DefaultPriceTier[]) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('instant_send_price_tiers').insert(
      missing.map(t => ({ user_id: user.id, robux_amount: t.robux_amount, price: t.price, profit: t.profit, status: t.status }))
    )
    if (error) { toast.error(error.message || 'Could not load defaults.'); return }
    toast.success(`Loaded ${missing.length} default tier${missing.length !== 1 ? 's' : ''}.`)
    fetchData()
  }

  // One-time backfill: resolve avatars for accounts that don't have one yet
  async function refreshAvatars() {
    const missing = accounts.filter(a => !a.roblox_user_id)
    if (missing.length === 0) return
    setRefreshingAvatars(true)
    let resolved = 0
    for (const account of missing) {
      try {
        const res = await fetch(`/api/roblox-lookup?username=${encodeURIComponent(account.username)}`)
        if (!res.ok) continue
        const { userId } = await res.json()
        if (userId) {
          await supabase.from('roblox_accounts').update({ roblox_user_id: userId }).eq('id', account.id)
          resolved++
        }
      } catch {}
    }
    setRefreshingAvatars(false)
    fetchData()
    toast.success(resolved > 0 ? `Resolved ${resolved} avatar${resolved !== 1 ? 's' : ''}.` : 'No new avatars found.')
  }

  async function handleDelete(id: string) {
    const account = accounts.find(a => a.id === id)
    const ok = await confirm({
      title: `Delete ${account?.username ?? 'this account'}?`,
      description: 'Any remaining Robux balance will be written off with an audit record. Orders and transaction history tied to this account are preserved.',
      confirmLabel: 'Delete Account',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.rpc('delete_roblox_account', { p_account_id: id })
    if (error) { toast.error(error.message); return }
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    fetchData()
    toast.success('Account deleted.')
  }

  async function handleDismissPlusReminder(accountId: string) {
    const ok = await confirm({
      title: 'Turn Off Plus Auto-Renewal',
      description: 'Have you already disabled Roblox Plus auto-renewal on this account?',
      confirmLabel: 'Yes, I Turned It Off',
    })
    if (!ok) return
    const { error } = await supabase
      .from('roblox_accounts')
      .update({ plus_reminder_dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', accountId)
    if (error) { toast.error(error.message || 'Could not dismiss the reminder.'); return }
    fetchData()
  }

  async function handleAcknowledgeSpent(accountId: string) {
    const ts = new Date().toISOString()
    const { error } = await supabase
      .from('roblox_accounts')
      .update({ spent_acknowledged_at: ts, updated_at: ts })
      .eq('id', accountId)
    if (error) { toast.error(error.message || 'Could not record acknowledgement.'); return }
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, spent_acknowledged_at: ts } : a))
  }

  function handleEdit(account: RobloxAccount) {
    setEditAccount(account)
    setModalOpen(true)
  }

  // ── Selection actions ─────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setLastSelectedId(id)
  }

  function selectOnly(id: string) {
    setSelectedIds(new Set([id]))
    setLastSelectedId(id)
  }

  function selectRange(toId: string) {
    const order = selectionOrderRef.current
    const fromId = lastSelectedId && order.includes(lastSelectedId) ? lastSelectedId : order[0]
    if (!fromId) { selectOnly(toId); return }
    const fromIndex = order.indexOf(fromId)
    const toIndex = order.indexOf(toId)
    if (fromIndex < 0 || toIndex < 0) { selectOnly(toId); return }
    const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
    setSelectedIds(new Set(order.slice(start, end + 1)))
    setLastSelectedId(toId)
  }

  function selectAll() {
    const ids = selectionOrderRef.current
    const usableIds = ids.filter(id => {
      const account = accounts.find(a => a.id === id)
      return account ? getAvailableRobux(account) >= MIN_SELECTABLE_ROBUX : false
    })
    setSelectedIds(new Set(usableIds))
    setLastSelectedId(usableIds[0] ?? null)
    const skippedCount = ids.length - usableIds.length
    if (skippedCount > 0) {
      toast.success(
        `Selected ${usableIds.length} usable account${usableIds.length !== 1 ? 's' : ''}. ${skippedCount} account${skippedCount !== 1 ? 's' : ''} with less than 100 Robux were skipped.`
      )
    }
  }

  function clearAll() {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }

  function selectActive() {
    const ids = accounts.filter(a => a.status === 'active').map(a => a.id)
    setSelectedIds(new Set(ids))
    setLastSelectedId(ids[0] ?? null)
  }

  function selectHighBal() {
    const ids = accounts.filter(a => a.current_robux >= 5000).map(a => a.id)
    setSelectedIds(new Set(ids))
    setLastSelectedId(ids[0] ?? null)
  }

  function selectAvailable() {
    const ids = accounts.filter(a => getAvailableRobux(a) > 0).map(a => a.id)
    setSelectedIds(new Set(ids))
    setLastSelectedId(ids[0] ?? null)
  }

  function selectWithRes() {
    const ids = new Set(reservations.map(r => r.account_id))
    const selected = accounts.filter(a => ids.has(a.id)).map(a => a.id)
    setSelectedIds(new Set(selected))
    setLastSelectedId(selected[0] ?? null)
  }

  function registerAccountCard(id: string) {
    return (node: HTMLDivElement | null) => {
      if (node) cardRefs.current.set(id, node)
      else cardRefs.current.delete(id)
    }
  }

  function selectionRect(box: DragSelectionBox) {
    return {
      left: Math.min(box.startX, box.currentX),
      right: Math.max(box.startX, box.currentX),
      top: Math.min(box.startY, box.currentY),
      bottom: Math.max(box.startY, box.currentY),
    }
  }

  const rectsTouch = useCallback((a: ReturnType<typeof selectionRect>, b: DOMRect) => {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
  }, [])

  const applyDragSelection = useCallback((box: DragSelectionBox) => {
    const rect = selectionRect(box)
    const touched = new Set(dragBaseIdsRef.current)
    for (const id of selectionOrderRef.current) {
      const node = cardRefs.current.get(id)
      if (node && rectsTouch(rect, node.getBoundingClientRect())) touched.add(id)
    }
    setSelectedIds(touched)
  }, [rectsTouch])

  function isSelectionControl(target: EventTarget | null) {
    return target instanceof Element && !!target.closest(
      'button,a,input,textarea,select,[role="button"],[data-no-card-select],[data-slot="dialog-content"],[data-slot="dropdown-menu-content"],[data-slot="popover-content"]'
    )
  }

  function handleAccountCardPointerDown(event: ReactPointerEvent<HTMLDivElement>, accountId: string) {
    if (event.button !== 0 || isSelectionControl(event.target)) return
    event.preventDefault()

    if (event.shiftKey) {
      selectRange(accountId)
      return
    }

    if (event.ctrlKey || event.metaKey) {
      toggleSelect(accountId)
      return
    }

    dragBaseIdsRef.current = new Set()
    const nextBox = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    }
    setLastSelectedId(accountId)
    setDragSelection(nextBox)
    applyDragSelection(nextBox)
  }

  function handleAccountsAreaPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isSelectionControl(event.target)) return
    const card = event.target instanceof Element ? event.target.closest('[data-account-card-id]') : null
    const floating = event.target instanceof Element ? event.target.closest('[data-batch-action-bar]') : null
    if (!card && !floating && selectedIds.size > 0) clearAll()
  }

  useEffect(() => {
    if (!dragSelection) return

    function handleMove(event: PointerEvent) {
      setDragSelection(prev => {
        if (!prev) return prev
        const next = { ...prev, currentX: event.clientX, currentY: event.clientY }
        applyDragSelection(next)
        return next
      })
    }

    function handleUp() {
      setDragSelection(prev => {
        if (prev) applyDragSelection(prev)
        return null
      })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragSelection, applyDragSelection])

  function openAssignBatchDialog() {
    setBatchDialog({ mode: 'assign' })
    setBatchName(`Batch ${batches.length + 1}`)
    setBatchColor('blue')
  }

  function openRenameBatchDialog(batch: AccountBatch) {
    setBatchDialog({ mode: 'rename', batch })
    setBatchName(batch.name)
    setBatchColor(getBatchColor(batch.color).key)
  }

  function openChangeBatchColorDialog(batch: AccountBatch) {
    setBatchDialog({ mode: 'color', batch })
    setBatchName(batch.name)
    setBatchColor(getBatchColor(batch.color).key)
  }

  async function assignBatchToSelection(batchId: string) {
    if (selectedIds.size === 0) return
    setBatchSaving(true)
    const ids = [...selectedIds]
    const { error } = await supabase
      .from('roblox_accounts')
      .update({ batch_id: batchId, updated_at: new Date().toISOString() })
      .in('id', ids)
    setBatchSaving(false)
    if (error) { toast.error(error.message || 'Could not assign the batch.'); return }
    setAccounts(prev => prev.map(account => ids.includes(account.id) ? { ...account, batch_id: batchId } : account))
    setBatchDialog(null)
    toast.success(`${ids.length} account${ids.length !== 1 ? 's' : ''} assigned to batch.`)
  }

  async function clearBatchFromSelection() {
    if (selectedIds.size === 0) return
    setBatchSaving(true)
    const ids = [...selectedIds]
    const { error } = await supabase
      .from('roblox_accounts')
      .update({ batch_id: null, updated_at: new Date().toISOString() })
      .in('id', ids)
    setBatchSaving(false)
    if (error) { toast.error(error.message || 'Could not clear the batch.'); return }
    setAccounts(prev => prev.map(account => ids.includes(account.id) ? { ...account, batch_id: null } : account))
    toast.success('Batch cleared from selected accounts.')
  }

  async function removeAccountFromBatch(accountId: string) {
    const { error } = await supabase
      .from('roblox_accounts')
      .update({ batch_id: null, updated_at: new Date().toISOString() })
      .eq('id', accountId)
    if (error) { toast.error(error.message || 'Could not remove the batch.'); return }
    setAccounts(prev => prev.map(account => account.id === accountId ? { ...account, batch_id: null } : account))
    toast.success('Account removed from batch.')
  }

  async function saveBatchDialog() {
    const name = batchName.trim()
    if (!batchDialog || !name) { toast.error('Batch name is required.'); return }
    setBatchSaving(true)

    if (batchDialog.mode === 'assign') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBatchSaving(false); return }
      const nextSortOrder = batches.reduce((max, batch) => Math.max(max, batch.sort_order), -1) + 1
      const { data, error } = await supabase
        .from('account_batches')
        .insert({ user_id: user.id, name, color: batchColor, sort_order: nextSortOrder })
        .select('*')
        .single()
      if (error || !data) {
        setBatchSaving(false)
        toast.error(error?.message || 'Could not create the batch.')
        return
      }
      setBatches(prev => [...prev, data as AccountBatch])
      await assignBatchToSelection((data as AccountBatch).id)
      return
    }

    const target = batchDialog.batch
    const { data, error } = await supabase
      .from('account_batches')
      .update({ name, color: batchColor, updated_at: new Date().toISOString() })
      .eq('id', target.id)
      .select('*')
      .single()
    setBatchSaving(false)
    if (error || !data) { toast.error(error?.message || 'Could not update the batch.'); return }
    setBatches(prev => prev.map(batch => batch.id === target.id ? data as AccountBatch : batch))
    setBatchDialog(null)
    toast.success('Batch updated.')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const batchById = useMemo(
    () => new Map(batches.map(batch => [batch.id, batch])),
    [batches]
  )

  const sortedAccounts = useMemo(() => {
    const statusRank: Record<RobloxAccount['status'], number> = { active: 0, low: 1, inactive: 2, banned: 3 }
    return [...accounts].sort((a, b) => {
      switch (accountSort) {
        case 'name':
          return a.username.localeCompare(b.username)
        case 'status':
          return statusRank[a.status] - statusRank[b.status] || a.username.localeCompare(b.username)
        case 'batch': {
          const ba = a.batch_id ? batchById.get(a.batch_id) : null
          const bb = b.batch_id ? batchById.get(b.batch_id) : null
          if (ba && bb) {
            return ba.sort_order - bb.sort_order || ba.name.localeCompare(bb.name) || a.username.localeCompare(b.username)
          }
          if (ba) return -1
          if (bb) return 1
          return a.username.localeCompare(b.username)
        }
        case 'expiring': {
          // Expired + un-acknowledged first, then ascending remaining time
          const ra = getAgingRemainingMs(a, now)
          const rb = getAgingRemainingMs(b, now)
          const aExpired = ra === 0 && !a.spent_acknowledged_at
          const bExpired = rb === 0 && !b.spent_acknowledged_at
          if (aExpired !== bExpired) return aExpired ? -1 : 1
          return ra - rb
        }
        case 'robux':
        default:
          return b.current_robux - a.current_robux
      }
    })
  }, [accounts, accountSort, batchById, now])

  // Stock lifecycle: accounts at/below the low-stock threshold are "depleted" —
  // excluded from active inventory views and capital/restock planning.
  const activeInventoryAccounts = useMemo(
    () => sortedAccounts.filter(a => !isDepleted(a)),
    [sortedAccounts]
  )
  const depletedInventoryAccounts = useMemo(
    () => sortedAccounts.filter(a => isDepleted(a)),
    [sortedAccounts]
  )

  // Distinct Chrome profile values actually in use, for the filter dropdown —
  // free text, so this is computed rather than a fixed enum.
  const chromeProfiles = useMemo(
    () => [...new Set(accounts.map(a => a.chrome_profile).filter((p): p is string => !!p))].sort(),
    [accounts]
  )

  // Plus renewal reminder: accounts where 24h has elapsed since enabling Plus
  // and the user hasn't yet confirmed they turned off auto-renewal.
  const plusTaskAccounts = useMemo(
    () => accounts.filter(isPlusReminderActive),
    [accounts]
  )
  const plusTaskCount = plusTaskAccounts.length

  // ── Inventory aging summary — counts for the top-of-page panel ──────────
  const expiryStats = useMemo(() => {
    let expiringToday = 0, withinThreeDays = 0, expired = 0
    const dayMs = 24 * 60 * 60 * 1000
    const nowMs = now.getTime()
    for (const account of accounts) {
      if (account.spent_acknowledged_at) continue
      const deadline = new Date(account.added_to_inventory_at).getTime()
        + INVENTORY_DEADLINE_DAYS * 24 * 60 * 60 * 1000
      const remaining = deadline - nowMs
      if (remaining <= 0) { expired++; continue }
      if (remaining < dayMs)       expiringToday++
      if (remaining < 3 * dayMs)   withinThreeDays++
    }
    return { expiringToday, withinThreeDays, expired }
  }, [accounts, now])

  // ── Instant Send Tracker ─────────────────────────────────────────────────
  const transferStats = useMemo(() => {
    let canSend = 0, hasReservations = 0, limitReached = 0, totalReserved = 0
    for (const a of activeInventoryAccounts) {
      const s = getAllowance(a.id)
      if (s.available > 0) canSend++
      if (s.reserved > 0) { hasReservations++; totalReserved += s.reserved }
      if (s.available === 0) limitReached++
    }
    return { total: activeInventoryAccounts.length, canSend, hasReservations, limitReached, totalReserved }
  }, [activeInventoryAccounts, getAllowance])

  const transferFilteredAccounts = useMemo(() => {
    let list = activeInventoryAccounts.filter(a => {
      const s = getAllowance(a.id)
      const passesTransfer = (() => {
        switch (transferFilter) {
          case 'canSend':         return s.available > 0
          case 'hasReservations': return s.reserved > 0
          case 'fullyReserved':   return s.available === 0 && s.reserved > 0
          case 'limitReached':    return s.available === 0
          default:                return true
        }
      })()
      const passesDiscount = discountFilter === 'all' ? true : discountFilter === 'active' ? a.has_active_discount : !a.has_active_discount
      const passesPlus = plusFilter === 'all' ? true
        : plusFilter === 'plus' ? a.is_plus_account
        : plusFilter === 'nonPlus' ? !a.is_plus_account
        : isPlusReminderActive(a)
      const passesChromeProfile = chromeProfileFilter === 'all' ? true : (a.chrome_profile ?? '') === chromeProfileFilter
      return passesTransfer && passesDiscount && passesPlus && passesChromeProfile
    })
    if (transferSort !== 'none') {
      list = [...list].sort((a, b) => {
        const sa = getAllowance(a.id), sb = getAllowance(b.id)
        switch (transferSort) {
          case 'mostAvailable':  return sb.available - sa.available
          case 'leastAvailable': return sa.available - sb.available
          case 'mostReserved':   return sb.reserved - sa.reserved
          case 'mostRecentlyUsed': {
            const ta = sa.last_sent_at ? new Date(sa.last_sent_at).getTime() : 0
            const tb = sb.last_sent_at ? new Date(sb.last_sent_at).getTime() : 0
            return tb - ta
          }
          default: return 0
        }
      })
    }
    // Stable secondary pass — partitions discounted accounts to the front/back
    // while preserving whatever relative order the transfer sort produced.
    if (discountSort !== 'none') {
      list = [...list].sort((a, b) => {
        const da = a.has_active_discount ? 1 : 0
        const db = b.has_active_discount ? 1 : 0
        return discountSort === 'first' ? db - da : da - db
      })
    }
    if (accountSearch.trim()) {
      const q = accountSearch.toLowerCase()
      list = list.filter(a => a.username.toLowerCase().includes(q))
    }
    return list
  }, [activeInventoryAccounts, getAllowance, transferFilter, transferSort, discountFilter, discountSort, plusFilter, chromeProfileFilter, accountSearch])

  // Group filtered active accounts by batch for the folder-style layout.
  // `batches` is already sorted by sort_order, created_at from the DB query.
  const batchGroups = useMemo(() => {
    const result: Array<{ batch: AccountBatch; accounts: RobloxAccount[] }> = []
    for (const batch of batches) {
      const batchAccounts = transferFilteredAccounts.filter(a => a.batch_id === batch.id)
      if (batchAccounts.length > 0) result.push({ batch, accounts: batchAccounts })
    }
    return result
  }, [batches, transferFilteredAccounts])

  const unbatchedFilteredAccounts = useMemo(
    () => transferFilteredAccounts.filter(a => !a.batch_id),
    [transferFilteredAccounts]
  )

  // Expiring count per batch — shown on the batch ribbon header
  const batchExpiryWarnings = useMemo(() => {
    const map = new Map<string, number>()
    for (const { batch, accounts: batchAccounts } of batchGroups) {
      const count = batchAccounts.filter(a => {
        const s = getAgingState(a, now)
        return s === 'warning' || s === 'critical' || s === 'expired'
      }).length
      if (count > 0) map.set(batch.id, count)
    }
    return map
  }, [batchGroups, now])

  const visibleSelectionIds = useMemo(
    () => [
      ...transferFilteredAccounts.map(a => a.id),
      ...(depletedExpanded ? depletedInventoryAccounts.map(a => a.id) : []),
    ],
    [transferFilteredAccounts, depletedInventoryAccounts, depletedExpanded]
  )

  useEffect(() => {
    selectionOrderRef.current = visibleSelectionIds
  }, [visibleSelectionIds])

  // Accounts used for summary bar (always selection-based)
  const selectedAccounts = useMemo(
    () => accounts.filter(a => selectedIds.has(a.id)),
    [accounts, selectedIds]
  )
  // "Selected" is only a meaningful mode once something is selected — otherwise
  // it's silently treated as "All" so there's no toggle to reason about on first load.
  const effectiveStatsMode: StatsMode = selectedIds.size > 0 ? statsMode : 'all'

  // Accounts used for top stat cards (depends on mode)
  const statsAccounts = useMemo(
    () => effectiveStatsMode === 'all' ? accounts : selectedAccounts,
    [accounts, selectedAccounts, effectiveStatsMode]
  )
  const totalRobux     = statsAccounts.reduce((s, a) => s + a.current_robux, 0)
  const totalReserved  = statsAccounts.reduce((s, a) => s + a.reserved_robux, 0)
  const availableRobux = statsAccounts.reduce((s, a) => s + getAvailableRobux(a), 0)
  const activeAccounts = statsAccounts.filter(a => a.status === 'active').length

  const statAnimKey    = `${effectiveStatsMode}-${selectedIds.size}-${totalRobux}`

  // Reservations grouped by account
  const reservationsByAccount = useMemo(() => {
    const map = new Map<string, { username: string; reservations: ReservationWithDetails[] }>()
    for (const res of reservations) {
      const username = res.roblox_accounts?.username ?? 'Unknown'
      if (!map.has(res.account_id)) map.set(res.account_id, { username, reservations: [] })
      map.get(res.account_id)!.reservations.push(res)
    }
    return Array.from(map.entries()).map(([accountId, data]) => ({
      accountId,
      username: data.username,
      robloxUserId: accounts.find(a => a.id === accountId)?.roblox_user_id ?? null,
      reservations: data.reservations,
      total: data.reservations.reduce((s, r) => s + r.robux_amount, 0),
    }))
  }, [reservations, accounts])

  const hasSelection    = selectedIds.size > 0
  const allSelected     = visibleSelectionIds.length > 0 && selectedIds.size === visibleSelectionIds.length
  const statsSubtitle   = effectiveStatsMode === 'selected'
    ? `${selectedIds.size} account${selectedIds.size !== 1 ? 's' : ''} selected`
    : `Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`
  const dragRect = dragSelection ? selectionRect(dragSelection) : null

  return (
    <div>
      <TopBar
        title="Roblox Accounts"
        subtitle="Manage your seller accounts and reservations"
        actionLabel="+ Add Account"
        onActionClick={() => { setEditAccount(null); setModalOpen(true) }}
      />
      <PageHero
        badge="Inventory"
        title="Roblox Accounts"
        subtitle="Robux inventory, restock tracking, reservation management, and capital allocation."
      />

      {dragRect && (
        <div
          className="pointer-events-none fixed z-[60] rounded-lg"
          style={{
            left: dragRect.left,
            top: dragRect.top,
            width: dragRect.right - dragRect.left,
            height: dragRect.bottom - dragRect.top,
            background: 'rgba(34,211,238,0.12)',
            border: '1px solid rgba(34,211,238,0.55)',
            boxShadow: '0 0 22px rgba(34,211,238,0.16), inset 0 1px 0 rgba(255,255,255,0.18)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div className="p-5 space-y-5" onPointerDown={handleAccountsAreaPointerDown}>

        {/* ── Page section toggle ── */}
        <div className="metric-toggle w-full">
          {(['accounts', 'planning'] as PageTab[]).map(t => (
            <button
              key={t}
              onClick={() => setPageTab(t)}
              className={`metric-toggle-btn flex-1 ${pageTab === t ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
            >
              {pageTab === t && (
                <motion.div layoutId="page-tab-bg" className="metric-toggle-bg" transition={springToggle} />
              )}
              <span className="relative z-10">
                {t === 'accounts' ? 'Accounts' : 'Planning'}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
        {pageTab === 'planning' ? (
        <motion.div key="planning" variants={fadeUpVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">

        {/* ── 04 · Profitability ── */}
        <SectionLabel index="04" label="Profitability" />

        {/* ── Stock Liquidation Forecast ── */}
        {loading ? (
          <SkeletonChart height={180} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <LiquidationForecast
              accounts={accounts}
              selectedIds={selectedIds}
              completedOrders={completedOrders}
              walletBalance={walletBalance}
            />
          </motion.div>
        )}

        {/* ── Capital Readiness Tracker ── */}
        {loading ? (
          <SkeletonChart height={180} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}>
            <CapitalReadinessTracker
              accounts={activeInventoryAccounts}
              walletBalance={walletBalance}
            />
          </motion.div>
        )}

        {/* ── Restock Advisor ── */}
        {loading ? (
          <SkeletonChart height={180} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
            <RestockAdvisor
              accounts={activeInventoryAccounts}
              completedOrders={completedOrders}
              walletBalance={walletBalance}
            />
          </motion.div>
        )}

        </motion.div>
        ) : (
        <motion.div key="accounts" variants={fadeUpVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">

        {/* ── 01 · Inventory Position ── */}
        <div className="space-y-3">
          <SectionLabel index="01" label="Inventory Position" />
          <div className="flex items-center justify-between">
            <span className="label-caps">Account Summary</span>
            {/* Only a real decision once something is selected — hidden otherwise */}
            {hasSelection && (
              <div className="metric-toggle">
                {(['all', 'selected'] as StatsMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setStatsMode(m)}
                    className={`metric-toggle-btn ${effectiveStatsMode === m ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
                  >
                    {effectiveStatsMode === m && (
                      <motion.div layoutId="acc-toggle-bg" className="metric-toggle-bg" transition={springToggle} />
                    )}
                    <span className="relative z-10">
                      {m === 'all' ? 'All Accounts' : `Selected (${selectedIds.size})`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3.5"
            variants={cardStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.4 }}
          >
            <motion.div variants={cardStaggerItem}>
            <StatCard
              title="Total Robux"
              value={`${totalRobux.toLocaleString()} R$`}
              subtitle={statsSubtitle}
              icon={Coins} iconColor="#a78bfa" accentColor="#a78bfa"
              animKey={statAnimKey}
              featured
            />
            </motion.div>
            <motion.div variants={cardStaggerItem}>
            <StatCard
              title="Available Robux"
              value={`${availableRobux.toLocaleString()} R$`}
              subtitle="Ready to fulfill orders"
              icon={Wallet} iconColor="#34d399" accentColor="#34d399"
              animKey={statAnimKey}
            />
            </motion.div>
            <motion.div variants={cardStaggerItem}>
            <StatCard
              title="Reserved Robux"
              value={`${totalReserved.toLocaleString()} R$`}
              subtitle={`${reservations.length} active reservation${reservations.length !== 1 ? 's' : ''}`}
              icon={Lock} iconColor="#f59e0b" accentColor="#f59e0b"
              animKey={statAnimKey}
            />
            </motion.div>
            <motion.div variants={cardStaggerItem}>
            <StatCard
              title="Active Accounts"
              value={`${activeAccounts} / ${statsAccounts.length}`}
              subtitle="Currently active"
              icon={Users} iconColor="#22d3ee" accentColor="#22d3ee"
              animKey={statAnimKey}
            />
            </motion.div>
          </motion.div>
          )}
        </div>

        {/* ── Inventory Aging summary ── */}
        {!loading && accounts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl px-4 py-3.5"
            style={{
              background: expiryStats.expired > 0
                ? 'rgba(248,113,113,0.04)'
                : expiryStats.expiringToday > 0
                ? 'rgba(245,158,11,0.04)'
                : 'rgba(52,211,153,0.04)',
              border: expiryStats.expired > 0
                ? '1px solid rgba(248,113,113,0.16)'
                : expiryStats.expiringToday > 0
                ? '1px solid rgba(245,158,11,0.16)'
                : '1px solid rgba(52,211,153,0.14)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Timer
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{
                  color: expiryStats.expired > 0 ? '#f87171'
                    : expiryStats.expiringToday > 0 ? '#f59e0b'
                    : '#34d399',
                }}
              />
              <span className="label-caps">Inventory Aging</span>
              <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.30)' }}>
                · {INVENTORY_DEADLINE_DAYS}-day window
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="label-caps mb-1.5">Expiring Today</p>
                <p
                  className="text-[26px] font-black tabular-nums leading-none"
                  style={{ color: expiryStats.expiringToday > 0 ? '#f59e0b' : '#34d399' }}
                >
                  {expiryStats.expiringToday}
                </p>
              </div>
              <div>
                <p className="label-caps mb-1.5">Within 3 Days</p>
                <p
                  className="text-[26px] font-black tabular-nums leading-none"
                  style={{ color: expiryStats.withinThreeDays > 0 ? '#f59e0b' : '#34d399' }}
                >
                  {expiryStats.withinThreeDays}
                </p>
              </div>
              <div>
                <p className="label-caps mb-1.5">Expired</p>
                <p
                  className="text-[26px] font-black tabular-nums leading-none"
                  style={{ color: expiryStats.expired > 0 ? '#f87171' : '#34d399' }}
                >
                  {expiryStats.expired}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 02 · Account Health ── */}
        <SectionLabel index="02" label="Account Health" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
          style={depletedInventoryAccounts.length > 0
            ? { background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.16)' }
            : { background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.16)' }}
        >
          {depletedInventoryAccounts.length > 0 ? (
            <>
              <Archive className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                <b style={{ color: '#f59e0b' }}>{depletedInventoryAccounts.length}</b> of {accounts.length} account{accounts.length !== 1 ? 's' : ''} depleted — restock to keep fulfilling orders.
              </p>
            </>
          ) : (
            <>
              <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#34d399' }} />
              <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                All {accounts.length} account{accounts.length !== 1 ? 's' : ''} healthy — nothing depleted.
              </p>
            </>
          )}
        </motion.div>

        {/* ── Daily Transfer Tracker — 500 R$/day, 1000 R$ lifetime per account ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
          style={transferStats.canSend > 0
            ? { background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.16)' }
            : { background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.16)' }}
        >
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: transferStats.canSend > 0 ? '#34d399' : '#f87171' }} />
          <p className="text-[12px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.72)' }}>
            <b style={{ color: transferStats.canSend > 0 ? '#34d399' : '#f87171' }}>
              {transferStats.canSend}
            </b> of {transferStats.total} account{transferStats.total !== 1 ? 's' : ''} can still send today
            {transferStats.hasReservations > 0 && (
              <span style={{ color: '#f59e0b' }}> · {formatRobux(transferStats.totalReserved)} reserved across {transferStats.hasReservations}</span>
            )}
            {transferStats.limitReached > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.44)' }}> · {transferStats.limitReached} at the daily limit</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setPriceTierManagerOpen(true)}
            className="flex-shrink-0 text-[11px] font-semibold underline"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            Manage Pricing
          </button>
        </motion.div>

        {/* ── 05 · Detailed Accounts — grid + filters ── */}
        <div className="space-y-3">
          <SectionLabel index="05" label="Detailed Accounts" />

          {/* Control bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.36)' }}>
                {activeInventoryAccounts.length} active account{activeInventoryAccounts.length !== 1 ? 's' : ''}
                {plusTaskCount > 0 && (
                  <> · <span style={{ color: '#ea580c' }}>Plus Tasks ({plusTaskCount})</span></>
                )}
              </span>
              {accounts.some(a => !a.roblox_user_id) && (
                <button
                  onClick={refreshAvatars}
                  disabled={refreshingAvatars}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                  style={{ color: 'rgba(255,255,255,0.36)' }}
                  title="Look up Roblox avatars for accounts that don't have one yet"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingAvatars ? 'animate-spin' : ''}`} />
                  {refreshingAvatars ? 'Refreshing…' : 'Refresh Avatars'}
                </button>
              )}
            </div>

            {/* Plus Renewal Reminder banner */}
            <AnimatePresence>
              {plusTaskCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.22)' }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#ea580c' }} />
                  <p className="text-[12px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.78)' }}>
                    <span style={{ color: '#ea580c' }}>Plus Renewal Tasks</span> — You have{' '}
                    <span style={{ color: '#ea580c' }}>{plusTaskCount}</span>{' '}
                    account{plusTaskCount !== 1 ? 's' : ''} that need{plusTaskCount === 1 ? 's' : ''} Plus auto-renewal turned off
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const firstId = plusTaskAccounts.find(a => cardRefs.current.has(a.id))?.id
                      if (firstId) cardRefs.current.get(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className="flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px"
                    style={{ background: 'rgba(234,88,12,0.14)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.28)' }}
                  >
                    View Accounts
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              />
              <input
                type="text"
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                placeholder="Search accounts…"
                className="w-full pl-8 pr-8 py-2 rounded-xl text-[12px] font-medium outline-none transition-colors"
                style={{
                  background: accountSearch ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                  border: accountSearch ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.82)',
                }}
              />
              {accountSearch && (
                <button
                  type="button"
                  onClick={() => setAccountSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.36)' }} />
                </button>
              )}
            </div>

            {/* Grouped control bar — selection / sort / filters */}
            <div
              className="flex items-center flex-wrap gap-px p-1 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* — Selection — */}
              <button
                onClick={allSelected ? clearAll : selectAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  color: allSelected ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                  background: allSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
                }}
              >
                {allSelected ? <X className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
                {allSelected ? 'Clear' : 'Select All'}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{ color: 'rgba(255,255,255,0.40)' }}
                >
                  By… <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  <DropdownMenuItem onClick={selectActive} className="cursor-pointer text-[12px]">Active Only</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectHighBal} className="cursor-pointer text-[12px]">High Balance</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectAvailable} className="cursor-pointer text-[12px]">Has Available</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectWithRes} className="cursor-pointer text-[12px]">Has Reservations</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="self-stretch w-px mx-0.5 my-1" style={{ background: 'rgba(255,255,255,0.09)' }} />

              {/* — Sort — */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: accountSort !== 'robux' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: accountSort !== 'robux' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {ACCOUNT_SORTS.find(s => s.value === accountSort)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  {ACCOUNT_SORTS.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setAccountSort(s.value)} className="cursor-pointer text-[12px]">
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="self-stretch w-px mx-0.5 my-1" style={{ background: 'rgba(255,255,255,0.09)' }} />

              {/* — Filters — */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: transferFilter !== 'all' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: transferFilter !== 'all' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <Zap className="w-3 h-3" />
                  {TRANSFER_FILTERS.find(f => f.value === transferFilter)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  {TRANSFER_FILTERS.map(f => (
                    <DropdownMenuItem key={f.value} onClick={() => setTransferFilter(f.value)} className="cursor-pointer text-[12px]">
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: transferSort !== 'none' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: transferSort !== 'none' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {TRANSFER_SORTS.find(s => s.value === transferSort)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  {TRANSFER_SORTS.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setTransferSort(s.value)} className="cursor-pointer text-[12px]">
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: discountFilter !== 'all' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: discountFilter !== 'all' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  {DISCOUNT_FILTERS.find(f => f.value === discountFilter)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  {DISCOUNT_FILTERS.map(f => (
                    <DropdownMenuItem key={f.value} onClick={() => setDiscountFilter(f.value)} className="cursor-pointer text-[12px]">
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: discountSort !== 'none' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: discountSort !== 'none' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {DISCOUNT_SORTS.find(s => s.value === discountSort)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border">
                  {DISCOUNT_SORTS.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setDiscountSort(s.value)} className="cursor-pointer text-[12px]">
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    color: plusFilter !== 'all' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                    background: plusFilter !== 'all' ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <BadgeCheck className="w-3 h-3" />
                  {PLUS_FILTERS.find(f => f.value === plusFilter)?.label}
                  <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  {PLUS_FILTERS.map(f => (
                    <DropdownMenuItem key={f.value} onClick={() => setPlusFilter(f.value)} className="cursor-pointer text-[12px]">
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {chromeProfiles.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                    style={{
                      color: chromeProfileFilter !== 'all' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.40)',
                      background: chromeProfileFilter !== 'all' ? 'rgba(255,255,255,0.07)' : 'transparent',
                    }}
                  >
                    <Layers className="w-3 h-3" />
                    {chromeProfileFilter === 'all' ? 'All Profiles' : chromeProfileFilter}
                    <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem onClick={() => setChromeProfileFilter('all')} className="cursor-pointer text-[12px]">
                      All Profiles
                    </DropdownMenuItem>
                    {chromeProfiles.map(p => (
                      <DropdownMenuItem key={p} onClick={() => setChromeProfileFilter(p)} className="cursor-pointer text-[12px]">
                        {p}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Batch action bar */}
          <AnimatePresence>
            {hasSelection && (
              <motion.div
                data-batch-action-bar
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 bottom-5 z-50 w-[min(92vw,680px)] -translate-x-1/2"
              >
                <div
                  className="glass-floating rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(14,12,32,0.90) padding-box, linear-gradient(140deg, rgba(34,211,238,0.42), rgba(139,92,246,0.30) 55%, rgba(255,255,255,0.14)) border-box',
                    border: '1px solid transparent',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MousePointer2 className="w-4 h-4" style={{ color: '#22d3ee' }} />
                      <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {selectedIds.size} Account{selectedIds.size !== 1 ? 's' : ''} Selected
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openAssignBatchDialog}
                        className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all hover:-translate-y-px"
                        style={{ background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', color: 'rgb(5,5,10)', boxShadow: '0 0 18px rgba(34,211,238,0.22)' }}
                      >
                        <Tag className="w-3.5 h-3.5" /> Assign Batch
                      </button>
                      <button
                        type="button"
                        onClick={clearBatchFromSelection}
                        disabled={batchSaving}
                        className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.060)', color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.110)' }}
                      >
                        <Eraser className="w-3.5 h-3.5" /> Clear Batch
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors"
                        style={{ color: 'rgba(255,255,255,0.48)' }}
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Account cards grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="No accounts yet"
              description="Add your first Roblox account to start tracking inventory, reservations, and capital position."
              actionLabel="Add Account"
              onAction={() => setModalOpen(true)}
            />
          ) : activeInventoryAccounts.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="No active inventory"
              description="Every account is currently depleted. Restock an existing account or add a new one to resume fulfilling orders."
              actionLabel="Add Account"
              onAction={() => setModalOpen(true)}
            />
          ) : transferFilteredAccounts.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No accounts match this filter"
              description="Try a different transfer filter, or switch back to All."
            />
          ) : (
            <div className="space-y-8">

              {/* ── Batch groups — each batch becomes a labeled glass folder ── */}
              {batchGroups.map(({ batch, accounts: groupAccounts }) => {
                const color = getBatchColor(batch.color)
                const cv = color.value
                return (
                  <div key={batch.id} className="space-y-3">

                    {/* Batch section header */}
                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: cv }}
                        />
                        <span
                          className="text-[13px] font-semibold tracking-tight truncate"
                          style={{ color: 'rgba(255,255,255,0.76)' }}
                        >
                          {batch.name}
                        </span>
                        <span
                          className="text-[11px] font-medium tabular-nums flex-shrink-0"
                          style={{ color: 'rgba(255,255,255,0.30)' }}
                        >
                          {groupAccounts.length} account{groupAccounts.length !== 1 ? 's' : ''}
                        </span>
                        {batchExpiryWarnings.has(batch.id) && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.28)' }}
                          >
                            ⚠ {batchExpiryWarnings.get(batch.id)} Expiring
                          </span>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="w-6 h-6 rounded-md flex items-center justify-center opacity-30 hover:opacity-70 transition-opacity flex-shrink-0"
                          style={{ color: 'rgba(255,255,255,0.60)' }}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-[12px]">
                          <DropdownMenuItem onClick={() => openRenameBatchDialog(batch)} className="cursor-pointer text-[12px]">
                            Rename Batch
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openChangeBatchColorDialog(batch)} className="cursor-pointer text-[12px]">
                            Change Color
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Glass group container */}
                    <div
                      className="rounded-2xl p-4"
                      style={color.dominant ? {
                        background: `radial-gradient(ellipse at 50% -20%, ${hexToRgba(cv, 0.52)} 0%, ${hexToRgba(cv, 0.30)} 55%, ${hexToRgba(cv, 0.16)} 100%)`,
                        border: `1px solid ${hexToRgba(cv, 0.70)}`,
                        boxShadow: `0 0 32px ${hexToRgba(cv, 0.22)}`,
                      } : {
                        background: `radial-gradient(ellipse at 50% -20%, ${hexToRgba(cv, 0.09)} 0%, ${hexToRgba(cv, 0.04)} 55%, ${hexToRgba(cv, 0.025)} 100%)`,
                        border: `1px solid ${hexToRgba(cv, 0.18)}`,
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
                        {groupAccounts.map(account => (
                          <div
                            key={account.id}
                            ref={registerAccountCard(account.id)}
                            onPointerDown={event => handleAccountCardPointerDown(event, account.id)}
                          >
                            <AccountCard
                              account={account}
                              now={now}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              batch={batchById.get(account.batch_id!) ?? null}
                              isSelected={selectedIds.has(account.id)}
                              onRemoveFromBatch={removeAccountFromBatch}
                              allowance={getAllowance(account.id)}
                              history={historyByAccount.get(account.id) ?? []}
                              reservationQueue={transferQueueByAccount.get(account.id) ?? []}
                              onQuickTransfer={amount => handleRecordTransfer(account.id, amount)}
                              onOpenReserveDialog={() => handleOpenReserveDialog(account)}
                              onOpenLogDialog={() => handleOpenLogDialog(account)}
                              onEditTransferLog={log => handleOpenEditLog(account, log)}
                              onDeleteTransferLog={handleDeleteTransferLog}
                              onFulfillReservation={handleFulfillReservation}
                              onCancelReservation={handleCancelReservation}
                              onOpenSaleDialog={() => handleOpenSaleDialog(account)}
                              onDismissPlusReminder={() => handleDismissPlusReminder(account.id)}
                              onAcknowledgeSpent={() => handleAcknowledgeSpent(account.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* ── Unbatched accounts ── */}
              {unbatchedFilteredAccounts.length > 0 && (
                <div className="space-y-3">
                  {batchGroups.length > 0 && (
                    <div className="flex items-center gap-2.5 px-0.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.20)' }}
                      />
                      <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.42)' }}>
                        Unassigned
                      </span>
                      <span className="text-[11px] font-medium tabular-nums" style={{ color: 'rgba(255,255,255,0.24)' }}>
                        {unbatchedFilteredAccounts.length} account{unbatchedFilteredAccounts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
                    {unbatchedFilteredAccounts.map(account => (
                      <div
                        key={account.id}
                        ref={registerAccountCard(account.id)}
                        onPointerDown={event => handleAccountCardPointerDown(event, account.id)}
                      >
                        <AccountCard
                          account={account}
                          now={now}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          batch={null}
                          isSelected={selectedIds.has(account.id)}
                          allowance={getAllowance(account.id)}
                          history={historyByAccount.get(account.id) ?? []}
                          reservationQueue={transferQueueByAccount.get(account.id) ?? []}
                          onQuickTransfer={amount => handleRecordTransfer(account.id, amount)}
                          onOpenReserveDialog={() => handleOpenReserveDialog(account)}
                          onOpenLogDialog={() => handleOpenLogDialog(account)}
                          onEditTransferLog={log => handleOpenEditLog(account, log)}
                          onDeleteTransferLog={handleDeleteTransferLog}
                          onFulfillReservation={handleFulfillReservation}
                          onCancelReservation={handleCancelReservation}
                          onOpenSaleDialog={() => handleOpenSaleDialog(account)}
                          onDismissPlusReminder={() => handleDismissPlusReminder(account.id)}
                          onAcknowledgeSpent={() => handleAcknowledgeSpent(account.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Depleted Accounts (collapsed by default) ── */}
          {!loading && depletedInventoryAccounts.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                onClick={() => setDepletedExpanded(p => !p)}
                className="flex items-center gap-3 w-full text-left"
              >
                <Archive className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.44)' }} />
                <span className="label-caps">Depleted Accounts</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.44)', border: '1px solid rgba(255,255,255,0.110)' }}
                >
                  {depletedInventoryAccounts.length}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 ml-auto transition-transform duration-200"
                  style={{ color: 'rgba(255,255,255,0.47)', transform: depletedExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              <AnimatePresence>
                {depletedExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-7 pt-4">
                      {(accountSearch.trim()
                        ? depletedInventoryAccounts.filter(a => a.username.toLowerCase().includes(accountSearch.toLowerCase()))
                        : depletedInventoryAccounts
                      ).map(account => (
                        <div
                          key={account.id}
                          ref={registerAccountCard(account.id)}
                          onPointerDown={event => handleAccountCardPointerDown(event, account.id)}
                        >
                          <AccountCard
                            account={account}
                            now={now}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            batch={account.batch_id ? batchById.get(account.batch_id) ?? null : null}
                            isSelected={selectedIds.has(account.id)}
                            onRemoveFromBatch={removeAccountFromBatch}
                            onDismissPlusReminder={() => handleDismissPlusReminder(account.id)}
                            onAcknowledgeSpent={() => handleAcknowledgeSpent(account.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── 03 · Capacity — reservations panel ── */}
        {!loading && (
          <div className="space-y-3">
            <SectionLabel index="03" label="Capacity" />
            <button
              onClick={() => setResExpanded(p => !p)}
              className="flex items-center gap-3 w-full text-left"
            >
              <span className="label-caps">Active Reservations</span>
              {reservations.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309', border: '1px solid rgba(245,158,11,0.22)' }}
                >
                  {reservations.length}
                </span>
              )}
              {totalReserved > 0 && (
                <span className="text-[11px] font-bold tabular-nums ml-auto" style={{ color: '#b45309' }}>
                  {totalReserved.toLocaleString()} R$ locked
                </span>
              )}
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: 'rgba(255,255,255,0.47)',
                  transform: resExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  marginLeft: totalReserved > 0 ? '0' : 'auto',
                }}
              />
            </button>

            <AnimatePresence>
              {resExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  {reservations.length === 0 ? (
                    <div className="glass-secondary rounded-2xl p-10 text-center" style={{ opacity: 0.75 }}>
                      <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
                      <p className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>No active reservations</p>
                      <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>Robux is automatically reserved when orders are created</p>
                    </div>
                  ) : (
                    <div className="glass-secondary overflow-hidden">
                      <div
                        className="px-5 py-3.5 flex items-center justify-between"
                        style={{ background: 'rgba(245,158,11,0.04)', borderBottom: '1px solid rgba(245,158,11,0.12)' }}
                      >
                        <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                          Robux reserved for pending and paid orders
                        </p>
                        <div className="text-right">
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>Total locked</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{ color: '#b45309' }}>
                            {reservations.reduce((s, r) => s + r.robux_amount, 0).toLocaleString()} R$
                          </p>
                        </div>
                      </div>

                      {reservationsByAccount.map(({ accountId, username, robloxUserId, reservations: accRes, total }) => (
                        <div key={accountId} style={{ borderBottom: '1px solid rgba(255,255,255,0.078)' }}>
                          <div className="flex items-center justify-between px-5 py-2.5" style={{ background: 'rgba(255,255,255,0.040)' }}>
                            <div className="flex items-center gap-2">
                              <RobloxAvatar
                                username={username}
                                userId={robloxUserId}
                                size={24}
                                className="rounded-lg text-[11px] font-black"
                                glow="none"
                              />
                              <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.76)' }}>{username}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                {accRes.length} reservation{accRes.length !== 1 ? 's' : ''}
                              </span>
                              <span
                                className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309', border: '1px solid rgba(245,158,11,0.20)' }}
                              >
                                {total.toLocaleString()} R$
                              </span>
                            </div>
                          </div>

                          {accRes.map(res => (
                            <div
                              key={res.id}
                              className="flex items-center gap-4 px-5 py-3 order-row-shimmer"
                              style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: '#f59e0b', boxShadow: '0 0 5px rgba(245,158,11,0.45)' }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
                                  {res.gamepass_names || 'Gamepass reservation'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {res.orders?.order_number && (
                                    <span className="font-mono text-[10px] font-bold" style={{ color: '#22d3ee' }}>
                                      {res.orders.order_number}
                                    </span>
                                  )}
                                  {res.orders?.buyer_name && (
                                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                      · {res.orders.buyer_name}
                                    </span>
                                  )}
                                  {res.orders?.status && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                                      style={{
                                        background: res.orders.status === 'paid' ? 'rgba(34,211,238,0.10)' : 'rgba(245,158,11,0.10)',
                                        color: res.orders.status === 'paid' ? '#0e7490' : '#b45309',
                                        border: res.orders.status === 'paid' ? '1px solid rgba(34,211,238,0.22)' : '1px solid rgba(245,158,11,0.22)',
                                      }}
                                    >
                                      {res.orders.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[13px] font-bold tabular-nums" style={{ color: '#b45309' }}>
                                  {res.robux_amount.toLocaleString()} R$
                                </p>
                                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
                                  {formatDistanceToNow(new Date(res.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        </motion.div>
        )}
        </AnimatePresence>

      </div>

      <Dialog open={batchDialog !== null} onOpenChange={open => { if (!open) setBatchDialog(null) }}>
        <DialogContent className="sm:max-w-lg p-5">
          <DialogHeader>
            <DialogTitle>
              {batchDialog?.mode === 'assign' ? 'Assign Batch' : batchDialog?.mode === 'rename' ? 'Rename Batch' : 'Change Batch Color'}
            </DialogTitle>
            <DialogDescription>
              {batchDialog?.mode === 'assign'
                ? `${selectedIds.size} selected account${selectedIds.size !== 1 ? 's' : ''}`
                : batchDialog?.batch.name}
            </DialogDescription>
          </DialogHeader>

          {batchDialog?.mode === 'assign' && batches.length > 0 && (
            <div className="space-y-2">
              <p className="label-caps">Existing Batches</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {batches.map(batch => {
                  const color = getBatchColor(batch.color)
                  return (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => assignBatchToSelection(batch.id)}
                      disabled={batchSaving}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:-translate-y-px disabled:opacity-50"
                      style={{ background: `${color.soft}`, border: `1px solid ${color.value}55`, boxShadow: `0 0 14px ${color.value}12` }}
                    >
                      <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>{batch.name}</span>
                      <span className="h-3 w-3 rounded-full" style={{ background: color.value, boxShadow: `0 0 10px ${color.value}80` }} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="label-caps" htmlFor="batch-name">Name</label>
              <Input
                id="batch-name"
                value={batchName}
                onChange={event => setBatchName(event.target.value)}
                placeholder="Batch 1"
                disabled={batchSaving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.48)' }} />
                <p className="label-caps">Color</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BATCH_PALETTE.map(color => {
                  const active = batchColor === color.key
                  return (
                    <button
                      key={color.key}
                      type="button"
                      onClick={() => setBatchColor(color.key)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-bold transition-all"
                      style={{
                        background: active ? `${color.soft}` : 'rgba(255,255,255,0.040)',
                        border: active ? `1px solid ${color.value}` : '1px solid rgba(255,255,255,0.090)',
                        color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.62)',
                        boxShadow: active ? `0 0 14px ${color.value}20` : undefined,
                      }}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ background: color.value }} />
                      {color.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="bg-transparent border-t border-white/10">
            <Button variant="pillOutline" onClick={() => setBatchDialog(null)} disabled={batchSaving}>Cancel</Button>
            <Button variant="primary" onClick={saveBatchDialog} disabled={batchSaving || !batchName.trim()}>
              {batchDialog?.mode === 'assign' ? 'Create & Assign' : 'Save Batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(null) }}
        onSave={handleSave}
        onAdjust={handleAdjust}
        account={editAccount}
        loading={saving}
      />

      <ReserveTransferDialog
        open={reserveDialogAccount !== null}
        account={reserveDialogAccount}
        available={reserveDialogAccount ? getAllowance(reserveDialogAccount.id).available : 0}
        onClose={() => setReserveDialogAccount(null)}
        onSubmit={handleCreateReservation}
      />

      <LogTransferDialog
        open={logDialogAccount !== null}
        account={logDialogAccount}
        editingLog={editingTransferLog}
        onClose={() => { setLogDialogAccount(null); setEditingTransferLog(null) }}
        onSubmit={handleSubmitLogTransfer}
      />

      <LogInstantSendSaleDialog
        open={saleDialogAccount !== null}
        account={saleDialogAccount}
        tiers={priceTiers}
        onClose={() => setSaleDialogAccount(null)}
        onSubmit={handleSubmitSale}
      />

      <PriceTierManager
        open={priceTierManagerOpen}
        tiers={priceTiers}
        onClose={() => setPriceTierManagerOpen(false)}
        onAdd={handleAddPriceTier}
        onDelete={handleDeletePriceTier}
        onLoadDefaults={handleLoadDefaultTiers}
      />
    </div>
  )
}

// useUrlState() calls useSearchParams() internally — Next.js requires any
// component using it to sit under a Suspense boundary, or the build's
// prerender pass fails even on a force-dynamic page. The real loading state
// is already handled inside AccountsPageContent itself, so this fallback is
// never actually shown — it exists purely to satisfy that requirement.
export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsPageContent />
    </Suspense>
  )
}
