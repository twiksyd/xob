'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import AccountCard from '@/components/accounts/AccountCard'
import AccountModal, { parseRobloxUserId } from '@/components/accounts/AccountModal'
import LiquidationForecast from '@/components/accounts/LiquidationForecast'
import CapitalReadinessTracker from '@/components/accounts/CapitalReadinessTracker'
import RestockAdvisor from '@/components/accounts/RestockAdvisor'
import { RobloxAccount, ReservationWithDetails, OrderWithItems } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import { calculateBusinessValue, classifyPurchase } from '@/lib/utils/capital'
import {
  Plus, Coins, Wallet, Users, Lock, ChevronDown, X,
  CheckSquare, Square, Zap, RefreshCw, Archive,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { springToggle, fadeUpVariants } from '@/lib/motion'

type StatsMode = 'all' | 'selected'
type PageTab = 'accounts' | 'planning'

const LS_SELECTED = 'xob-selected-accounts'
const LS_MODE     = 'xob-stats-mode'

export default function AccountsPage() {
  const [accounts, setAccounts]         = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [completedOrders, setCompletedOrders] = useState<OrderWithItems[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editAccount, setEditAccount]   = useState<RobloxAccount | null>(null)
  const [resExpanded, setResExpanded]   = useState(true)
  const [depletedExpanded, setDepletedExpanded] = useState(false)
  const [pageTab, setPageTab]           = useState<PageTab>('accounts')
  const [refreshingAvatars, setRefreshingAvatars] = useState(false)

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [statsMode, setStatsMode]       = useState<StatsMode>('all')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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
    const [accRes, resRes, ordersRes, walletRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').eq('status', 'completed'),
      supabase.rpc('get_wallet_balance'),
    ])
    if (!accRes.error && accRes.data) setAccounts(accRes.data)
    if (!resRes.error && resRes.data)  setReservations(resRes.data as ReservationWithDetails[])
    if (!ordersRes.error && ordersRes.data) setCompletedOrders(ordersRes.data as OrderWithItems[])
    if (!walletRes.error && walletRes.data != null) setWalletBalance(Number(walletRes.data))
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
    setEditAccount(null)
    fetchData()
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
  }

  // One-time backfill: resolve avatars for accounts that don't have one yet
  async function refreshAvatars() {
    const missing = accounts.filter(a => !a.roblox_user_id)
    if (missing.length === 0) return
    setRefreshingAvatars(true)
    for (const account of missing) {
      try {
        const res = await fetch(`/api/roblox-lookup?username=${encodeURIComponent(account.username)}`)
        if (!res.ok) continue
        const { userId } = await res.json()
        if (userId) {
          await supabase.from('roblox_accounts').update({ roblox_user_id: userId }).eq('id', account.id)
        }
      } catch {}
    }
    setRefreshingAvatars(false)
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account? Any remaining Robux balance will be written off with an audit record.')) return
    const { error } = await supabase.rpc('delete_roblox_account', { p_account_id: id })
    if (error) { alert(error.message); return }
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    fetchData()
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

  // Accounts used for summary bar (always selection-based)
  const selectedAccounts = useMemo(
    () => accounts.filter(a => selectedIds.has(a.id)),
    [accounts, selectedIds]
  )
  const selTotal     = selectedAccounts.reduce((s, a) => s + a.current_robux, 0)
  const selReserved  = selectedAccounts.reduce((s, a) => s + a.reserved_robux, 0)
  const selAvailable = selectedAccounts.reduce((s, a) => s + getAvailableRobux(a), 0)

  // Accounts used for top stat cards (depends on mode)
  const statsAccounts = useMemo(
    () => statsMode === 'all' ? accounts : selectedAccounts,
    [accounts, selectedAccounts, statsMode]
  )
  const totalRobux     = statsAccounts.reduce((s, a) => s + a.current_robux, 0)
  const totalReserved  = statsAccounts.reduce((s, a) => s + a.reserved_robux, 0)
  const availableRobux = statsAccounts.reduce((s, a) => s + getAvailableRobux(a), 0)
  const activeAccounts = statsAccounts.filter(a => a.status === 'active').length

  const statAnimKey    = `${statsMode}-${selectedIds.size}-${totalRobux}`

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
  const statsSubtitle   = statsMode === 'selected'
    ? selectedIds.size === 0 ? 'No accounts selected' : `${selectedIds.size} account${selectedIds.size !== 1 ? 's' : ''} selected`
    : `Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`

  return (
    <div>
      <TopBar
        title="Roblox Accounts"
        subtitle="Manage your seller accounts and reservations"
        actionLabel="+ Add Account"
        onActionClick={() => { setEditAccount(null); setModalOpen(true) }}
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

        {/* ── Stock Liquidation Forecast ── */}
        {loading ? (
          <div className="glass-elevated p-5 h-64 animate-pulse" />
        ) : (
          <LiquidationForecast
            accounts={accounts}
            selectedIds={selectedIds}
            completedOrders={completedOrders}
            walletBalance={walletBalance}
          />
        )}

        {/* ── Capital Readiness Tracker ── */}
        {loading ? (
          <div className="glass-elevated p-5 h-64 animate-pulse" />
        ) : (
          <CapitalReadinessTracker
            accounts={activeInventoryAccounts}
            walletBalance={walletBalance}
          />
        )}

        {/* ── Restock Advisor ── */}
        {loading ? (
          <div className="glass-elevated p-5 h-64 animate-pulse" />
        ) : (
          <RestockAdvisor
            accounts={activeInventoryAccounts}
            completedOrders={completedOrders}
            walletBalance={walletBalance}
          />
        )}

        </motion.div>
        ) : (
        <motion.div key="accounts" variants={fadeUpVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">

        {/* ── Stats mode toggle + stat cards ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-caps">Account Summary</span>
            <div className="metric-toggle">
              {(['all', 'selected'] as StatsMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setStatsMode(m)}
                  className={`metric-toggle-btn ${statsMode === m ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
                >
                  {statsMode === m && (
                    <motion.div layoutId="acc-toggle-bg" className="metric-toggle-bg" transition={springToggle} />
                  )}
                  <span className="relative z-10">
                    {m === 'all' ? 'All Accounts' : `Selected${hasSelection ? ` (${selectedIds.size})` : ''}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard
              title="Total Robux"
              value={`${totalRobux.toLocaleString()} R$`}
              subtitle={statsSubtitle}
              icon={Coins} iconColor="#a78bfa" accentColor="#a78bfa"
              animKey={statAnimKey}
            />
            <StatCard
              title="Available Robux"
              value={`${availableRobux.toLocaleString()} R$`}
              subtitle="Ready to fulfill orders"
              icon={Wallet} iconColor="#34d399" accentColor="#34d399"
              animKey={statAnimKey}
            />
            <StatCard
              title="Reserved Robux"
              value={`${totalReserved.toLocaleString()} R$`}
              subtitle={`${reservations.length} active reservation${reservations.length !== 1 ? 's' : ''}`}
              icon={Lock} iconColor="#f59e0b" accentColor="#f59e0b"
              animKey={statAnimKey}
            />
            <StatCard
              title="Active Accounts"
              value={`${activeAccounts} / ${statsAccounts.length}`}
              subtitle="Currently active"
              icon={Users} iconColor="#22d3ee" accentColor="#22d3ee"
              animKey={statAnimKey}
            />
          </div>
        </div>

        {/* ── Account grid section ── */}
        <div className="space-y-3">

          {/* Grid header + quick filters */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Active Accounts ({activeInventoryAccounts.length})
                </p>
                {depletedInventoryAccounts.length > 0 && (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                    Depleted: <b className="tabular-nums" style={{ color: 'rgba(255,255,255,0.42)' }}>{depletedInventoryAccounts.length}</b>
                    {' · '}Potential cleanup: <b className="tabular-nums" style={{ color: 'rgba(255,255,255,0.42)' }}>{depletedInventoryAccounts.length} account{depletedInventoryAccounts.length !== 1 ? 's' : ''}</b>
                  </span>
                )}
              </div>
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
                {/* Select all / none toggle */}
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
              </div>
            </div>

            {/* Quick filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Active Only',      action: selectActive,    icon: '●' },
                { label: 'High Balance',     action: selectHighBal,   icon: '▲' },
                { label: 'Has Available',    action: selectAvailable, icon: '✓' },
                { label: 'Has Reservations', action: selectWithRes,   icon: '⬡' },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex items-center gap-1 h-[26px] px-2.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.065)',
                    border: '1px solid rgba(255,255,255,0.100)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(34,211,238,0.07)'
                    e.currentTarget.style.borderColor = 'rgba(34,211,238,0.22)'
                    e.currentTarget.style.color = '#0e7490'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.065)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.100)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
                  }}
                >
                  <Zap className="w-3 h-3 opacity-60" />
                  {label}
                </button>
              ))}
              {hasSelection && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 h-[26px] px-2.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: 'rgba(244,63,94,0.06)',
                    border: '1px solid rgba(244,63,94,0.16)',
                    color: '#be123c',
                  }}
                >
                  <X className="w-3 h-3" /> Clear ({selectedIds.size})
                </button>
              )}
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

                    {/* Use for stats toggle hint */}
                    {statsMode === 'all' && (
                      <button
                        onClick={() => setStatsMode('selected')}
                        className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          background: 'rgba(34,211,238,0.08)',
                          color: '#0e7490',
                          border: '1px solid rgba(34,211,238,0.20)',
                        }}
                      >
                        Use for stats ↑
                      </button>
                    )}

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
                <div key={i} className="glass-card p-5 h-52 animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Coins className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No accounts yet. Add your first Roblox account.</p>
              <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2 bg-primary text-primary-foreground text-xs h-8">
                <Plus className="w-3.5 h-3.5" /> Add Account
              </Button>
            </div>
          ) : activeInventoryAccounts.length === 0 ? (
            <div className="glass-card p-12 text-center" style={{ opacity: 0.75 }}>
              <Archive className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
              <p className="text-sm text-muted-foreground">No active inventory — all accounts are depleted.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeInventoryAccounts.map(account => (
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

        {/* ── Reservations panel ── */}
        {!loading && (
          <div className="space-y-3">
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
    </div>
  )
}
