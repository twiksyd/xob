'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
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
  TransferLog, TransferReservation, AllowanceSummary,
} from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import { calculateBusinessValue, classifyPurchase } from '@/lib/utils/capital'
import { formatRobux } from '@/lib/utils/pricing'
import { getStartOfTodayISO, DAILY_TRANSFER_LIMIT } from '@/lib/utils/transfers'
import ReserveTransferDialog from '@/components/accounts/ReserveTransferDialog'
import LogTransferDialog from '@/components/accounts/LogTransferDialog'
import {
  Coins, Wallet, Users, Lock, ChevronDown, X,
  CheckSquare, Square, RefreshCw, Archive, Zap, ArrowUpDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { springToggle, fadeUpVariants, staggerContainer, staggerItem, cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import { SkeletonChart, SkeletonCard } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { useUrlState } from '@/hooks/useUrlState'

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

  // ── Daily Transfer Tracker state ────────────────────────────────────────────
  const [allowanceByAccount, setAllowanceByAccount] = useState<Map<string, AllowanceSummary>>(new Map())
  const [historyByAccount, setHistoryByAccount] = useState<Map<string, TransferLog[]>>(new Map())
  const [transferQueueByAccount, setTransferQueueByAccount] = useState<Map<string, TransferReservation[]>>(new Map())
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('all')
  const [transferSort, setTransferSort] = useState<TransferSort>('none')
  const [reserveDialogAccount, setReserveDialogAccount] = useState<RobloxAccount | null>(null)
  const [logDialogAccount, setLogDialogAccount] = useState<RobloxAccount | null>(null)
  const [editingTransferLog, setEditingTransferLog] = useState<TransferLog | null>(null)

  const toast = useToast()
  const confirm = useConfirm()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Every account has a row from get_transfer_allowance_summary (it LEFT JOINs
  // from roblox_accounts), so this default is just a defensive fallback.
  // useCallback so it has a stable identity across renders when the map
  // itself hasn't changed — lets the useMemos below depend on it safely.
  const getAllowance = useCallback((accountId: string): AllowanceSummary => {
    return allowanceByAccount.get(accountId) ?? {
      roblox_account_id: accountId, sent_today: 0, reserved: 0, available: DAILY_TRANSFER_LIMIT, last_sent_at: null,
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
    const [accRes, resRes, ordersRes, walletRes, allowanceRes, historyRes, queueRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').eq('status', 'completed'),
      supabase.rpc('get_wallet_balance'),
      supabase.rpc('get_transfer_allowance_summary', { p_start_of_today: startOfToday }),
      supabase.from('transfer_logs').select('*').gte('sent_at', startOfToday).order('sent_at', { ascending: false }),
      supabase.from('transfer_reservations').select('*').eq('status', 'reserved').order('created_at', { ascending: false }),
    ])
    if (!accRes.error && accRes.data) setAccounts(accRes.data)
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
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSave(data: {
    username: string; current_robux: number; reserved_robux: number
    robux_cost_rate: number; status: 'active' | 'inactive' | 'banned' | 'low'; notes?: string
    roblox_profile?: string
    purchase_cost?: number; supplier?: string; purchase_date?: string
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
      const payload = { username: data.username, status: data.status, notes: data.notes ?? null, roblox_user_id: robloxUserId }
      await supabase.from('roblox_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editAccount.id)
    } else {
      const payload = { username: data.username, current_robux: data.current_robux, reserved_robux: data.reserved_robux, robux_cost_rate: robuxCostRate, status: data.status, notes: data.notes ?? null, roblox_user_id: robloxUserId }
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
  }

  function selectAll()       { setSelectedIds(new Set(accounts.map(a => a.id))) }
  function clearAll()        { setSelectedIds(new Set()) }
  function selectActive()    { setSelectedIds(new Set(accounts.filter(a => a.status === 'active').map(a => a.id))) }
  function selectHighBal()   { setSelectedIds(new Set(accounts.filter(a => a.current_robux >= 5000).map(a => a.id))) }
  function selectAvailable() { setSelectedIds(new Set(accounts.filter(a => getAvailableRobux(a) > 0).map(a => a.id))) }
  function selectWithRes() {
    const ids = new Set(reservations.map(r => r.account_id))
    setSelectedIds(new Set(accounts.filter(a => ids.has(a.id)).map(a => a.id)))
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.current_robux - a.current_robux),
    [accounts]
  )

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
      switch (transferFilter) {
        case 'canSend':         return s.available > 0
        case 'hasReservations': return s.reserved > 0
        case 'fullyReserved':   return s.available === 0 && s.reserved > 0
        case 'limitReached':    return s.available === 0
        default:                return true
      }
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
    return list
  }, [activeInventoryAccounts, getAllowance, transferFilter, transferSort])

  // Accounts used for summary bar (always selection-based)
  const selectedAccounts = useMemo(
    () => accounts.filter(a => selectedIds.has(a.id)),
    [accounts, selectedIds]
  )
  const selTotal     = selectedAccounts.reduce((s, a) => s + a.current_robux, 0)
  const selReserved  = selectedAccounts.reduce((s, a) => s + a.reserved_robux, 0)
  const selAvailable = selectedAccounts.reduce((s, a) => s + getAvailableRobux(a), 0)

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
  const allSelected     = accounts.length > 0 && selectedIds.size === accounts.length
  const statsSubtitle   = effectiveStatsMode === 'selected'
    ? `${selectedIds.size} account${selectedIds.size !== 1 ? 's' : ''} selected`
    : `Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`

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

      <div className="p-5 space-y-5">

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

        {/* ── Daily Transfer Tracker — 1000 R$/day allowance per account, resets at local midnight ── */}
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
          <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
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
        </motion.div>

        {/* ── 05 · Detailed Accounts — grid + filters ── */}
        <div className="space-y-3">
          <SectionLabel index="05" label="Detailed Accounts" />

          {/* Grid header + selection controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Active Accounts ({activeInventoryAccounts.length})
            </p>
            <div className="flex items-center gap-3">
              {accounts.some(a => !a.roblox_user_id) && (
                <button
                  onClick={refreshAvatars}
                  disabled={refreshingAvatars}
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50"
                  style={{ color: 'rgba(255,255,255,0.47)' }}
                  title="Look up Roblox avatars for accounts that don't have one yet"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingAvatars ? 'animate-spin' : ''}`} />
                  {refreshingAvatars ? 'Refreshing avatars…' : 'Refresh Avatars'}
                </button>
              )}
              {/* Select all / none toggle — the one most-used action stays a single click */}
              <button
                onClick={allSelected ? clearAll : selectAll}
                className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                style={{ color: allSelected ? '#22d3ee' : 'rgba(255,255,255,0.47)' }}
              >
                {allSelected
                  ? <CheckSquare className="w-3.5 h-3.5" />
                  : <Square className="w-3.5 h-3.5" />
                }
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              {/* Situational selection shortcuts — tucked behind a menu instead of four always-visible chips */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                  style={{ color: 'rgba(255,255,255,0.47)' }}
                >
                  Select by…
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem onClick={selectActive} className="cursor-pointer text-[12px]">Active Only</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectHighBal} className="cursor-pointer text-[12px]">High Balance</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectAvailable} className="cursor-pointer text-[12px]">Has Available</DropdownMenuItem>
                  <DropdownMenuItem onClick={selectWithRes} className="cursor-pointer text-[12px]">Has Reservations</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Daily Transfer Tracker filter — Can Send Today / Has Reservations / Fully Reserved / Daily Limit Reached / All */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                  style={{ color: transferFilter !== 'all' ? '#22d3ee' : 'rgba(255,255,255,0.47)' }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {TRANSFER_FILTERS.find(f => f.value === transferFilter)?.label}
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  {TRANSFER_FILTERS.map(f => (
                    <DropdownMenuItem key={f.value} onClick={() => setTransferFilter(f.value)} className="cursor-pointer text-[12px]">
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Daily Transfer Tracker sort — Most/Least Available, Most Reserved, Most Recently Used */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                  style={{ color: transferSort !== 'none' ? '#22d3ee' : 'rgba(255,255,255,0.47)' }}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {TRANSFER_SORTS.find(s => s.value === transferSort)?.label}
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  {TRANSFER_SORTS.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setTransferSort(s.value)} className="cursor-pointer text-[12px]">
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Selection summary bar */}
          <AnimatePresence>
            {hasSelection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.20, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="glass-secondary rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(34,211,238,0.030) padding-box, linear-gradient(140deg, rgba(34,211,238,0.22), rgba(139,92,246,0.14) 55%, rgba(34,211,238,0.12)) border-box',
                    border: '1px solid transparent',
                  }}
                >
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
                    {/* Count */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <CheckSquare className="w-4 h-4" style={{ color: '#22d3ee' }} />
                      <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {selectedIds.size} account{selectedIds.size !== 1 ? 's' : ''} selected
                      </span>
                    </div>

                    <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.110)' }} />

                    {/* Totals */}
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        <p className="label-caps mb-0.5">Total</p>
                        <p className="text-[13px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {selTotal.toLocaleString()} R$
                        </p>
                      </div>
                      <div>
                        <p className="label-caps mb-0.5" style={{ color: '#34d399', opacity: 0.75 }}>Available</p>
                        <p className="text-[13px] font-bold tabular-nums" style={{ color: '#34d399' }}>
                          {selAvailable.toLocaleString()} R$
                        </p>
                      </div>
                      {selReserved > 0 && (
                        <div>
                          <p className="label-caps mb-0.5" style={{ color: '#f59e0b', opacity: 0.75 }}>Reserved</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{ color: '#f59e0b' }}>
                            {selReserved.toLocaleString()} R$
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={clearAll}
                      className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                      style={{ color: 'oklch(0.50 0.016 265)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#be123c'}
                      onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.50 0.016 265)'}
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
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
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.2 }}
            >
              {transferFilteredAccounts.map(account => (
                <motion.div key={account.id} variants={staggerItem}>
                  <AccountCard
                    account={account}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelected={selectedIds.has(account.id)}
                    onToggleSelect={() => toggleSelect(account.id)}
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
                  />
                </motion.div>
              ))}
            </motion.div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                      {depletedInventoryAccounts.map(account => (
                        <AccountCard
                          key={account.id}
                          account={account}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          isSelected={selectedIds.has(account.id)}
                          onToggleSelect={() => toggleSelect(account.id)}
                        />
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
