'use client'

import Link from 'next/link'
import { RobloxAccount } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import { MoreHorizontal, Edit2, Trash2, AlertTriangle, CheckCircle2, Circle, ArrowRight, Archive } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { isDepleted } from '@/lib/utils/accounts'

interface AccountCardProps {
  account: RobloxAccount
  onEdit: (account: RobloxAccount) => void
  onDelete: (id: string) => void
  isSelected?: boolean
  onToggleSelect?: () => void
}

const COLOR_AVAILABLE = '#34d399'
const COLOR_RESERVED  = '#f59e0b'
const COLOR_CURRENT   = 'oklch(0.10 0.030 272)'

export default function AccountCard({ account, onEdit, onDelete, isSelected = false, onToggleSelect }: AccountCardProps) {
  const available   = account.current_robux - account.reserved_robux
  const depleted    = isDepleted(account)
  const isLow       = available < 500 && !depleted
  const isHigh      = account.current_robux >= 8000

  const availPct    = account.current_robux > 0 ? Math.min(100, (available / account.current_robux) * 100) : 0
  const reservedPct = account.current_robux > 0 ? Math.min(100 - availPct, (account.reserved_robux / account.current_robux) * 100) : 0
  const availDisplayColor = depleted ? 'oklch(0.58 0.010 265)' : available < 200 ? '#f43f5e' : available < 500 ? COLOR_RESERVED : COLOR_AVAILABLE

  const cardStyle = isSelected
    ? {
        background: 'rgba(34,211,238,0.028) padding-box, linear-gradient(140deg, rgba(34,211,238,0.42), rgba(139,92,246,0.28) 55%, rgba(34,211,238,0.24)) border-box',
        boxShadow: '0 2px 20px rgba(34,211,238,0.12), 0 4px 24px rgba(15,13,42,0.04), inset 0 1.5px 0 rgba(34,211,238,0.30)',
      }
    : isHigh
    ? { boxShadow: '0 2px 16px rgba(52,211,153,0.07), 0 4px 24px rgba(15,13,42,0.04), inset 0 1px 0 rgba(52,211,153,0.14)' }
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
            <p className="text-[13px] font-bold truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>
              {account.username}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={account.status} />
              {depleted && (
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(15,13,42,0.04)', color: 'oklch(0.55 0.010 265)', border: '1px solid rgba(15,13,42,0.08)' }}
                >
                  <Archive className="w-2.5 h-2.5" /> Depleted
                </span>
              )}
              {account.robux_cost_rate > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(167,139,250,0.08)', color: 'oklch(0.48 0.090 280)', border: '1px solid rgba(167,139,250,0.16)' }}
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
              color: isSelected ? '#22d3ee' : 'oklch(0.60 0.010 265)',
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
              style={{ color: 'oklch(0.55 0.012 265)' }}
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

      {/* Three-stat balance row */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-xl p-2.5 text-center"
          style={{ background: 'rgba(15,13,42,0.028)', border: '1px solid rgba(15,13,42,0.048)' }}
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
            background: account.reserved_robux > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(15,13,42,0.025)',
            border: `1px solid ${account.reserved_robux > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(15,13,42,0.04)'}`,
          }}
        >
          <p className="label-caps mb-1" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'oklch(0.60 0.010 265)', opacity: 0.75 }}>Reserved</p>
          <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: account.reserved_robux > 0 ? COLOR_RESERVED : 'oklch(0.55 0.010 265)' }}>
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

        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(15,13,42,0.07)' }}>
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

      {account.notes && (
        <p
          className="text-[11px] leading-snug truncate pt-2"
          style={{ borderTop: '1px solid rgba(15,13,42,0.05)', color: 'oklch(0.55 0.012 265)' }}
        >
          {account.notes}
        </p>
      )}

      <Link
        href={`/accounts/${account.id}`}
        onClick={e => e.stopPropagation()}
        className="flex items-center justify-center gap-1.5 pt-2.5 text-[11px] font-bold transition-colors"
        style={{ borderTop: '1px solid rgba(15,13,42,0.05)', color: 'oklch(0.48 0.016 265)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#0e7490'}
        onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.48 0.016 265)'}
      >
        View Ledger <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
