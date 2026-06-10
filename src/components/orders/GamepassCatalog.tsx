'use client'

import { useState, useMemo, useDeferredValue } from 'react'
import { GamepassWithGame } from '@/lib/types/database'
import GamepassTile from './GamepassTile'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamepassCatalogProps {
  gamepasses: GamepassWithGame[]
  cartCounts: Map<string, number>
  onAdd: (gamepassId: string) => void
  onRemove: (gamepassId: string) => void
}

export default function GamepassCatalog({ gamepasses, cartCounts, onAdd, onRemove }: GamepassCatalogProps) {
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useState('all')
  const deferredSearch = useDeferredValue(search)

  const games = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    gamepasses.forEach(gp => {
      if (gp.game_id && gp.games?.name) {
        map.set(gp.game_id, { id: gp.game_id, name: gp.games.name, color: gp.games.color })
      }
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
      const matchGame = filterGame === 'all' || gp.game_id === filterGame
      return matchSearch && matchGame
    })
  }, [gamepasses, deferredSearch, filterGame])

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; color: string; items: GamepassWithGame[] }>()
    filtered.forEach(gp => {
      const accent = gp.games?.color ?? '#8b5cf6'
      const lower = gp.name.toLowerCase()
      let key = gp.game_id ?? 'none'
      let name = gp.games?.name ?? 'Other'
      if (lower.includes('tax covered')) {
        key = `${key}::covered-tax`
        name = 'Covered Tax'
      } else if (lower.includes('no tax')) {
        key = `${key}::not-covered-tax`
        name = 'Not Covered Tax'
      }
      if (!map.has(key)) {
        map.set(key, { name, color: accent, items: [] })
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'oklch(0.58 0.010 265)' }} />
        <input
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

      {/* Game filter chips */}
      {games.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => setFilterGame('all')}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0',
              filterGame === 'all'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            All Games
          </button>
          {games.map(g => {
            const active = filterGame === g.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilterGame(active ? 'all' : g.id)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
                style={active
                  ? { background: g.color, color: 'white', boxShadow: `0 0 10px ${g.color}50` }
                  : { color: 'oklch(0.52 0.012 265)' }}
              >
                {g.name}
              </button>
            )
          })}
        </div>
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
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: group.color, boxShadow: `0 0 6px ${group.color}80` }}
                />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'oklch(0.48 0.016 265)' }}>
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
