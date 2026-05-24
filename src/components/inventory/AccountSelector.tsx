'use client'

import { RobloxAccount } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertCircle, Star } from 'lucide-react'

interface AccountSelectorProps {
  accounts: RobloxAccount[]
  robuxRequired: number
  selectedId?: string
  onSelect: (id: string) => void
}

export default function AccountSelector({ accounts, robuxRequired, selectedId, onSelect }: AccountSelectorProps) {
  const ranked = accounts
    .filter(a => a.status === 'active')
    .map(a => {
      const available = a.current_robux - a.reserved_robux
      const canAfford = available >= robuxRequired
      const score = canAfford ? available - robuxRequired : -1
      return { ...a, available, canAfford, score }
    })
    .sort((a, b) => {
      if (a.canAfford && !b.canAfford) return -1
      if (!a.canAfford && b.canAfford) return 1
      return a.score - b.score // prefer accounts with less excess (tighter fit)
    })

  const best = ranked.find(a => a.canAfford)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Select account — need {robuxRequired.toLocaleString()} R$
      </p>
      {ranked.length === 0 && (
        <p className="text-xs text-muted-foreground">No active accounts found.</p>
      )}
      {ranked.map((acc) => {
        const isSelected = selectedId === acc.id
        const isBest = best?.id === acc.id

        return (
          <button
            key={acc.id}
            type="button"
            disabled={!acc.canAfford}
            onClick={() => acc.canAfford && onSelect(acc.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
              isSelected
                ? 'bg-primary/15 border-primary/50 text-foreground'
                : acc.canAfford
                  ? 'bg-secondary/50 border-border/50 hover:border-primary/30 hover:bg-accent/30 cursor-pointer'
                  : 'bg-muted/30 border-border/30 opacity-50 cursor-not-allowed'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">{acc.username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground">{acc.username}</p>
                {isBest && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                    <Star className="w-2.5 h-2.5 fill-amber-400" /> Best
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Available: {acc.available.toLocaleString()} R$
                {acc.canAfford && ` → ${(acc.available - robuxRequired).toLocaleString()} R$ after`}
              </p>
            </div>
            <div className="flex-shrink-0">
              {isSelected ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : acc.canAfford ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400/50" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
