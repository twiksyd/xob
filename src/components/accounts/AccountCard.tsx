'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { RobloxAccount, AllowanceSummary, TransferLog, TransferReservation } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import {
  MoreHorizontal, Edit2, Trash2, AlertTriangle, CheckCircle2, Circle, ArrowRight, Archive, Check, X,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import { formatRobux } from '@/lib/utils/pricing'
import { getAllowanceBand, ALLOWANCE_BAND_COLORS, QUICK_TRANSFER_AMOUNTS, DAILY_TRANSFER_LIMIT } from '@/lib/utils/transfers'

interface AccountCardProps {
  account: RobloxAccount
  onEdit: (account: RobloxAccount) => void
  onDelete: (id: string) => void
  isSelected?: boolean
  onToggleSelect?: () => void
  /** Daily Transfer Tracker — omit to hide the whole section (e.g. on depleted
   *  accounts, where sending 500 R$/day doesn't make sense). */
  allowance?: AllowanceSummary
  history?: TransferLog[]
  reservationQueue?: TransferReservation[]
  /** accountId (while a quick/custom send is in flight) or a reservationId
   *  (while fulfilling/cancelling that specific reservation). */
  busyId?: string | null
  onQuickTransfer?: (amount: number) => void
  onOpenReserveDialog?: () => void
  onFulfillReservation?: (reservationId: string) => void
  onCancelReservation?: (reservationId: string) => void
}

const COLOR_AVAILABLE = '#34d399'
const COLOR_RESERVED  = '#f59e0b'
const COLOR_CURRENT   = 'rgba(255,255,255,0.88)'

