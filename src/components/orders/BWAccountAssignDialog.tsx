'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, AlertCircle, Users, ChevronDown, CheckCircle2 } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { RobloxAccount, OrderWithDetails } from '@/lib/types/database'
import { formatRobux } from '@/lib/utils/pricing'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import { isActiveLogicalOrder } from '@/lib/utils/orders'
import StatusBadge from '@/components/shared/StatusBadge'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup,
} from '@/components/ui/command'

// ── Public types ──────────────────────────────────────────────────────────────

export interface AssignmentItemResult {
  itemId: string
  gamepassName: string
  accountId: string | null
  assignOk: boolean
  reserveOk: boolean
  error: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Minimum available Robux required for an account to appear in the BW picker.
// Distinct from MIN_SELECTABLE_ROBUX (100) which gates bulk auto-select.
const MIN_ASSIGN_ROBUX = 90

// ── Helpers ───────────────────────────────────────────────────────────────────

function availColor(available: number, depleted: boolean): string {
  if (depleted) return 'rgba(255,255,255,0.40)'
  if (available < 200) return '#f43f5e'
  if (available < 500) return '#f59e0b'
  return '#34d399'
}

// "Last Used" means the most recent COMPLETED order for the same gamepass or game.
// Pending/paid orders are excluded — the account was assigned but not actually used.
// Falls back to null if no completed history exists; no badge is shown in that case.
function findLastUsedAccountId(
  rawOrders: OrderWithDetails[],
  excludedIds: Set<string>,
  gamepassId: string | null,
  gameName: string | null,
): string | null {
  const candidates = rawOrders
    .filter(o =>
      !excludedIds.has(o.id) &&
      o.roblox_account_id !== null &&
      o.status === 'completed' &&
      (
        (gamepassId !== null && o.gamepass_id === gamepassId) ||
        (gameName !== null &&
          (o.gamepasses as { games?: { name?: string } } | null)?.games?.name === gameName)
      ),
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return candidates[0]?.roblox_account_id ?? null
}

// ── Account option card (picker list) ────────────────────────────────────────

function AccountOptionCard({
  account,
  robuxRequired,
  isLastUsed,
  isSelected,
}: {
  account: RobloxAccount
  robuxRequired: number
  isLastUsed: boolean
  isSelected: boolean
}) {
  const available = getAvailableRobux(account)
  const dep = isDepleted(account)
  const canAfford = available >= robuxRequired
  const color = availColor(available, dep)

  return (
    <div className="flex items-center gap-2.5 w-full min-w-0 py-0.5">
      <RobloxAvatar username={account.username} userId={account.roblox_user_id} size={30} glow="none" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {account.username}
          </span>
          {isLastUsed && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.16)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.24)' }}
            >
              Last Used
            </span>
          )}
          {!canAfford && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.20)' }}
            >
              Low
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={account.status} />
          <span className="text-[10px] tabular-nums font-semibold" style={{ color }}>
            {formatRobux(available)} R$ avail.
          </span>
        </div>
      </div>
      {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#34d399' }} />}
    </div>
  )
}

// ── Selected account card ─────────────────────────────────────────────────────

function SelectedAccountCard({
  account,
  robuxRequired,
  onRemove,
  onChange,
  readOnly,
}: {
  account: RobloxAccount
  robuxRequired: number
  onRemove: () => void
  onChange: () => void
  readOnly: boolean
}) {
  const available = getAvailableRobux(account)
  const dep = isDepleted(account)
  const canAfford = available >= robuxRequired
  const color = availColor(available, dep)

  return (
    <div
      className="rounded-xl flex items-center gap-3 px-3 py-2.5"
      style={{
        background: canAfford ? 'rgba(52,211,153,0.05)' : 'rgba(245,158,11,0.05)',
        border: `1px solid ${canAfford ? 'rgba(52,211,153,0.18)' : 'rgba(245,158,11,0.22)'}`,
      }}
    >
      <RobloxAvatar username={account.username} userId={account.roblox_user_id} size={36} glow="none" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {account.username}
          </span>
          <StatusBadge status={account.status} />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {'Current '}
            <span className="tabular-nums" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {formatRobux(account.current_robux ?? 0)}
            </span>
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {'Avail '}
            <span className="tabular-nums font-bold" style={{ color }}>
              {formatRobux(available)}
            </span>
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {'Rsv '}
            <span className="tabular-nums" style={{ color: '#f59e0b' }}>
              {formatRobux(account.reserved_robux ?? 0)}
            </span>
          </span>
        </div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onChange}
            className="text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}
          >
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.16)', color: '#f43f5e' }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Inline account picker ─────────────────────────────────────────────────────

