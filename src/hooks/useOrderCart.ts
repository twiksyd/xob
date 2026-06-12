'use client'

import { useMemo, useState } from 'react'
import { Gamepass, Game, LineItem } from '@/lib/types/database'

type GamepassWithGame = Gamepass & { games: Game | null }

// Cart line items, grouped by gamepass for display (one tile click = one unit).
export type CartGroup = LineItem & { count: number }

export function useOrderCart(gamepasses: GamepassWithGame[]) {
  const [items, setItems] = useState<LineItem[]>([])

  function addToCart(gamepassId: string) {
    const gp = gamepasses.find(g => g.id === gamepassId)
    if (!gp) return
    setItems(prev => [
      ...prev.filter(i => i.gamepass_id),
      {
        _key:           Math.random().toString(36).slice(2),
        gamepass_id:    gp.id,
        gamepass_name:  gp.name,
        game_name:      gp.games?.name ?? null,
        robux_amount:   gp.robux_amount,
        selling_price:  gp.your_price,
        cost:           gp.your_cost,
        profit:         gp.profit,
      },
    ])
  }

  function removeFromCart(gamepassId: string) {
    setItems(prev => {
      const idx = prev.map(i => i.gamepass_id).lastIndexOf(gamepassId)
      if (idx === -1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  function clearCart() {
    setItems([])
  }

  const cartGroups = useMemo(() => {
    const map = new Map<string, CartGroup>()
    items.forEach(item => {
      if (!item.gamepass_id) return
      const existing = map.get(item.gamepass_id)
      if (existing) existing.count += 1
      else map.set(item.gamepass_id, { ...item, count: 1 })
    })
    return Array.from(map.values())
  }, [items])

  const cartCounts = useMemo(() => {
    const m = new Map<string, number>()
    cartGroups.forEach(g => m.set(g.gamepass_id, g.count))
    return m
  }, [cartGroups])

  const validItems = useMemo(() => items.filter(i => i.gamepass_id), [items])

  return { items, setItems, addToCart, removeFromCart, clearCart, cartGroups, cartCounts, validItems }
}
