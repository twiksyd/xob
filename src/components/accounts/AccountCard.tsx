'use client'

import { RobloxAccount } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import { MoreHorizontal, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface AccountCardProps {
  account: RobloxAccount
  onEdit: (account: RobloxAccount) => void
  onDelete: (id: string) => void
}

export default function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const available = account.current_robux - account.reserved_robux
  const pct = Math.min(100, Math.max(0, (account.current_robux / 20000) * 100))
  const isLow = available < 500
  const isHigh = account.current_robux >= 8000

  const barColor = pct < 15 ? '#f43f5e' : pct < 35 ? '#f59e0b' : '#22d3ee'
  const availColor = available < 200 ? '#f43f5e' : available < 500 ? '#f59e0b' : '#22d3ee'

  return (
    <div
      className="glass-card p-5 space-y-4 transition-all duration-200 group"
      style={isHigh ? {
        boxShadow: '0 2px 16px rgba(34,211,238,0.07), 0 4px 24px rgba(15,13,42,0.04), inset 0 1px 0 rgba(34,211,238,0.18)',
      } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black text-white flex-shrink-0"
            style={{
              background: isHigh
                ? 'linear-gradient(135deg, #22d3ee, #a78bfa)'
                : 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))',
              boxShadow: isHigh
                ? '0 0 14px rgba(34,211,238,0.32)'
                : '0 0 8px rgba(139,92,246,0.16)',
            }}
          >
            {account.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>{account.username}</p>
            <StatusBadge status={account.status} className="mt-0.5" />
          </div>
        </div>
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

      {/* Hero balance */}
      <div
        className="rounded-xl px-4 py-3"
        style={{
          background: isHigh ? 'rgba(34,211,238,0.04)' : 'rgba(15,13,42,0.025)',
          border: `1px solid ${isHigh ? 'rgba(34,211,238,0.12)' : 'rgba(15,13,42,0.04)'}`,
        }}
      >
        <p className="label-caps mb-1">Current Balance</p>
        <p className="tabular-nums leading-tight" style={{ fontSize: '22px', fontWeight: 900, color: isHigh ? '#22d3ee' : 'oklch(0.10 0.030 272)' }}>
          {account.current_robux.toLocaleString()}
          <span className="text-[12px] font-semibold ml-1.5" style={{ color: 'oklch(0.60 0.010 265)' }}>R$</span>
        </p>
      </div>

      {/* Available + Reserved */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(15,13,42,0.025)', border: '1px solid rgba(15,13,42,0.04)' }}>
          <p className="label-caps mb-1">Available</p>
          <p className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: availColor }}>
            {available.toLocaleString()}
            <span className="text-[10px] font-semibold ml-1" style={{ color: 'oklch(0.65 0.010 265)' }}>R$</span>
          </p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(15,13,42,0.025)', border: '1px solid rgba(15,13,42,0.04)' }}>
          <p className="label-caps mb-1">Reserved</p>
          <p className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.55 0.010 265)' }}>
            {account.reserved_robux.toLocaleString()}
            <span className="text-[10px] font-semibold ml-1" style={{ color: 'oklch(0.65 0.010 265)' }}>R$</span>
          </p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="label-caps">Capacity</span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'oklch(0.55 0.012 265)' }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,13,42,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${barColor}50` }}
          />
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
    </div>
  )
}
