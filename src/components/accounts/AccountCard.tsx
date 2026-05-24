'use client'

import { RobloxAccount } from '@/lib/types/database'
import StatusBadge from '@/components/shared/StatusBadge'
import { Coins, MoreHorizontal, Edit2, Trash2, TrendingDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface AccountCardProps {
  account: RobloxAccount
  onEdit: (account: RobloxAccount) => void
  onDelete: (id: string) => void
}

export default function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const available = account.current_robux - account.reserved_robux
  const pct = Math.min(100, Math.max(0, (account.current_robux / 20000) * 100))
  const isLow = account.current_robux < 500

  return (
    <div className={cn('glass-card p-5 space-y-4 transition-all hover:border-border', isLow && 'border-amber-500/30')}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <span className="text-base font-bold text-primary">
              {account.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{account.username}</p>
            <StatusBadge status={account.status} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 text-xs cursor-pointer">
              <Edit2 className="w-3.5 h-3.5" /> Edit Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(account.id)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Robux info */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{account.current_robux.toLocaleString()}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reserved</p>
          <p className="text-sm font-bold text-amber-400 mt-0.5">{account.reserved_robux.toLocaleString()}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
          <p className={cn('text-sm font-bold mt-0.5', available < 200 ? 'text-red-400' : 'text-emerald-400')}>
            {available.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Balance</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct < 15 ? '#ef4444' : pct < 35 ? '#f59e0b' : '#22c55e'
            }}
          />
        </div>
        {isLow && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1.5">
            <TrendingDown className="w-3 h-3" /> Low balance — consider topping up
          </p>
        )}
      </div>

      {/* Notes */}
      {account.notes && (
        <p className="text-xs text-muted-foreground border-t border-border/50 pt-2 truncate">{account.notes}</p>
      )}
    </div>
  )
}
