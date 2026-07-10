'use client'

import { motion } from 'framer-motion'
import { GamepassWithGame } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { springToggle } from '@/lib/motion'
import { formatPHP } from '@/lib/utils/pricing'
import { getGameAccentColor, getGameNameStyle } from '@/lib/utils/games'

interface GamepassTileProps {
  gamepass: GamepassWithGame
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

export default function GamepassTile({ gamepass, quantity, onAdd, onRemove }: GamepassTileProps) {
  const gameName = gamepass.games?.name ?? ''
  const gameColor = getGameAccentColor(gameName)
  const inCart = quantity > 0

  return (
    <button
      type="button"
      onClick={onAdd}
      onContextMenu={(e) => {
        e.preventDefault()
        if (inCart) onRemove()
      }}
      title={inCart ? 'Click to add — right-click to remove' : undefined}
      className={cn(
        'relative w-full min-w-0 p-3 rounded-2xl border text-center transition-all',
        inCart
          ? 'border-white/12'
          : 'bg-secondary/35 border-border/35 hover:border-white/18 hover:bg-accent/20'
      )}
      style={inCart
        ? {
            background: `linear-gradient(160deg, ${gameColor}0f 0%, transparent 65%)`,
            boxShadow: `0 0 0 1px ${gameColor}26, 0 4px 18px ${gameColor}12`,
          }
        : undefined
      }
    >
      {/* Quantity badge */}
      {inCart && (
        <motion.span
          key={quantity}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springToggle}
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: gameColor, boxShadow: `0 0 10px ${gameColor}80` }}
        >
          ×{quantity}
        </motion.span>
      )}

      {/* Gamepass name — primary focal point */}
      <p className="text-[13px] font-bold leading-snug truncate" style={{ color: gameColor }}>
        {gamepass.name}
      </p>

      {/* Accent underline */}
      <div
        className="mx-auto mt-1 rounded-full"
        style={{ width: 28, height: 1.5, background: gameColor, opacity: 0.48 }}
      />

      {/* Game name */}
      <p className="text-[10px] mt-1.5 truncate" style={getGameNameStyle(gamepass.games?.is_discounted)}>
        {gamepass.games?.name ?? 'No game'}
      </p>

      {/* Secondary numbers */}
      <div className="flex items-center justify-center gap-2 mt-2.5">
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.34)' }}>
          {gamepass.robux_amount.toLocaleString()} R$
        </span>
        <span className="w-px h-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <span className="text-[12px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.84)' }}>
          {formatPHP(gamepass.your_price)}
        </span>
        <span className="w-px h-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'rgba(52,211,153,0.82)' }}>
          +{formatPHP(gamepass.profit)}
        </span>
      </div>
    </button>
  )
}
