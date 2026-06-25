'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import CountUp from '@/components/shared/CountUp'
import { SellerAccountWithVehicles } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Archive, Plus, Check, X, ChevronDown, ChevronUp,
  Layers, MoreHorizontal, Edit2, Trash2, Car, Wrench, TrendingUp,
} from 'lucide-react'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import { SkeletonCard } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { useUrlState } from '@/hooks/useUrlState'

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

// ─── Readiness ────────────────────────────────────────────────────────────────
type Readiness = { label: string; color: string; bg: string; border: string; accent: string }

function getReadiness(acc: SellerAccountWithVehicles): Readiness {
  const limitedCount = (acc.seller_account_vehicles ?? []).filter(v => v.is_limited).length
  if (!acc.has_drag_spec) return {
    label: 'Needs Drag Spec',
    color: '#92400e', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.24)', accent: '#f59e0b',
  }
  if (limitedCount === 0) return {
    label: 'Needs Limiteds',
    color: '#9f1239', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.22)', accent: '#f43f5e',
  }
  return {
    label: 'Ready For Sale',
    color: '#065f46', bg: 'rgba(52,211,153,0.09)', border: 'rgba(52,211,153,0.24)', accent: '#34d399',
  }
}

// ─── Account inventory card ───────────────────────────────────────────────────
interface CardProps {
  account: SellerAccountWithVehicles
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleDragSpec: () => void
  onRemoveVehicle: (vehicleId: string) => void
  onAddVehicle: (name: string, isLimited: boolean) => void
  onEdit: () => void
  onDelete: () => void
  isBusy?: boolean
}

