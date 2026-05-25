'use client'

import { RobloxAccount } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import { Coins, MoreHorizontal, Edit2, Trash2, AlertTriangle } from 'lucide-react'
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

  const barColor = pct < 15 ? '#f43f5e' : pct < 35 ? '#f59e0b' : '#22d3ee'

  return (
    <div className="glass-card p-5 space-y-4 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
              boxShadow: '0 0 12px rgba(34,211,238,0.25)',
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
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'oklch(0.55 0.012 265)' }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border text-[12px]">
            <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 cursor-pointer text-[12px]">
              <Edit2 className="w-3.5 h-3.5" /> Edit Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(account.id)} className="gap-2 cursor-pointer text-[12px] text-red-500 focus:text-red-500">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Current', value: account.current_robux.toLocaleString(), color: 'oklch(0.10 0.030 272)' },
          { label: 'Reserved', value: account.reserved_robux.toLocaleString(), color: '#f59e0b' },
          { label: 'Available', value: available.toLocaleString(), color: available < 200 ? '#f43f5e' : '#22d3ee' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(15,13,42,0.025)', border: '1px solid rgba(15,13,42,0.04)' }}
          >
            <p className="label-caps mb-1">{label}</p>
            <p className="text-[13px] font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="label-caps">Balance</span>
          <span className="text-[11px] font-semibold" style={{ color: 'oklch(0.55 0.012 265)' }}>{pct.toFixed(0)}%</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(15,13,42,0.06)' }}
        >
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
          style={{
            borderTop: '1px solid rgba(15,13,42,0.05)',
            color: 'oklch(0.55 0.012 265)',
          }}
        >
          {account.notes}
        </p>
      )}
    </div>
  )
}
