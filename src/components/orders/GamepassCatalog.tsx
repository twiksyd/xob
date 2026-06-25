'use client'

import { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react'
import { GamepassWithGame, Game } from '@/lib/types/database'
import GamepassTile from './GamepassTile'
import GameSelector from '@/components/shared/GameSelector'
import GameIcon from '@/components/shared/GameIcon'
import { Search, X } from 'lucide-react'
import { getGameNameStyle } from '@/lib/utils/games'

interface GamepassCatalogProps {
  gamepasses: GamepassWithGame[]
  cartCounts: Map<string, number>
  onAdd: (gamepassId: string) => void
  onRemove: (gamepassId: string) => void
  /** Last completed-sale timestamp per game, computed by the parent from
   *  already-loaded order history — keeps GameSelector's activity column
   *  meaningful without this component needing its own order query. */
  gameActivity?: Map<string, Date | null>
}

export default function GamepassCatalog({ gamepasses, cartCounts, onAdd, onRemove, gameActivity }: GamepassCatalogProps) {
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)
  const searchRef = useRef<HTMLInputElement>(null)

  // Land in the search box the moment the workspace opens — an operator who
  // already knows what the buyer wants shouldn't need a click before typing.
  useEffect(() => { searchRef.current?.focus() }, [])

  const games = useMemo(() => {
    const map = new Map<string, Game>()
    gamepasses.forEach(gp => {
      if (gp.game_id && gp.games) map.set(gp.game_id, gp.games)
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [gamepasses])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return gamepasses.filter(gp => {
      if (gp.is_active === false) return false
      const matchSearch = !q ||
        gp.name.toLowerCase().includes(q) ||
        (gp.games?.name ?? '').toLowerCase().includes(q)
      const matchGame = !filterGame || gp.game_id === filterGame
      return matchSearch && matchGame
    })
  }, [gamepasses, deferredSearch, filterGame])

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; color: string; iconUrl: string | null; isDiscounted: boolean; items: GamepassWithGame[] }>()
    filtered.forEach(gp => {
      const accent = gp.games?.color ?? '#8b5cf6'
      const iconUrl = gp.games?.icon_url ?? null
      const isDiscounted = gp.games?.is_discounted ?? false
      const lower = gp.name.toLowerCase()
      let key = gp.game_id ?? 'none'
      let name = gp.games?.name ?? 'Other'
      if (lower.includes('tax covered')) {
        key = `${key}::covered-tax`
        name = 'Covered Tax'
      } else if (lower.includes('no tax')) {
        key = `${key}::not-covered-tax`
        name = 'Not Covered Tax'
      } else if (/^rp\s*[\d,]/.test(lower)) {
        key = `${key}::in-game-currency`
        name = `${gp.games?.name ?? 'Other'} — In-Game Currency`
      }
      if (!map.has(key)) {
        map.set(key, { name, color: accent, iconUrl, isDiscounted, items: [] })
      }
      map.get(key)!.items.push(gp)
    })
    const groups = Array.from(map.values())
    groups.forEach(g => g.items.sort((a, b) => b.robux_amount - a.robux_amount))
    return groups.sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered])

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.48)' }} />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search gamepasses by name or game…"
          className="w-full pl-9 pr-9 h-9 rounded-xl text-[13px] bg-input border border-border outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Game selector — compact popover, page stays fully visible; Ctrl+K opens the full palette */}
      {games.length > 1 && (
        <GameSelector
          games={games}
          value={filterGame}
          onChange={setFilterGame}
          allowClear
          gameActivity={gameActivity}
        />
      )}

      {/* Grid grouped by game */}
      <div className="space-y-4 max-h-[420px] overflow-y-auto overscroll-contain pr-0.5" style={{ scrollbarWidth: 'thin' }}>
        {grouped.length === 0 ? (
          <p className="text-center text-[12px] py-8" style={{ color: 'oklch(0.62 0.010 265)' }}>
            No gamepasses found
          </p>
        ) : (
          grouped.map(group => (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <GameIcon iconUrl={group.iconUrl} color={group.color} size={16} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={getGameNameStyle(group.isDiscounted)}>
                  {group.name}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map(gp => (
                  <GamepassTile
                    key={gp.id}
                    gamepass={gp}
                    quantity={cartCounts.get(gp.id) ?? 0}
                    onAdd={() => onAdd(gp.id)}
                    onRemove={() => onRemove(gp.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
