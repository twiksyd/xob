'use client'

import { Game } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { getGameNameStyle } from '@/lib/utils/games'

interface GameManagerDialogProps {
  open: boolean
  onClose: () => void
  games: Game[]
  gamepassCounts: Map<string, number>
  onToggleDiscounted: (gameId: string, next: boolean) => Promise<void>
}

// Purely visual status, toggled instantly per game — no save step, no form.
// Every page that displays a game name reads this same is_discounted column,
// so a toggle here is reflected everywhere on the next read.
export default function GameManagerDialog({
  open, onClose, games, gamepassCounts, onToggleDiscounted,
}: GameManagerDialogProps) {
  const sorted = [...games].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Games</DialogTitle>
        </DialogHeader>

        <p className="text-[12px] -mt-1" style={{ color: 'rgba(255,255,255,0.48)' }}>
          Toggle which games are currently discounted on specific accounts. Purely visual — doesn&apos;t affect pricing, profit, or inventory.
        </p>

        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
          {sorted.length === 0 ? (
            <p className="text-center text-[12px] py-8" style={{ color: 'rgba(255,255,255,0.44)' }}>No games yet</p>
          ) : (
            sorted.map(game => (
              <div
                key={game.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: game.color, boxShadow: `0 0 6px ${game.color}80` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate" style={getGameNameStyle(game.is_discounted)}>
                    {game.name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    {gamepassCounts.get(game.id) ?? 0} gamepass{(gamepassCounts.get(game.id) ?? 0) === 1 ? '' : 'es'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleDiscounted(game.id, !game.is_discounted)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
                  style={game.is_discounted
                    ? { background: 'rgba(52,211,153,0.14)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }
                    : { background: 'rgba(255,255,255,0.045)', color: 'rgba(148,163,184,0.72)', border: '1px solid rgba(255,255,255,0.090)' }}
                >
                  {game.is_discounted ? 'Discounted' : 'Standard'}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
