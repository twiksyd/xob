'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Game } from '@/lib/types/database'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CommandDialog } from '@/components/ui/command'
import GameSelectorList from '@/components/shared/GameSelectorList'
import GameIcon from '@/components/shared/GameIcon'
import { getGameNameStyle, addRecentGameId } from '@/lib/utils/games'

interface GameSelectorProps {
  games: Game[]
  value: string | null
  onChange: (gameId: string | null) => void
  /** Filter contexts (Orders/Inventory) clear to null = "All Games". Required-pick
   *  contexts (a future game-assignment field) should pass false. */
  allowClear?: boolean
  triggerLabel?: string
  gamepassCounts?: Map<string, number>
  gameActivity?: Map<string, Date | null>
  className?: string
}

// Primary UX is the inline popover (page stays fully visible, no context
// switch) — Ctrl+K is a keyboard shortcut to the same content in a full
// dialog shell, scoped to while this selector is mounted on screen.
export default function GameSelector({
  games, value, onChange, allowClear = true, triggerLabel, gamepassCounts, gameActivity, className,
}: GameSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPopoverOpen(false)
        setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selected = value ? games.find(g => g.id === value) ?? null : null

  // Immediately applies and closes — no confirmation step, in either shell.
  function handleSelect(gameId: string | null) {
    if (gameId) addRecentGameId(gameId)
    onChange(gameId)
    setPopoverOpen(false)
    setDialogOpen(false)
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          className={className ?? 'flex items-center gap-2 px-3 h-9 rounded-xl text-[12px] font-semibold bg-input border border-border transition-colors hover:border-primary/40'}
        >
          {selected ? (
            <>
              <GameIcon iconUrl={selected.icon_url} color={selected.color} size={16} />
              <span className="truncate" style={getGameNameStyle(selected.is_discounted)}>{selected.name}</span>
            </>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.60)' }}>
              {triggerLabel ?? (allowClear ? 'All Games' : 'Select Game')}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 ml-auto" style={{ color: 'rgba(255,255,255,0.40)' }} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[360px] p-0">
          <GameSelectorList
            games={games}
            value={value}
            allowClear={allowClear}
            gamepassCounts={gamepassCounts}
            gameActivity={gameActivity}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>

      <CommandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Select Game"
        description="Search games by name, category, or alias"
      >
        <GameSelectorList
          games={games}
          value={value}
          allowClear={allowClear}
          gamepassCounts={gamepassCounts}
          gameActivity={gameActivity}
          onSelect={handleSelect}
        />
      </CommandDialog>
    </>
  )
}