export default function AccountCard({
  account, onEdit, onDelete, isSelected = false, onToggleSelect,
  allowance, history = [], reservationQueue = [],
  busyId, onQuickTransfer, onOpenReserveDialog, onFulfillReservation, onCancelReservation,
}: AccountCardProps) {
  const showTransferTracker = allowance !== undefined
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const available   = getAvailableRobux(account)
  const depleted     = isDepleted(account)
  const isLow        = available < 500 && !depleted
  const isHigh       = account.current_robux >= 8000

  const availPct    = account.current_robux > 0 ? Math.min(100, (available / account.current_robux) * 100) : 0
  const reservedPct = account.current_robux > 0 ? Math.min(100 - availPct, (account.reserved_robux / account.current_robux) * 100) : 0
  const availDisplayColor = depleted ? 'rgba(255,255,255,0.48)' : available < 200 ? '#f43f5e' : available < 500 ? COLOR_RESERVED : COLOR_AVAILABLE

  const band = allowance ? getAllowanceBand(allowance.sent_today, allowance.reserved) : 'green'
  const bandColors = ALLOWANCE_BAND_COLORS[band]

  function submitCustomAmount() {
    const v = Number(customValue)
    if (allowance && v > 0 && v <= allowance.available) {
      onQuickTransfer?.(v)
      setCustomValue('')
      setCustomOpen(false)
    }
  }

  const cardStyle = isSelected
    ? {
        background: 'rgba(34,211,238,0.028) padding-box, linear-gradient(140deg, rgba(34,211,238,0.42), rgba(139,92,246,0.28) 55%, rgba(34,211,238,0.24)) border-box',
        boxShadow: '0 2px 20px rgba(34,211,238,0.12), 0 4px 24px rgba(255,255,255,0.065), inset 0 1.5px 0 rgba(34,211,238,0.30)',
      }
    : isHigh
    ? { boxShadow: '0 2px 16px rgba(52,211,153,0.07), 0 4px 24px rgba(255,255,255,0.065), inset 0 1px 0 rgba(52,211,153,0.14)' }
    : undefined

  return (
    <div
      className="glass-card p-5 space-y-4 transition-all duration-200 group"
      style={{ ...cardStyle, opacity: depleted && !isSelected ? 0.62 : undefined }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <RobloxAvatar
            username={account.username}
            userId={account.roblox_user_id}
            size={40}
            className="text-base"
            gradient={
              isSelected
                ? 'linear-gradient(135deg, #22d3ee, #a78bfa)'
                : isHigh
                ? 'linear-gradient(135deg, #34d399, #22d3ee)'
                : 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))'
            }
            glow={
              isSelected
                ? '0 0 14px rgba(34,211,238,0.35)'
                : isHigh
                ? '0 0 14px rgba(52,211,153,0.32)'
                : '0 0 8px rgba(139,92,246,0.16)'
            }
          />
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {account.username}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={account.status} />
              {showTransferTracker && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: bandColors.bg, color: bandColors.text, border: `1px solid ${bandColors.border}` }}
                  title="Daily instant-transfer allowance, resets at local midnight"
                >
                  {bandColors.icon} Available: {allowance!.available}/{DAILY_TRANSFER_LIMIT}
                </span>
              )}
              {depleted && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.44)', border: '1px solid rgba(255,255,255,0.110)' }}
                >
                  <Archive className="w-2.5 h-2.5" /> Depleted
                </span>
              )}
              {account.robux_cost_rate > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(167,139,250,0.08)', color: 'rgba(167,139,250,0.60)', border: '1px solid rgba(167,139,250,0.16)' }}
                >
                  ₱{account.robux_cost_rate}/1k R$
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {/* Selection checkbox */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{
              color: isSelected ? '#22d3ee' : 'rgba(255,255,255,0.50)',
              background: isSelected ? 'rgba(34,211,238,0.12)' : 'transparent',
            }}
            title={isSelected ? 'Deselect account' : 'Select account'}
          >
            {isSelected
              ? <CheckCircle2 className="w-4 h-4" />
              : <Circle className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity duration-150" />
            }
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-40 group-hover:opacity-100"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border text-[12px]">
              <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 cursor-pointer text-[12px]">
                <Edit2 className="w-3.5 h-3.5" /> Edit Account
              </DropdownMenuItem>
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

      {/* Three-stat balance row — Robux stock, separate from the daily transfer allowance below */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-xl p-2.5 text-center"
          style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.078)' }}
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
            background: available > 0 ? 'rgba(52,211,153,0.07)' : 'rgba(244,63,94,0.06)',
            border: `1px solid ${available > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(244,63,94,0.18)'}`,
            boxShadow: available > 500 ? '0 0 10px rgba(52,211,153,0.08)' : 'none',
          }}
        >
          <p className="label-caps mb-1" style={{ color: availDisplayColor, opacity: 0.75 }}>Available</p>
          <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: availDisplayColor }}>
            {available.toLocaleString()}
          </p>
          <p className="text-[9px] font-semibold mt-0.5" style={{ color: availDisplayColor, opacity: 0.65 }}>R$</p>
        </div>

        <div
          className="rounded-xl p-2.5 text-center"
          style={{
            background: account.reserved_robux > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.045)',
            border: `1px solid ${account.reserved_robux > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.065)'}`,
          }}
        >
          <p className="label-caps mb-1" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.50)', opacity: 0.75 }}>Reserved</p>
          <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.44)' }}>
            {account.reserved_robux.toLocaleString()}
          </p>
          <p className="text-[9px] font-semibold mt-0.5" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'oklch(0.65 0.010 265)', opacity: 0.65 }}>R$</p>
        </div>
      </div>

      {/* Segmented allocation bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="label-caps">Allocation</span>
          <div className="flex items-center gap-3">
            {account.reserved_robux > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: COLOR_RESERVED }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLOR_RESERVED }} />
                {account.reserved_robux.toLocaleString()} reserved
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: availDisplayColor }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: availDisplayColor }} />
              {available.toLocaleString()} free
            </span>
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.100)' }}>
          {availPct > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${availPct}%`,
                background: availDisplayColor,
                boxShadow: `0 0 8px ${availDisplayColor}60`,
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
                boxShadow: `0 0 6px ${COLOR_RESERVED}50`,
                borderRadius: availPct > 0 ? '0 99px 99px 0' : '0',
              }}
            />
          )}
        </div>

        {isLow && (
          <p className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-amber-600">
            <AlertTriangle className="w-3 h-3" /> Low balance — consider topping up
          </p>
        )}
      </div>

      {/* ── Daily Transfer Tracker — 500 R$/day instant-transfer allowance ── */}
      {showTransferTracker && (
        <div className="space-y-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.082)' }}>
          <div className="flex items-center justify-between">
            <span className="label-caps">Daily Transfer</span>
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.44)' }}>
              Sent {formatRobux(allowance!.sent_today)}
              {allowance!.reserved > 0 && <span style={{ color: COLOR_RESERVED }}> · Reserved {formatRobux(allowance!.reserved)}</span>}
            </span>
          </div>

          {allowance!.available <= 0 ? (
            <p
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[12px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.075)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Daily limit reached
            </p>
          ) : (
            <div className="space-y-2">
              {!customOpen ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_TRANSFER_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      type="button"
                      disabled={amt > allowance!.available || busyId === account.id}
                      onClick={e => { e.stopPropagation(); onQuickTransfer?.(amt) }}
                      className="flex items-center justify-center py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-30"
                      style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.22)' }}
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setCustomOpen(true) }}
                    className="flex items-center justify-center py-2 rounded-lg text-[11px] font-bold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.090)' }}
                  >
                    Custom
                  </button>
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
                    className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12px] font-semibold tabular-nums focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.88)' }}
                  />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); submitCustomAmount() }}
                    className="flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors"
                    style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.22)' }}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setCustomOpen(false); setCustomValue('') }}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.50)' }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={e => { e.stopPropagation(); onOpenReserveDialog?.() }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[12px] font-bold transition-colors"
                style={{ background: 'rgba(245,158,11,0.10)', color: COLOR_RESERVED, border: '1px solid rgba(245,158,11,0.24)' }}
              >
                Reserve Amount
              </button>
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-xl p-2.5 space-y-1" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <p className="label-caps">Sent Today</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {history.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold" style={{ color: '#34d399' }}>+{formatRobux(log.amount)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.40)' }}>{format(new Date(log.sent_at), 'h:mm a')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reservationQueue.length > 0 && (
            <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.16)' }}>
              <p className="label-caps" style={{ color: COLOR_RESERVED, opacity: 0.8 }}>Reservation Queue</p>
              {reservationQueue.map(res => (
                <div key={res.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>
                      🟡 {res.customer_label || 'Reserved'} — {formatRobux(res.amount)}
                    </p>
                    {res.scheduled_for && (
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                        {format(new Date(res.scheduled_for), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={busyId === res.id}
                      onClick={e => { e.stopPropagation(); onFulfillReservation?.(res.id) }}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40"
                      style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                      title="Mark fulfilled — moves to Sent"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === res.id}
                      onClick={e => { e.stopPropagation(); onCancelReservation?.(res.id) }}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40"
                      style={{ background: 'rgba(244,63,94,0.10)', color: '#f87171' }}
                      title="Cancel reservation"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {account.notes && (
        <p
          className="text-[11px] leading-snug truncate pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.45)' }}
        >
          {account.notes}
        </p>
      )}

      <Link
        href={`/accounts/${account.id}`}
        onClick={e => e.stopPropagation()}
        className="flex items-center justify-center gap-1.5 pt-2.5 text-[11px] font-bold transition-colors"
        style={{ borderTop: '1px solid rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.47)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#0e7490'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.47)'}
      >
        View Ledger <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
