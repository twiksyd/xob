'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { RobloxAccount, AccountBatch, AllowanceSummary, TransferLog, TransferReservation } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import AccountBadge from '@/components/shared/AccountBadge'
import ChromeProfileBadge from '@/components/shared/ChromeProfileBadge'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import {
  MoreHorizontal, Edit2, Trash2, Pencil, AlertTriangle, CheckCircle2,
  ArrowRight, Archive, Check, X, Loader2, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getAvailableRobux, isDepleted, isPlusReminderActive } from '@/lib/utils/accounts'
import { formatRobux } from '@/lib/utils/pricing'
import {
  getAllowanceBand, ALLOWANCE_BAND_COLORS, QUICK_TRANSFER_AMOUNTS,
  DAILY_TRANSFER_LIMIT, LIFETIME_TRANSFER_LIMIT,
} from '@/lib/utils/transfers'

interface AccountCardProps {
  account: RobloxAccount
  onEdit: (account: RobloxAccount) => void
  onDelete: (id: string) => void
  /** Passed so the card can show "Remove from Batch" in its ⋯ menu. */
  batch?: AccountBatch | null
  isSelected?: boolean
  onRemoveFromBatch?: (accountId: string) => void
  allowance?: AllowanceSummary
  history?: TransferLog[]
  reservationQueue?: TransferReservation[]
  onQuickTransfer?: (amount: number) => Promise<void>
  onOpenReserveDialog?: () => void
  onOpenLogDialog?: () => void
  onEditTransferLog?: (log: TransferLog) => void
  onDeleteTransferLog?: (log: TransferLog) => void
  onFulfillReservation?: (reservationId: string) => Promise<void>
  onCancelReservation?: (reservationId: string) => Promise<void>
  onOpenSaleDialog?: () => void
  onDismissPlusReminder?: () => void
}

const COLOR_AVAILABLE = '#34d399'
const COLOR_RESERVED  = '#f59e0b'
const COLOR_CURRENT   = 'rgba(255,255,255,0.88)'