function AccountPicker({
  accounts,
  selectedId,
  robuxRequired,
  lastUsedId,
  placeholder,
  onSelect,
  onCancel,
  showCancel,
}: {
  accounts: RobloxAccount[]
  selectedId: string | null
  robuxRequired: number
  lastUsedId: string | null
  placeholder?: string
  onSelect: (accountId: string) => void
  onCancel?: () => void
  showCancel?: boolean
}) {
  const [search, setSearch] = useState('')

  const eligible = useMemo(
    () => accounts.filter(a => {
      const avail = getAvailableRobux(a)
      return avail >= MIN_ASSIGN_ROBUX && avail >= robuxRequired
    }),
    [accounts, robuxRequired],
  )

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? eligible.filter(a => a.username.toLowerCase().includes(q)) : eligible
    return [...filtered].sort((a, b) => {
      if (a.id === lastUsedId) return -1
      if (b.id === lastUsedId) return 1
      return getAvailableRobux(b) - getAvailableRobux(a)
    })
  }, [eligible, search, lastUsedId])

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={placeholder ?? 'Search accounts…'}
        />
        <CommandList className="max-h-52">
          {sorted.length === 0 && (
            <CommandEmpty>
              <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {eligible.length === 0
                  ? `No accounts with ${MIN_ASSIGN_ROBUX}+ R$ available`
                  : 'No accounts match your search'}
              </span>
            </CommandEmpty>
          )}
          {sorted.length > 0 && (
            <CommandGroup>
              {sorted.map(acc => (
                <CommandItem
                  key={acc.id}
                  value={acc.username}
                  onSelect={() => { onSelect(acc.id); setSearch('') }}
                >
                  <AccountOptionCard
                    account={acc}
                    robuxRequired={robuxRequired}
                    isLastUsed={acc.id === lastUsedId}
                    isSelected={acc.id === selectedId}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
      {showCancel && onCancel && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-[11px] font-semibold py-1.5 rounded-lg text-center"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.32)' }}
          >
            Keep current account
          </button>
        </div>
      )}
    </div>
  )
}

// ── Picker trigger button ─────────────────────────────────────────────────────

function PickerTrigger({ onClick, placeholder }: { onClick: () => void; placeholder?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-left"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
    >
      <span className="flex-1">{placeholder ?? 'Select account…'}</span>
      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
    </button>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

interface BWAccountAssignDialogProps {
  order: LogicalOrder
  accounts: RobloxAccount[]
  rawOrders: OrderWithDetails[]
  onClose: () => void
  onSave: (assignments: Record<string, string | null>) => Promise<AssignmentItemResult[]>
}

export default function BWAccountAssignDialog({
  order, accounts, rawOrders, onClose, onSave,
}: BWAccountAssignDialogProps) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {}
    for (const item of order.items) init[item.id] = item.robloxAccountId ?? null
    return init
  })
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveResults, setSaveResults] = useState<AssignmentItemResult[] | null>(null)

  // Guard setState calls after unmount (dialog may be removed while save is in flight)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const isActive = isActiveLogicalOrder(order)

  const excludedIds = useMemo(
    () => new Set(order.underlyingOrderIds),
    [order.underlyingOrderIds],
  )

  const lastUsedIds = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const item of order.items) {
      map[item.id] = findLastUsedAccountId(rawOrders, excludedIds, item.gamepassId, item.gameName)
    }
    return map
  }, [rawOrders, excludedIds, order.items])

  // For "Apply to All": find a last-used account that can still cover the full order total
  const applyAllLastUsedId = useMemo(() => {
    const firstId = order.items[0] ? lastUsedIds[order.items[0].id] : null
    if (!firstId) return null
    const acc = accounts.find(a => a.id === firstId)
    if (!acc || getAvailableRobux(acc) < order.totalRobux) return null
    return firstId
  }, [lastUsedIds, order.items, order.totalRobux, accounts])

  function setItem(itemId: string, accountId: string | null) {
    setAssignments(prev => ({ ...prev, [itemId]: accountId }))
    // Clear any previous save result for this item so the user can retry cleanly
    setSaveResults(prev => prev
      ? prev.map(r => r.itemId === itemId ? { ...r, assignOk: true, reserveOk: true, error: null } : r)
      : null)
  }

  function applyToAll(accountId: string) {
    const next: Record<string, string | null> = {}
    for (const item of order.items) next[item.id] = accountId
    setAssignments(next)
    setSaveResults(null)
    setOpenPickerId(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveResults(null)
    try {
      const results = await onSave(assignments)
      if (!mountedRef.current) return
      const allOk = results.every(r => r.assignOk && r.reserveOk)
      if (allOk) {
        onClose() // parent has shown toast; dialog unmounts
      } else {
        setSaveResults(results)
        setSaving(false)
      }
    } catch {
      if (mountedRef.current) setSaving(false)
    }
  }

  const assignedCount = order.items.filter(i => assignments[i.id]).length
  const allAssigned = assignedCount === order.items.length

  // Save result summary for the footer
  const failedCount = saveResults ? saveResults.filter(r => !r.assignOk || !r.reserveOk).length : 0
  const savedCount  = saveResults ? saveResults.filter(r => r.assignOk && r.reserveOk).length : 0

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'rgba(4,4,12,0.82)', backdropFilter: 'blur(18px)' }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg flex flex-col rounded-3xl overflow-hidden"
        initial={{ scale: 0.94, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'oklch(0.080 0.012 265)',
          border: '1px solid rgba(34,211,238,0.20)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              BudgetWise Order
            </p>
            <h2 className="font-black text-[17px]" style={{ color: 'rgba(255,255,255,0.90)' }}>
              Assign Accounts
            </h2>
            <p className="font-mono text-[12px] mt-0.5" style={{ color: '#22d3ee' }}>
              {order.orderNumber}
              {order.buyerName ? ` · ${order.buyerName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center ml-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Locked notice for inactive orders */}
          {!isActive && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>
                This order is not active — assignments are read-only.
              </p>
            </div>
          )}

          {/* Apply to All (multi-item active orders) */}
          {order.items.length > 1 && isActive && (
            <div
              className="rounded-2xl p-3 space-y-2"
              style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22d3ee' }} />
                <p className="text-[11px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.50)' }}>
                  Apply one account to all {order.items.length} items
                </p>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  {formatRobux(order.totalRobux)} R$ total required
                </span>
              </div>
              {openPickerId === 'apply-all' ? (
                <AccountPicker
                  accounts={accounts}
                  selectedId={null}
                  robuxRequired={order.totalRobux}
                  lastUsedId={applyAllLastUsedId}
                  placeholder="Search accounts for all items…"
                  onSelect={applyToAll}
                  onCancel={() => setOpenPickerId(null)}
                  showCancel
                />
              ) : (
                <PickerTrigger
                  onClick={() => setOpenPickerId('apply-all')}
                  placeholder="Apply one account to all items…"
                />
              )}
            </div>
          )}

          {/* Per-item rows */}
          {order.items.map(item => {
            const currentAccId = assignments[item.id] ?? null
            const currentAcc = accounts.find(a => a.id === currentAccId) ?? null
            const itemOpen = openPickerId === item.id
            const itemResult = saveResults?.find(r => r.itemId === item.id)
            const itemOk = itemResult ? (itemResult.assignOk && itemResult.reserveOk) : null

            return (
              <div
                key={item.id}
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: 'rgba(255,255,255,0.030)',
                  border: itemOk === false
                    ? '1px solid rgba(244,63,94,0.22)'
                    : '1px solid rgba(255,255,255,0.065)',
                }}
              >
                {/* Item header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {item.gamepassName}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {item.gameName ? `${item.gameName} · ` : ''}
                      {item.robuxAmount.toLocaleString()} R$ required
                    </p>
                  </div>
                  {/* Save result badge */}
                  {itemOk === true && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" style={{ color: '#34d399' }} />
                      <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>Saved</span>
                    </div>
                  )}
                  {/* Ready/Low badge (shown before save) */}
                  {itemOk === null && currentAcc && !itemOpen && (
                    getAvailableRobux(currentAcc) >= item.robuxAmount ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Check className="w-3 h-3" style={{ color: '#34d399' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>Ready</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>Low</span>
                      </div>
                    )
                  )}
                </div>

                {/* Assignment area */}
                <AnimatePresence>
                  {itemOpen ? (
                    <motion.div
                      key="picker"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <AccountPicker
                        accounts={accounts}
                        selectedId={currentAccId}
                        robuxRequired={item.robuxAmount}
                        lastUsedId={lastUsedIds[item.id]}
                        onSelect={id => { setItem(item.id, id); setOpenPickerId(null) }}
                        onCancel={currentAcc ? () => setOpenPickerId(null) : undefined}
                        showCancel={!!currentAcc}
                      />
                    </motion.div>
                  ) : currentAcc ? (
                    <motion.div
                      key={`card-${currentAcc.id}`}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SelectedAccountCard
                        account={currentAcc}
                        robuxRequired={item.robuxAmount}
                        onRemove={() => setItem(item.id, null)}
                        onChange={() => setOpenPickerId(item.id)}
                        readOnly={!isActive}
                      />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      key="trigger"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <PickerTrigger onClick={() => setOpenPickerId(item.id)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <div
                        className="rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                          No account assigned
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Per-item save error */}
                {itemOk === false && itemResult?.error && (
                  <div
                    className="rounded-xl px-3 py-2 flex items-start gap-2"
                    style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)' }}
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f43f5e' }} />
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: '#f43f5e' }}>
                      {itemResult.error}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Status summary */}
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {saveResults && failedCount > 0
              ? `${savedCount} saved · ${failedCount} failed — fix and retry`
              : allAssigned
              ? `All ${order.items.length} item${order.items.length !== 1 ? 's' : ''} assigned`
              : assignedCount > 0
              ? `${assignedCount} of ${order.items.length} assigned`
              : 'No accounts assigned'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !isActive}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(56,189,238,0.10))',
                border: '1px solid rgba(34,211,238,0.28)',
                color: '#22d3ee',
              }}
            >
              {saving ? 'Saving…' : failedCount > 0 ? 'Retry Failed' : isActive ? 'Save Assignments' : 'Read Only'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