function InventoryCard({
  account, isExpanded, onToggleExpand, onToggleDragSpec,
  onRemoveVehicle, onAddVehicle, onEdit, onDelete, isBusy,
}: CardProps) {
  const [vehicleName, setVehicleName]   = useState('')
  const [vehicleLimited, setVehicleLimited] = useState(true)
  const vehicles    = account.seller_account_vehicles ?? []
  const limiteds    = vehicles.filter(v => v.is_limited)
  const readiness   = getReadiness(account)

  function handleAddVehicle() {
    if (!vehicleName.trim()) return
    onAddVehicle(vehicleName.trim(), vehicleLimited)
    setVehicleName('')
    setVehicleLimited(true)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card overflow-hidden relative group flex flex-col"
    >
      {/* Readiness accent bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[3px]"
        style={{ background: readiness.accent, boxShadow: `0 0 8px ${readiness.accent}60` }}
      />

      <div className="pl-5 pr-4 pt-4 pb-3 flex-1 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {account.username}
              </p>
              {/* Readiness badge */}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: readiness.bg, color: readiness.color, border: `1px solid ${readiness.border}` }}
              >
                {readiness.label}
              </span>
            </div>
            {account.display_name && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.44)' }}>
                {account.display_name}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-30 group-hover:opacity-100"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border text-[12px]">
              <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer text-[12px]">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={onDelete} className="gap-2 cursor-pointer text-[12px] text-red-400 focus:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick toggles row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Drag Spec toggle */}
          <button
            onClick={onToggleDragSpec}
            disabled={isBusy}
            className="flex items-center gap-1.5 h-7 px-3 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50"
            style={account.has_drag_spec
              ? { background: 'rgba(52,211,153,0.10)', color: '#047857', border: '1px solid rgba(52,211,153,0.26)' }
              : { background: 'rgba(245,158,11,0.08)', color: '#92400e', border: '1px solid rgba(245,158,11,0.22)' }
            }
          >
            {account.has_drag_spec
              ? <Check className="w-3 h-3" />
              : <Wrench className="w-3 h-3" />
            }
            {account.has_drag_spec ? 'Drag Spec' : 'No Drag Spec'}
          </button>

          {/* Limited count */}
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 h-7 px-3 rounded-xl text-[11px] font-bold transition-all"
            style={{ background: 'rgba(34,211,238,0.07)', color: '#0e7490', border: '1px solid rgba(34,211,238,0.18)' }}
          >
            <Layers className="w-3 h-3" />
            {limiteds.length} Limited{limiteds.length !== 1 ? 's' : ''}
          </button>

          {vehicles.length !== limiteds.length && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
              +{vehicles.length - limiteds.length} non-ltd
            </span>
          )}
        </div>

        {/* Price */}
        {account.estimated_price != null && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" style={{ color: '#a78bfa' }} />
            <span className="text-[13px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {formatPHP(Number(account.estimated_price))}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.50)' }}>estimated</span>
          </div>
        )}

        {/* Notes */}
        {account.notes && (
          <p className="text-[11px] leading-snug truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {account.notes}
          </p>
        )}
      </div>

      {/* Vehicles section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.088)' }}>
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-between px-5 py-2.5 text-[11px] font-semibold transition-colors hover:bg-black/[0.02]"
          style={{ color: 'rgba(255,255,255,0.47)' }}
        >
          <span className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" />
            {vehicles.length === 0 ? 'No vehicles' : `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`}
          </span>
          {isExpanded
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </button>

        {/* Expanded vehicle list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.20, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-4 space-y-1.5">
                {/* Vehicle rows */}
                {vehicles.length === 0 ? (
                  <p className="text-[11px] py-2" style={{ color: 'oklch(0.65 0.010 265)' }}>
                    No vehicles added yet
                  </p>
                ) : (
                  vehicles.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 py-1.5 group/row"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.065)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: v.is_limited ? '#a78bfa' : 'oklch(0.65 0.010 265)' }}
                        />
                        <span className="text-[12px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
                          {v.name}
                        </span>
                        {v.is_limited && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#6d28d9', border: '1px solid rgba(167,139,250,0.22)' }}
                          >
                            Limited
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveVehicle(v.id)}
                        className="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-red-500/10 text-red-400 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}

                {/* Add vehicle form */}
                <div className="flex items-center gap-1.5 pt-2">
                  <input
                    type="text"
                    value={vehicleName}
                    onChange={e => setVehicleName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddVehicle() }}
                    placeholder="Vehicle name..."
                    className="flex-1 bg-input h-8 px-3 rounded-lg text-[12px] border border-border outline-none transition-all"
                    style={{ minWidth: 0 }}
                  />
                  <button
                    onClick={() => setVehicleLimited(p => !p)}
                    className="h-8 px-2.5 rounded-lg text-[10px] font-bold flex-shrink-0 transition-all"
                    style={vehicleLimited
                      ? { background: 'rgba(167,139,250,0.12)', color: '#6d28d9', border: '1px solid rgba(167,139,250,0.22)' }
                      : { background: 'rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.44)', border: '1px solid rgba(255,255,255,0.110)' }
                    }
                  >
                    {vehicleLimited ? '◆ Ltd' : '○ Non'}
                  </button>
                  <Button
                    onClick={handleAddVehicle}
                    disabled={!vehicleName.trim()}
                    variant="primary"
                    className="h-8 px-3 flex-shrink-0 gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'ready' | 'drag_spec' | 'needs_limiteds'
const FILTER_KEYS: readonly FilterKey[] = ['all', 'ready', 'drag_spec', 'needs_limiteds']

function SellerInventoryPageContent() {
  const [accounts, setAccounts]       = useState<SellerAccountWithVehicles[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editAccount, setEditAccount] = useState<SellerAccountWithVehicles | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [busyId, setBusyId]           = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useUrlState<FilterKey>('filter', 'all', FILTER_KEYS)

  // Modal form state
  const [fUsername, setFUsername]         = useState('')
  const [fDisplayName, setFDisplayName]   = useState('')
  const [fDragSpec, setFDragSpec]         = useState(false)
  const [fPrice, setFPrice]               = useState('')
  const [fNotes, setFNotes]               = useState('')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const toast = useToast()
  const confirm = useConfirm()

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('seller_accounts')
      .select('*, seller_account_vehicles(*)')
      .order('created_at', { ascending: false })
    if (data) setAccounts(data as SellerAccountWithVehicles[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Account CRUD ──────────────────────────────────────────────────────────
  function openNew() {
    setEditAccount(null)
    setFUsername(''); setFDisplayName(''); setFDragSpec(false); setFPrice(''); setFNotes('')
    setModalOpen(true)
  }

  function openEdit(acc: SellerAccountWithVehicles) {
    setEditAccount(acc)
    setFUsername(acc.username)
    setFDisplayName(acc.display_name ?? '')
    setFDragSpec(acc.has_drag_spec)
    setFPrice(acc.estimated_price != null ? String(acc.estimated_price) : '')
    setFNotes(acc.notes ?? '')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!fUsername.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      username:        fUsername.trim(),
      display_name:    fDisplayName.trim() || null,
      has_drag_spec:   fDragSpec,
      estimated_price: fPrice ? parseFloat(fPrice) : null,
      notes:           fNotes.trim() || null,
    }

    const wasEdit = !!editAccount
    if (editAccount) {
      await supabase.from('seller_accounts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editAccount.id)
    } else {
      await supabase.from('seller_accounts').insert({ ...payload, user_id: user.id })
    }

    setSaving(false)
    setModalOpen(false)
    setEditAccount(null)
    fetchData()
    toast.success(wasEdit ? 'Account updated.' : 'Account added.')
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this account?',
      description: 'This permanently removes the account and all of its vehicles from your seller inventory.',
      confirmLabel: 'Delete Account',
      danger: true,
    })
    if (!ok) return
    await supabase.from('seller_accounts').delete().eq('id', id)
    if (expandedId === id) setExpandedId(null)
    fetchData()
    toast.success('Account deleted.')
  }

  // ── Drag Spec toggle ──────────────────────────────────────────────────────
  async function toggleDragSpec(acc: SellerAccountWithVehicles) {
    setBusyId(acc.id)
    await supabase.from('seller_accounts')
      .update({ has_drag_spec: !acc.has_drag_spec, updated_at: new Date().toISOString() })
      .eq('id', acc.id)
    setBusyId(null)
    fetchData()
  }

  // ── Vehicle management ────────────────────────────────────────────────────
  async function addVehicle(accountId: string, name: string, isLimited: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('seller_account_vehicles').insert({
      user_id: user.id, seller_account_id: accountId, name, is_limited: isLimited,
    })
    fetchData()
  }

  async function removeVehicle(vehicleId: string) {
    await supabase.from('seller_account_vehicles').delete().eq('id', vehicleId)
    fetchData()
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let base = accounts

    if (search) {
      const q = search.toLowerCase()
      base = base.filter(a =>
        a.username.toLowerCase().includes(q) ||
        (a.display_name ?? '').toLowerCase().includes(q) ||
        (a.notes ?? '').toLowerCase().includes(q) ||
        a.seller_account_vehicles.some(v => v.name.toLowerCase().includes(q))
      )
    }

    if (filter !== 'all') {
      base = base.filter(a => {
        const r = getReadiness(a)
        if (filter === 'ready')         return r.label === 'Ready For Sale'
        if (filter === 'drag_spec')     return !a.has_drag_spec
        if (filter === 'needs_limiteds') return a.has_drag_spec && a.seller_account_vehicles.filter(v => v.is_limited).length === 0
        return true
      })
    }

    return base
  }, [accounts, search, filter])

  // Summary metrics
  const totalAccounts  = accounts.length
  const readyCount     = accounts.filter(a => getReadiness(a).label === 'Ready For Sale').length
  const noDragSpec     = accounts.filter(a => !a.has_drag_spec).length
  const totalLimiteds  = accounts.reduce((s, a) => s + a.seller_account_vehicles.filter(v => v.is_limited).length, 0)
  const totalValue     = accounts.reduce((s, a) => s + (Number(a.estimated_price) || 0), 0)

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',            label: `All (${totalAccounts})`       },
    { key: 'ready',          label: `Ready (${readyCount})`        },
    { key: 'drag_spec',      label: `No Drag Spec (${noDragSpec})` },
    { key: 'needs_limiteds', label: 'Needs Limiteds'               },
  ]

  return (
    <div>
      <TopBar
        title="Seller Inventory"
        subtitle="Track accounts being prepared for resale"
        searchPlaceholder="Search accounts or vehicles..."
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel="+ New Account"
        onActionClick={openNew}
      />
      <PageHero
        badge="Seller Catalog"
        title="Seller Accounts"
        subtitle="Public-facing gamepass listings and pricing for your resale channels."
        gradient="linear-gradient(135deg, #38bdf8 0%, #a78bfa 60%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">

        {/* ── 01 · Catalog Overview ── */}
        <SectionLabel index="01" label="Catalog Overview" />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-5 gap-3.5"
          variants={cardStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.4 }}
        >
          {([
            { title: 'Total Accounts', value: totalAccounts, format: (v: number) => `${Math.round(v)}`, icon: Archive, color: '#a78bfa', featured: false },
            { title: 'Ready For Sale', value: readyCount,    format: (v: number) => `${Math.round(v)}`, icon: Check,   color: '#34d399', featured: false },
            { title: 'Missing Drag Spec', value: noDragSpec, format: (v: number) => `${Math.round(v)}`, icon: Wrench,  color: '#f59e0b', featured: false },
            { title: 'Limited Vehicles', value: totalLimiteds, format: (v: number) => `${Math.round(v)}`, icon: Layers, color: '#22d3ee', featured: false },
            { title: 'Inventory Value', value: totalValue, format: (v: number) => formatPHP(v), icon: TrendingUp, color: '#e879f9', featured: true },
          ] as const).map(({ title, value, format, icon: Icon, color, featured }) => (
            <motion.div
              key={title}
              variants={cardStaggerItem}
              className={cn('summary-card', featured && 'featured-card')}
              style={featured ? ({ '--featured-color': color } as CSSProperties) : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps">{title}</p>
                <div
                  className={featured ? 'w-7 h-7 rounded-lg flex items-center justify-center' : 'w-6 h-6 rounded-lg flex items-center justify-center'}
                  style={{ background: `${color}18` }}
                >
                  <Icon className={featured ? 'w-4 h-4' : 'w-3.5 h-3.5'} style={{ color }} />
                </div>
              </div>
              <CountUp
                value={value}
                format={format}
                duration={1.2}
                className={cn('stat-value block', featured && 'featured-value')}
                style={featured ? { fontSize: '28px' } : { color, fontSize: '22px' }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* ── 02 · Account Inventory ── */}
        <SectionLabel index="02" label="Account Inventory" />

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`chip ${filter === key ? 'chip-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Account grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} lines={2} className="h-48" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search || filter !== 'all' ? (
            <EmptyState
              icon={Archive}
              title="No accounts match your filter"
              description="Try a different search term, or clear the active filter to see your full seller inventory."
              actionLabel="Clear Filters"
              onAction={() => { setSearch(''); setFilter('all') }}
            />
          ) : (
            <EmptyState
              icon={Archive}
              title="No seller accounts yet"
              description="Add accounts you're preparing for resale to start tracking readiness, vehicles, and inventory value."
              actionLabel="Add First Account"
              onAction={openNew}
            />
          )
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="popLayout">
              {filtered.map(account => (
                <InventoryCard
                  key={account.id}
                  account={account}
                  isExpanded={expandedId === account.id}
                  onToggleExpand={() => setExpandedId(p => p === account.id ? null : account.id)}
                  onToggleDragSpec={() => toggleDragSpec(account)}
                  onRemoveVehicle={removeVehicle}
                  onAddVehicle={(name, isLimited) => addVehicle(account.id, name, isLimited)}
                  onEdit={() => openEdit(account)}
                  onDelete={() => handleDelete(account.id)}
                  isBusy={busyId === account.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

      </div>

      {/* ── Add / Edit modal ── */}
      <Dialog open={modalOpen} onOpenChange={o => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold">
              {editAccount ? 'Edit Account' : 'Add Seller Account'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Roblox Username *
              </label>
              <input
                value={fUsername}
                onChange={e => setFUsername(e.target.value)}
                placeholder="username123"
                className="w-full bg-input h-9 px-3 rounded-lg text-[13px] border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Display Name <span style={{ color: 'oklch(0.62 0.010 265)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={fDisplayName}
                onChange={e => setFDisplayName(e.target.value)}
                placeholder="Display Name"
                className="w-full bg-input h-9 px-3 rounded-lg text-[13px] border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Drag Spec */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.76)' }}>Drag Spec Installed</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>Key selling feature</p>
              </div>
              <button
                type="button"
                onClick={() => setFDragSpec(p => !p)}
                className="flex items-center gap-2 h-8 px-4 rounded-xl text-[12px] font-bold transition-all"
                style={fDragSpec
                  ? { background: 'rgba(52,211,153,0.10)', color: '#047857', border: '1px solid rgba(52,211,153,0.26)' }
                  : { background: 'rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.47)', border: '1px solid rgba(255,255,255,0.130)' }
                }
              >
                {fDragSpec ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {fDragSpec ? 'Installed' : 'Not Installed'}
              </button>
            </div>

            {/* Estimated Price */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Estimated Sale Price (₱) <span style={{ color: 'oklch(0.62 0.010 265)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="number"
                value={fPrice}
                onChange={e => setFPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-input h-9 px-3 rounded-lg text-[13px] border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Notes <span style={{ color: 'oklch(0.62 0.010 265)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={fNotes}
                onChange={e => setFNotes(e.target.value)}
                placeholder="Any notes about this account..."
                rows={3}
                className="w-full bg-input px-3 py-2 rounded-lg text-[13px] border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !fUsername.trim()}
              variant="primary"
              className="px-5"
            >
              {saving ? 'Saving...' : editAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// useUrlState() calls useSearchParams() internally — requires a Suspense
// boundary or the build's prerender pass fails even on a force-dynamic page.
export default function SellerInventoryPage() {
  return (
    <Suspense fallback={null}>
      <SellerInventoryPageContent />
    </Suspense>
  )
}