export default function AccountCard({
  account, onEdit, onDelete, batch = null, isSelected = false,
  onRemoveFromBatch,
  allowance, history = [], reservationQueue = [],
  onQuickTransfer, onOpenReserveDialog, onOpenLogDialog,
  onEditTransferLog, onDeleteTransferLog,
  onFulfillReservation, onCancelReservation, onOpenSaleDialog,
  onDismissPlusReminder,
}: AccountCardProps) {
  const showTransferTracker = allowance !== undefined
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customPending, setCustomPending] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const available     = getAvailableRobux(account)
  const depleted      = isDepleted(account)
  const isLow         = available < 500 && !depleted
  const isHigh        = account.current_robux >= 8000
  const plusReminder  = isPlusReminderActive(account)

  const availPct    = account.current_robux > 0 ? Math.min(100, (available / account.current_robux) * 100) : 0
  const reservedPct = account.current_robux > 0 ? Math.min(100 - availPct, (account.reserved_robux / account.current_robux) * 100) : 0
  const availDisplayColor = depleted
    ? 'rgba(255,255,255,0.40)'
    : available < 200 ? '#f43f5e'
    : available < 500 ? COLOR_RESERVED
    : COLOR_AVAILABLE

  const band       = allowance ? getAllowanceBand(allowance.available) : 'green'
  const bandColors = ALLOWANCE_BAND_COLORS[band]

  const lifetimeExhausted = allowance
    ? allowance.lifetime_sent + allowance.reserved >= LIFETIME_TRANSFER_LIMIT
    : false

  async function runQuickTransfer(amt: number) {
    setPendingAmount(amt)
    try { await onQuickTransfer?.(amt) } finally { setPendingAmount(null) }
  }

  async function submitCustomAmount() {
    const v = Number(customValue)
    if (!allowance || !(v > 0 && v <= allowance.available)) return
    setCustomPending(true)
    try {
      await onQuickTransfer?.(v)
      setCustomValue('')
      setCustomOpen(false)
    } finally { setCustomPending(false) }
  }

  async function runReservationAction(id: string, action: 'fulfill' | 'cancel') {
    setPendingReservationId(id)
    try {
      if (action === 'fulfill') await onFulfillReservation?.(id)
      else await onCancelReservation?.(id)
    } finally { setPendingReservationId(null) }
  }

  const cardStyle: CSSProperties = {}
  if (depleted && !isSelected) cardStyle.opacity = 0.58
  if (isSelected) {
    cardStyle.transform = 'scale(1.016)'
    cardStyle.boxShadow = '0 0 0 2px rgba(255,255,255,0.46), 0 8px 28px rgba(0,0,0,0.26)'
  } else if (isHigh) {
    cardStyle.boxShadow = 'inset 0 1px 0 rgba(52,211,153,0.09), 0 2px 14px rgba(52,211,153,0.05)'
  }
  if (plusReminder && !isSelected) {
    const orangeBorder = 'inset 0 0 0 1.5px rgba(234,88,12,0.38)'
    cardStyle.boxShadow = cardStyle.boxShadow ? `${cardStyle.boxShadow}, ${orangeBorder}` : orangeBorder
  }

  return (
    <div
      data-account-card-id={account.id}
      className="glass-card relative p-5 transition-all duration-200 group"
      style={cardStyle}
    >
      {/* Selection checkmark — absolute, outside the content flow */}
      {isSelected && (
        <div
          className="absolute top-2.5 left-2.5 z-30 w-[18px] h-[18px] rounded-full flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 1px 3px rgba(0,0,0,0.20)' }}
        >
          <Check className="w-2.5 h-2.5" style={{ color: '#080618' }} />
        </div>
      )}

      {/* Content — space-y-4 is scoped here so the absolute checkmark doesn't affect it */}
      <div className="space-y-4">

        {/* 1. Avatar + Username + Status */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <RobloxAvatar
              username={account.username}
              userId={account.roblox_user_id}
              size={40}
              className="text-base"
              gradient={
                isHigh
                  ? 'linear-gradient(135deg, #34d399, #22d3ee)'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))'
              }
              glow={
                isHigh
                  ? '0 0 10px rgba(52,211,153,0.20)'
                  : '0 0 5px rgba(139,92,246,0.10)'
              }
            />
            <div className="min-w-0 flex-1">
              <p
                data-no-card-select
                className="text-[14px] font-bold truncate leading-snug"
                style={{ color: 'rgba(255,255,255,0.90)', userSelect: 'text', cursor: 'text' }}
              >
                {account.username}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <StatusBadge status={account.status} />
                {depleted && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.055)', color: 'rgba(255,255,255,0.36)', border: '1px solid rgba(255,255,255,0.085)' }}
                  >
                    <Archive className="w-2.5 h-2.5" /> Depleted
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {account.chrome_profile && (
              <ChromeProfileBadge profile={account.chrome_profile} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-no-card-select
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity opacity-20 group-hover:opacity-55"
                style={{ color: 'rgba(255,255,255,0.60)' }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-[12px]">
                <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 cursor-pointer text-[12px]">
                  <Edit2 className="w-3.5 h-3.5" /> Edit Account
                </DropdownMenuItem>
                {batch && onRemoveFromBatch && (
                  <DropdownMenuItem
                    onClick={() => onRemoveFromBatch(account.id)}
                    className="gap-2 cursor-pointer text-[12px]"
                    style={{ color: 'rgba(255,255,255,0.52)' }}
                  >
                    <X className="w-3.5 h-3.5" /> Remove from Batch
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(account.id)}
                  className="gap-2 cursor-pointer text-[12px] text-red-500 focus:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 2. Badges: PLUS · SUPER DISCOUNTED · DISCOUNT · CostRate */}
        {(account.is_plus_account || account.has_super_discount || account.has_active_discount || account.robux_cost_rate > 0) && (
          <div className="relative z-10 flex items-center flex-wrap gap-1.5">
            {account.is_plus_account && <AccountBadge type="plus" />}
            {plusReminder && (
              <motion.button
                type="button"
                data-no-card-select
                animate={{ opacity: [0.70, 1, 0.70] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                onClick={e => { e.stopPropagation(); onDismissPlusReminder?.() }}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(234,88,12,0.14)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.30)', cursor: 'pointer' }}
                title="Click to dismiss after turning off auto-renewal"
              >
                ⚠ TURN OFF PLUS
              </motion.button>
            )}
            {account.has_super_discount && <AccountBadge type="super_discount" />}
            {account.has_active_discount && <AccountBadge type="discount" />}
            {account.robux_cost_rate > 0 && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(167,139,250,0.07)', color: 'rgba(167,139,250,0.52)', border: '1px solid rgba(167,139,250,0.13)' }}
              >
                ₱{account.robux_cost_rate}/1k R$
              </span>
            )}
          </div>
        )}

        {/* 3. Current / Available / Reserved */}
        <div className="relative z-10 grid grid-cols-3 gap-2">
          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(255,255,255,0.048)', border: '1px solid rgba(255,255,255,0.068)' }}
          >
            <p className="label-caps mb-1">Current</p>
            <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: COLOR_CURRENT }}>
              {account.current_robux.toLocaleString()}
            </p>
            <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'oklch(0.65 0.010 265)' }}>R$</p>
          </div>

          <div
            className="rounded-xl p-2.5 text-center"
            style={{
              background: available > 0 ? 'rgba(52,211,153,0.06)' : 'rgba(244,63,94,0.05)',
              border: `1px solid ${available > 0 ? 'rgba(52,211,153,0.14)' : 'rgba(244,63,94,0.14)'}`,
            }}
          >
            <p className="label-caps mb-1" style={{ color: availDisplayColor, opacity: 0.70 }}>Available</p>
            <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: availDisplayColor }}>
              {available.toLocaleString()}
            </p>
            <p className="text-[9px] font-semibold mt-0.5" style={{ color: availDisplayColor, opacity: 0.58 }}>R$</p>
          </div>

          <div
            className="rounded-xl p-2.5 text-center"
            style={{
              background: account.reserved_robux > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.038)',
              border: `1px solid ${account.reserved_robux > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.055)'}`,
            }}
          >
            <p className="label-caps mb-1" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.42)', opacity: 0.70 }}>Reserved</p>
            <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.38)' }}>
              {account.reserved_robux.toLocaleString()}
            </p>
            <p className="text-[9px] font-semibold mt-0.5" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'oklch(0.65 0.010 265)', opacity: 0.58 }}>R$</p>
          </div>
        </div>

        {/* 4. Allocation bar */}
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-1.5">
            <span className="label-caps">Allocation</span>
            <div className="flex items-center gap-3">
              {account.reserved_robux > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: COLOR_RESERVED }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: COLOR_RESERVED }} />
                  {account.reserved_robux.toLocaleString()} reserved
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: availDisplayColor }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: availDisplayColor }} />
                {available.toLocaleString()} free
              </span>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.085)' }}>
            {availPct > 0 && (
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${availPct}%`,
                  background: availDisplayColor,
                  borderRadius: reservedPct > 0 ? '0' : '0 99px 99px 0',
                }}
              />
            )}
            {reservedPct > 0 && (
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${reservedPct}%`,
                  background: COLOR_RESERVED,
                  borderRadius: availPct > 0 ? '0 99px 99px 0' : '0',
                }}
              />
            )}
          </div>
          {isLow && (
            <p className="flex items-center gap-1.5 mt-2 text-[11px] font-medium" style={{ color: '#d97706' }}>
              <AlertTriangle className="w-3 h-3" /> Low balance
            </p>
          )}
        </div>

        {/* 5. Daily Transfer Tracker */}
        {showTransferTracker && (
          <div className="relative z-10 space-y-2.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.068)' }}>
            <div className="flex items-center justify-between">
              <span className="label-caps">Daily Transfer</span>
              <span
                className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: bandColors.bg, color: bandColors.text, border: `1px solid ${bandColors.border}` }}
                title="Available quota for today"
              >
                {bandColors.icon} {allowance!.available}/{DAILY_TRANSFER_LIMIT}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.13)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: '#34d399', opacity: 0.72 }}>Sent</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                  {formatRobux(allowance!.sent_today)}
                </p>
              </div>
              <div
                className="rounded-lg p-2 text-center"
                style={{
                  background: allowance!.reserved > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.038)',
                  border: `1px solid ${allowance!.reserved > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.058)'}`,
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: allowance!.reserved > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.36)', opacity: 0.80 }}>Reserved</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '13px', fontWeight: 800, color: allowance!.reserved > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.34)' }}>
                  {formatRobux(allowance!.reserved)}
                </p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: bandColors.bg, border: `1px solid ${bandColors.border}` }}>
                <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: bandColors.text, opacity: 0.78 }}>Available</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '13px', fontWeight: 800, color: bandColors.text }}>
                  {formatRobux(allowance!.available)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: lifetimeExhausted ? '#f87171' : 'rgba(255,255,255,0.34)' }}>
              <span>Lifetime</span>
              <span className="tabular-nums">{formatRobux(allowance!.lifetime_sent)} / {formatRobux(LIFETIME_TRANSFER_LIMIT)}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.075)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (allowance!.lifetime_sent / LIFETIME_TRANSFER_LIMIT) * 100)}%`,
                  background: lifetimeExhausted ? '#f87171' : 'rgba(255,255,255,0.26)',
                }}
              />
            </div>

            {allowance!.available <= 0 ? (
              <p
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.038)', color: 'rgba(255,255,255,0.36)', border: '1px solid rgba(255,255,255,0.060)' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lifetimeExhausted ? 'Lifetime limit reached' : 'Daily limit reached'}
              </p>
            ) : (
              <div className="space-y-2">
                {!customOpen ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_TRANSFER_AMOUNTS.map(amt => {
                      const isPending = pendingAmount === amt
                      return (
                        <motion.button
                          key={amt}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          disabled={amt > allowance!.available || pendingAmount !== null}
                          onClick={e => { e.stopPropagation(); runQuickTransfer(amt) }}
                          className="flex items-center justify-center py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-30"
                          style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.18)' }}
                        >
                          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `+${amt}`}
                        </motion.button>
                      )
                    })}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={pendingAmount !== null}
                      onClick={e => { e.stopPropagation(); setCustomOpen(true) }}
                      className="flex items-center justify-center py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-30"
                      style={{ background: 'rgba(255,255,255,0.038)', color: 'rgba(255,255,255,0.52)', border: '1px solid rgba(255,255,255,0.072)' }}
                    >
                      Custom
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      autoFocus
                      min={1}
                      max={allowance!.available}
                      value={customValue}
                      onChange={e => setCustomValue(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => { if (e.key === 'Enter') submitCustomAmount() }}
                      placeholder={`Up to ${allowance!.available}`}
                      disabled={customPending}
                      className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12px] font-semibold tabular-nums focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.110)', color: 'rgba(255,255,255,0.88)' }}
                    />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={customPending}
                      onClick={e => { e.stopPropagation(); submitCustomAmount() }}
                      className="flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.18)' }}
                    >
                      {customPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send'}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={customPending}
                      onClick={e => { e.stopPropagation(); setCustomOpen(false); setCustomValue('') }}
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.038)', color: 'rgba(255,255,255,0.42)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                )}
              </div>
            )}

            {/* 6. Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={allowance!.available <= 0}
                onClick={e => { e.stopPropagation(); onOpenReserveDialog?.() }}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-colors disabled:opacity-30"
                style={{ background: 'rgba(245,158,11,0.08)', color: COLOR_RESERVED, border: '1px solid rgba(245,158,11,0.20)' }}
              >
                Reserve Amount
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={e => { e.stopPropagation(); onOpenLogDialog?.() }}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.038)', color: 'rgba(255,255,255,0.52)', border: '1px solid rgba(255,255,255,0.072)' }}
                title="Record a transfer that already happened"
              >
                Log Past Transfer
              </motion.button>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={e => { e.stopPropagation(); onOpenSaleDialog?.() }}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[12px] font-bold transition-colors"
              style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}
              title="Log a priced sale — credits the wallet"
            >
              Log Instant Send Sale
            </motion.button>

            {history.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.055)' }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setHistoryExpanded(v => !v) }}
                  className="w-full flex items-center justify-between gap-2 p-2.5"
                >
                  <span className="label-caps">Sent Today ({history.length})</span>
                  <ChevronDown
                    className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150"
                    style={{ color: 'rgba(255,255,255,0.36)', transform: historyExpanded ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                {historyExpanded && (
                  <div className="space-y-0.5 max-h-24 overflow-y-auto px-2.5 pb-2.5">
                    {history.map(log => (
                      <div key={log.id} className="group/log flex items-center gap-2 text-[11px]">
                        <span className="font-semibold flex-shrink-0" style={{ color: '#34d399' }}>+{formatRobux(log.amount)}</span>
                        <span className="flex-1 text-right" style={{ color: 'rgba(255,255,255,0.36)' }}>{format(new Date(log.sent_at), 'h:mm a')}</span>
                        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/log:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onEditTransferLog?.(log) }}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ color: 'rgba(255,255,255,0.42)' }}
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onDeleteTransferLog?.(log) }}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ color: '#f87171' }}
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reservationQueue.length > 0 && (
              <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.13)' }}>
                <p className="label-caps" style={{ color: COLOR_RESERVED, opacity: 0.72 }}>Reservation Queue</p>
                {reservationQueue.map(res => {
                  const isPending = pendingReservationId === res.id
                  return (
                    <div key={res.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate" style={{ color: 'rgba(255,255,255,0.76)' }}>
                          🟡 {res.customer_label || 'Reserved'} — {formatRobux(res.amount)}
                        </p>
                        {res.scheduled_for && (
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.36)' }}>
                            {format(new Date(res.scheduled_for), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          disabled={isPending}
                          onClick={e => { e.stopPropagation(); runReservationAction(res.id, 'fulfill') }}
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40"
                          style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399' }}
                          title="Mark fulfilled"
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          disabled={isPending}
                          onClick={e => { e.stopPropagation(); runReservationAction(res.id, 'cancel') }}
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40"
                          style={{ background: 'rgba(244,63,94,0.08)', color: '#f87171' }}
                          title="Cancel reservation"
                        >
                          <X className="w-3 h-3" />
                        </motion.button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {account.notes && (
          <p
            className="relative z-10 text-[11px] leading-snug truncate pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.38)' }}
          >
            {account.notes}
          </p>
        )}

        {/* 7. Ledger link */}
        <Link
          href={`/accounts/${account.id}`}
          data-no-card-select
          onClick={e => e.stopPropagation()}
          className="relative z-10 flex items-center justify-center gap-1.5 pt-2.5 text-[11px] font-bold transition-colors"
          style={{ borderTop: '1px solid rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.36)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#0e7490'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.36)'}
        >
          View Ledger <ArrowRight className="w-3 h-3" />
        </Link>

      </div>
    </div>
  )
}
