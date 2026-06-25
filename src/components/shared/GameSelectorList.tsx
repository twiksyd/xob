'use client'

import { useMemo, useState } from 'react'
import { Star, Clock } from 'lucide-react'
import { Game } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command'
import GameIcon from '@/components/shared/GameIcon'
import { getGameNameStyle, getPinnedGameIds, togglePinnedGame, getRecentGameIds } from '@/lib/utils/games'

type QuickFilter = 'all' | 'discounted' | 'nonDiscounted'

const QUICK_FILTERS: readonly { value: QuickFilter; label: string }[] = [
  { value: 'all',          label: 'All Games' },
  { value: 'discounted',   label: 'Discounted' },
  { value: 'nonDiscounted', label: 'Non-Discounted' },
]

// Compact relative-time label for the activity trailing metric — matches the
// existing ageLabel() compactness convention used elsewhere (recommendations.ts).
function activityLabel(lastSoldAt: Date | null | undefined): string {
  if (!lastSoldAt) return 'No sales yet'
  const hours = (Date.now() - lastSoldAt.getTime()) / 3_600_000
  if (hours < 1) return 'Just now'
  if (hours < 48) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

interface GameSelectorListProps {
  games: Game[]
  value: string | null
  allowClear: boolean
  gamepassCounts?: Map<string, number>
  gameActivity?: Map<string, Date | null>
  onSelect: (gameId: string | null) => void
}

export default function GameSelectorList({
  games, value, allowClear, gamepassCounts, gameActivity, onSelect,
}: GameSelectorListProps) {
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => getPinnedGameIds())
  const recentIds = useMemo(() => getRecentGameIds(), [])

  const quickFiltered = useMemo(() => games.filter(g => {
    if (quickFilter === 'discounted') return g.is_discounted
    if (quickFilter === 'nonDiscounted') return !g.is_discounted
    return true
  }), [games, quickFilter])

  const byId = useMemo(() => new Map(quickFiltered.map(g => [g.id, g])), [quickFiltered])

  const pinned = useMemo(
    () => pinnedIds.map(id => byId.get(id)).filter((g): g is Game => !!g),
    [pinnedIds, byId]
  )
  const recent = useMemo(
    () => recentIds.map(id => byId.get(id)).filter((g): g is Game => !!g && !pinnedIds.includes(g.id)),
    [recentIds, byId, pinnedIds]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>()
    quickFiltered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(g => {
        const key = g.category ?? 'Uncategorized'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(g)
      })
    return Array.from(map.entries()).sort(([a], [b]) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b))
  }, [quickFiltered])

  function handlePinToggle(e: React.MouseEvent, gameId: string) {
    e.preventDefault()
    e.stopPropagation()
    setPinnedIds(togglePinnedGame(gameId))
  }

  function renderRow(game: Game, { showPin = true }: { showPin?: boolean } = {}) {
    const trailing = gameActivity
      ? activityLabel(gameActivity.get(game.id))
      : gamepassCounts
        ? `${gamepassCounts.get(game.id) ?? 0} gamepass${(gamepassCounts.get(game.id) ?? 0) === 1 ? '' : 'es'}`
        : null
    const isPinned = pinnedIds.includes(game.id)

    return (
      <CommandItem
        key={game.id}
        value={game.name}
        keywords={[game.category, ...(game.aliases ?? [])].filter((s): s is string => !!s)}
        onSelect={() => onSelect(game.id)}
        className="flex items-center gap-2.5"
      >
        {showPin && (
          <button
            type="button"
            onClick={(e) => handlePinToggle(e, game.id)}
            className="flex-shrink-0 p-0.5 -ml-0.5"
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Star
              className="w-3 h-3"
              style={{ color: isPinned ? '#fbbf24' : 'rgba(255,255,255,0.22)' }}
              fill={isPinned ? '#fbbf24' : 'none'}
            />
          </button>
        )}
        <GameIcon iconUrl={game.icon_url} color={game.color} size={20} />
        <span className="flex-1 min-w-0 truncate font-semibold" style={getGameNameStyle(game.is_discounted)}>
          {game.name}
        </span>
        {trailing && (
          <span className="flex-shrink-0 text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {trailing}
          </span>
        )}
      </CommandItem>
    )
  }

  const searching = search.trim().length > 0

  return (
    <Command shouldFilter={searching} className="bg-transparent p-0">
      <CommandInput
        autoFocus
        placeholder="Search games by name, category, or alias…"
        value={search}
        onValueChange={setSearch}
      />

      {/* Quick filters — All / Discounted / Non-Discounted, using is_discounted */}
      <div className="flex items-center gap-1 px-1.5 pt-1.5">
        {QUICK_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setQuickFilter(f.value)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors',
              quickFilter === f.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <CommandList className="max-h-[340px]">
        <CommandEmpty>No games found</CommandEmpty>

        {allowClear && !searching && (
          <CommandGroup>
            <CommandItem value="All Games" onSelect={() => onSelect(null)} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: value === null ? '#22d3ee' : 'rgba(255,255,255,0.18)' }}
              />
              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.78)' }}>All Games</span>
            </CommandItem>
          </CommandGroup>
        )}

        {!searching && pinned.length > 0 && (
          <CommandGroup
            heading={
              <span className="flex items-center gap-1.5">
                <Star className="w-3 h-3" style={{ color: '#fbbf24' }} fill="#fbbf24" /> Pinned
              </span>
            }
          >
            {pinned.map(g => renderRow(g))}
          </CommandGroup>
        )}

        {!searching && recent.length > 0 && (
          <CommandGroup
            heading={
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.44)' }} /> Recent
              </span>
            }
          >
            {recent.map(g => renderRow(g))}
          </CommandGroup>
        )}

        {!searching ? (
          grouped.map(([category, items]) => (
            <CommandGroup key={category} heading={category}>
              {items.map(g => renderRow(g))}
            </CommandGroup>
          ))
        ) : (
          <CommandGroup>
            {quickFiltered.map(g => renderRow(g))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
