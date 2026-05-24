'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Gamepass, Game } from '@/lib/types/database'
import { Search, X, ChevronDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type GamepassWithGame = Gamepass & { games: Game | null }

interface GamepassPickerProps {
  gamepasses: GamepassWithGame[]
  value: string
  onChange: (id: string) => void
  error?: boolean
}

export default function GamepassPicker({ gamepasses, value, onChange, error }: GamepassPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useState('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = gamepasses.find(gp => gp.id === value)

  const games = useMemo(() => {
    const map = new Map<string, string>()
    gamepasses.forEach(gp => {
      if (gp.game_id && gp.games?.name) map.set(gp.game_id, gp.games.name)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [gamepasses])

  const filtered = useMemo(() => gamepasses.filter(gp => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      gp.name.toLowerCase().includes(q) ||
      (gp.games?.name ?? '').toLowerCase().includes(q)
    const matchGame = filterGame === 'all' || gp.game_id === filterGame
    return matchSearch && matchGame
  }), [gamepasses, search, filterGame])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearch('')
    setFilterGame('all')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all text-left',
          open
            ? 'border-primary/60 bg-input ring-2 ring-primary/20'
            : error
            ? 'border-red-500/50 bg-input'
            : 'border-border bg-input hover:border-border/80',
        )}
      >
        <span className="flex-1 min-w-0">
          {selected ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>
                <span className="text-foreground font-semibold text-sm">{selected.name}</span>
                <span className="text-muted-foreground text-xs ml-2">{selected.games?.name} · {selected.robux_amount.toLocaleString()} R$ · ₱{selected.your_price}</span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Choose a gamepass...</span>
          )}
        </span>
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected && (
            <span
              role="button"
              onClick={clear}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or game..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Game chips */}
          <div className="flex gap-1.5 px-2 py-2 overflow-x-auto border-b border-border/40 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterGame('all')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                filterGame === 'all'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              All Games
            </button>
            {games.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilterGame(filterGame === g.id ? 'all' : g.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                  filterGame === g.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No gamepasses found</p>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {filtered.map(gp => {
                  const isSelected = gp.id === value
                  return (
                    <button
                      key={gp.id}
                      type="button"
                      onClick={() => { onChange(gp.id); setOpen(false); setSearch(''); setFilterGame('all') }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all',
                        isSelected
                          ? 'bg-primary/15 border border-primary/40'
                          : 'hover:bg-accent border border-transparent'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{gp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{gp.games?.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-bold text-foreground">₱{gp.your_price}</p>
                        <p className="text-xs text-muted-foreground">{gp.robux_amount.toLocaleString()} R$</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-border/40 text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {search || filterGame !== 'all' ? ' (filtered)' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
