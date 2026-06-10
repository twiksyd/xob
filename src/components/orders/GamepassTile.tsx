'use client'

import { motion } from 'framer-motion'
import { GamepassWithGame } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { springToggle } from '@/lib/motion'

interface GamepassTileProps {
  gamepass: GamepassWithGame
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

export default function GamepassTile({ gamepass, quantity, onAdd, onRemove }: GamepassTileProps) {
  const accent = gamepass.games?.color || '#8b5cf6'
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
        'relative flex w-full min-w-0 flex-col gap-2 p-3 rounded-2xl border text-left transition-all',
        inCart
          ? 'bg-primary/8 border-primary/35'
          : 'bg-secondary/35 border-border/35 hover:border-primary/25 hover:bg-accent/20'
      )}
      style={inCart ? { boxShadow: `0 0 0 1px ${accent}30, 0 4px 18px ${accent}16` } : undefined}
    >
      {/* Quantity badge */}
      {inCart && (
        <motion.span
          key={quantity}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springToggle}
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: accent, boxShadow: `0 0 10px ${accent}80` }}
        >
          ×{quantity}
        </motion.span>
      )}

      {/* Avatar + name — the focal point */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[14px] font-black"
          style={{
            background: `linear-gradient(135deg, ${accent}38, ${accent}1a)`,
            color: accent,
            boxShadow: `inset 0 1px 0 ${accent}35`,
          }}
        >
          {gamepass.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug truncate" style={{ color: 'oklch(0.12 0.028 272)' }}>
            {gamepass.name}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'oklch(0.58 0.010 265)' }}>
            {gamepass.games?.name ?? 'No game'}
          </p>
        </div>
      </div>

      {/* Numbers — secondary, muted, tabular */}
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'oklch(0.52 0.012 265)' }}>
          {gamepass.robux_amount.toLocaleString()} R$
        </span>
        <span className="w-px h-3" style={{ background: 'rgba(15,13,42,0.10)' }} />
        <span className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.14 0.028 272)' }}>
          ₱{gamepass.your_price}
        </span>
        <span className="ml-auto text-[10px] font-semibold tabular-nums" style={{ color: 'rgba(52,211,153,0.85)' }}>
          +₱{gamepass.profit.toFixed(2)}
        </span>
      </div>
    </button>
  )
}
