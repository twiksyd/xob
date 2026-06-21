'use client'

import { useState } from 'react'
import { RobloxAccount } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Star, Archive, ChevronDown } from 'lucide-react'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import AccountBadgeRow from '@/components/shared/AccountBadgeRow'
import ChromeProfileBadge from '@/components/shared/ChromeProfileBadge'
import { rankAccountsForOrder } from '@/lib/utils/accounts'

interface AccountSelectorProps {
  accounts: RobloxAccount[]
  robuxRequired: number
  selectedId?: string
  onSelect: (id: string) => void
}

const COLOR_AVAILABLE = '#34d399'
const COLOR_RESERVED  = '#f59e0b'
const COLOR_NEUTRAL   = 'rgba(255,255,255,0.48)'

export default function AccountSelector({ accounts, robuxRequired, selectedId, onSelect }: AccountSelectorProps) {
  const [showDepleted, setShowDepleted] = useState(false)

  const allRanked = rankAccountsForOrder(accounts, robuxRequired)

  const depletedCount = allRanked.filter(a => a.depleted).length
  const ranked = showDepleted ? allRanked : allRanked.filter(a => !a.depleted)

  const best = ranked.find(a => a.canAfford)

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.47)' }}>
        Select account
        {robuxRequired > 0 && (
          <span style={{ color: 'oklch(0.38 0.016 265)' }}>
            {' '}— need{' '}
            <span className="font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {robuxRequired.toLocaleString()} R$
            </span>
          </span>
        )}
      </p>

      {ranked.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {allRanked.length === 0 ? 'No active accounts found.' : 'All active accounts are depleted.'}
        </p>
      )}

      <div className="max-h-[240px] overflow-y-auto overscroll-contain space-y-2 pr-0.5">
        {ranked.map((acc) => {
          const isSelected = selectedId === acc.id
          const isBest     = best?.id === acc.id
          const afterRobux = acc.available - robuxRequired
          const availDisplayColor = acc.depleted ? COLOR_NEUTRAL : acc.available < 200 ? '#f43f5e' : acc.available < 500 ? COLOR_RESERVED : COLOR_AVAILABLE

          // Bar dimensions
          const availPct    = acc.current_robux > 0 ? Math.min(100, (acc.available / acc.current_robux) * 100) : 0
          const reservedPct = acc.current_robux > 0 ? Math.min(100 - availPct, (acc.reserved_robux / acc.current_robux) * 100) : 0

          return (
            <button
              key={acc.id}
              type="button"
              disabled={!acc.canAfford}
              onClick={() => acc.canAfford && onSelect(acc.id)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected
                  ? 'bg-primary/10 border-primary/40'
                  : acc.canAfford
                    ? 'bg-secondary/40 border-border/40 hover:border-primary/25 hover:bg-accent/25 cursor-pointer'
                    : acc.depleted
                      ? 'bg-muted/15 border-border/20 opacity-40 cursor-not-allowed'
                      : 'bg-muted/20 border-border/25 opacity-50 cursor-not-allowed'
              )}
            >
              {/* Avatar */}
              <RobloxAvatar
                username={acc.username}
                userId={acc.roblox_user_id}
                size={32}
                className="rounded-lg text-[13px] font-bold mt-0.5"
                gradient={
                  isSelected
                    ? 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(34,211,238,0.20))'
                    : 'rgba(139,92,246,0.10)'
                }
                textColor={isSelected ? '#22d3ee' : 'rgba(167,139,250,0.60)'}
                glow="none"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Username row */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <p className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {acc.username}
                  </p>
                  <AccountBadgeRow account={acc} />
                  {acc.chrome_profile && <ChromeProfileBadge profile={acc.chrome_profile} />}
                  {isBest && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold flex-shrink-0" style={{ color: COLOR_RESERVED }}>
                      <Star className="w-2.5 h-2.5 fill-current" /> Best
                    </span>
                  )}
                  {acc.depleted && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.065)', color: COLOR_NEUTRAL, border: '1px solid rgba(255,255,255,0.110)' }}
                    >
                      <Archive className="w-2.5 h-2.5" /> Depleted
                    </span>
                  )}
                  {acc.robux_cost_rate > 0 && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(167,139,250,0.08)', color: 'rgba(167,139,250,0.60)', border: '1px solid rgba(167,139,250,0.16)' }}
                    >
                      ₱{acc.robux_cost_rate}/1k R$
                    </span>
                  )}
                </div>

                {/* Balance values */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Current */}
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'oklch(0.62 0.010 265)' }}>Current</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.76)' }}>
                      {acc.current_robux.toLocaleString()} R$
                    </p>
                  </div>

                  <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.110)' }} />

                  {/* Available — green, most prominent */}
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: availDisplayColor, opacity: 0.75 }}>Available</p>
                    <p className="text-[12px] font-extrabold tabular-nums" style={{ color: availDisplayColor }}>
                      {acc.available.toLocaleString()} R$
                    </p>
                  </div>

                  {acc.reserved_robux > 0 && (
                    <>
                      <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.110)' }} />
                      {/* Reserved — amber */}
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: COLOR_RESERVED, opacity: 0.75 }}>Reserved</p>
                        <p className="text-[11px] font-bold tabular-nums" style={{ color: COLOR_RESERVED }}>
                          {acc.reserved_robux.toLocaleString()} R$
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Segmented bar */}
                <div className="h-1.5 rounded-full overflow-hidden flex mb-1.5" style={{ background: 'rgba(255,255,255,0.100)' }}>
                  {availPct > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${availPct}%`,
                        background: availDisplayColor,
                        boxShadow: `0 0 6px ${availDisplayColor}55`,
                        borderRadius: reservedPct > 0 ? '99px 0 0 99px' : '99px',
                      }}
                    />
                  )}
                  {reservedPct > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${reservedPct}%`,
                        background: COLOR_RESERVED,
                        boxShadow: `0 0 4px ${COLOR_RESERVED}50`,
                        borderRadius: availPct > 0 ? '0 99px 99px 0' : '99px',
                      }}
                    />
                  )}
                </div>

                {/* After-order projection */}
                {acc.canAfford && robuxRequired > 0 && (
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.44)' }}>
                    After order:{' '}
                    <span className="font-bold tabular-nums" style={{ color: afterRobux < 500 ? COLOR_RESERVED : COLOR_AVAILABLE }}>
                      {afterRobux.toLocaleString()} R$
                    </span>{' '}
                    remaining
                  </p>
                )}
              </div>

              {/* Selection indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {isSelected ? (
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#22d3ee' }} />
                ) : acc.canAfford ? (
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'rgba(52,211,153,0.35)' }} />
                ) : acc.depleted ? (
                  <Archive className="w-4 h-4" style={{ color: COLOR_NEUTRAL, opacity: 0.4 }} />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400/40" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {depletedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDepleted(p => !p)}
          className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
          style={{ color: 'rgba(255,255,255,0.47)' }}
        >
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: showDepleted ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
          {showDepleted ? 'Hide Depleted Accounts' : `Show Depleted Accounts (${depletedCount})`}
        </button>
      )}
    </div>
  )
}
