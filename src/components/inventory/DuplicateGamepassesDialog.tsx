'use client'

import { useMemo, useState } from 'react'
import { Game, Gamepass } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/utils/pricing'
import { format } from 'date-fns'

type GamepassWithGame = Gamepass & { games: Game | null }

interface DuplicateGroup {
  key: string
  gameName: string
  name: string
  robux_amount: number
  entries: GamepassWithGame[]
}

interface DuplicateGamepassesDialogProps {
  open: boolean
  onClose: () => void
  gamepasses: GamepassWithGame[]
  onDelete: (ids: string[]) => Promise<void>
}

// Requires BOTH the same Robux amount AND the same name within a game.
// Amount alone isn't enough — a game can legitimately have two different
// gamepasses at the same price (e.g. "2x Luck" and "2x Speed" both at
// 100 R$), and grouping by amount only would wrongly flag those as
// duplicates of each other, deleting a genuinely distinct gamepass.
function findDuplicateGroups(gamepasses: GamepassWithGame[]): DuplicateGroup[] {
  const map = new Map<string, GamepassWithGame[]>()
  for (const gp of gamepasses) {
    if (!gp.game_id) continue
    const key = `${gp.game_id}__${gp.robux_amount}__${gp.name.trim().toLowerCase()}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(gp)
  }
  const groups: DuplicateGroup[] = []
  for (const entries of map.values()) {
    if (entries.length < 2) continue
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    groups.push({
      key: `${entries[0].game_id}__${entries[0].robux_amount}__${entries[0].name.trim().toLowerCase()}`,
      gameName: entries[0].games?.name ?? 'Unknown game',
      name: entries[0].name,
      robux_amount: entries[0].robux_amount,
      entries,
    })
  }
  groups.sort((a, b) => a.gameName.localeCompare(b.gameName) || a.robux_amount - b.robux_amount)
  return groups
}

export default function DuplicateGamepassesDialog({ open, onClose, gamepasses, onDelete }: DuplicateGamepassesDialogProps) {
  const [wasOpen, setWasOpen] = useState(open)
  const [keepById, setKeepById] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)

  const groups = useMemo(() => findDuplicateGroups(gamepasses), [gamepasses])

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      // Default to keeping the most recently created entry per group.
      const defaults: Record<string, string> = {}
      for (const g of groups) defaults[g.key] = g.entries[0].id
      setKeepById(defaults)
    }
  }

  function setKeepAll(which: 'newest' | 'oldest') {
    const next: Record<string, string> = {}
    for (const g of groups) next[g.key] = which === 'newest' ? g.entries[0].id : g.entries[g.entries.length - 1].id
    setKeepById(next)
  }

  const toDeleteCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.entries.filter(e => e.id !== keepById[g.key]).length, 0),
    [groups, keepById]
  )

  async function handleRemove() {
    const ids = groups.flatMap(g => g.entries.filter(e => e.id !== keepById[g.key]).map(e => e.id))
    if (ids.length === 0) return
    setDeleting(true)
    await onDelete(ids)
    setDeleting(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicate Gamepasses</DialogTitle>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-[13px] py-4" style={{ color: 'rgba(255,255,255,0.50)' }}>
            No duplicates found — every gamepass has a unique Robux amount within its game.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Found {groups.length} gamepass{groups.length !== 1 ? 'es' : ''} that exist more than once in the same game with the same name and Robux amount — likely from importing the same sheet twice. Pick which copy to keep in each group; the rest get removed.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.50)' }}>Keep for all groups:</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setKeepAll('newest')}>Most Recent</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setKeepAll('oldest')}>Oldest</Button>
            </div>

            <div className="space-y-3">
              {groups.map(group => (
                <div key={group.key} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.080)' }}>
                  <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.82)' }}>
                    {group.gameName} · &ldquo;{group.name}&rdquo; · {group.robux_amount.toLocaleString()} R$ <span className="font-normal" style={{ color: 'rgba(255,255,255,0.44)' }}>({group.entries.length} copies)</span>
                  </p>
                  <div className="space-y-1">
                    {group.entries.map(entry => (
                      <label key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer" style={{ background: keepById[group.key] === entry.id ? 'rgba(52,211,153,0.08)' : 'transparent' }}>
                        <input
                          type="radio"
                          checked={keepById[group.key] === entry.id}
                          onChange={() => setKeepById(prev => ({ ...prev, [group.key]: entry.id }))}
                          className="accent-emerald-500"
                        />
                        <span className="text-[12px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.80)' }}>{entry.name}</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.50)' }}>{formatPHP(entry.your_price)} / {formatPHP(entry.profit)} profit</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{format(new Date(entry.created_at), 'MMM d, h:mm a')}</span>
                        {keepById[group.key] === entry.id && (
                          <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.28)' }}
                          >
                            Keep
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          {groups.length > 0 && (
            <Button variant="destructive" onClick={handleRemove} disabled={deleting || toDeleteCount === 0}>
              {deleting ? 'Removing…' : `Remove ${toDeleteCount} Duplicate${toDeleteCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
