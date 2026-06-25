import type { CSSProperties } from 'react'

// Discounted Game Status — purely visual, never read by any cost/profit/
// inventory calculation. One shared style so every render site (gamepass
// tiles, filter chips, order history, dashboard, etc.) stays in sync —
// changing the look only ever happens here.
export function getGameNameStyle(isDiscounted: boolean | null | undefined): CSSProperties {
  return isDiscounted
    ? { color: '#34d399', textShadow: '0 0 8px rgba(52,211,153,0.50), 0 0 16px rgba(52,211,153,0.22)' }
    : { color: 'rgba(148,163,184,0.72)' }
}

// ── Game Selector — pinned & recent games ───────────────────────────────────
// Two deliberately separate localStorage stores. Pinned is permanent until
// manually removed (⭐); recent is automatic history (🕒) capped at a small
// count. They are different concepts and must never share storage or derive
// from one another.
const LS_PINNED_GAMES = 'xob-pinned-games'
const LS_RECENT_GAMES = 'xob-recent-games'
const RECENT_GAMES_CAP = 8

function readIds(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

export function getPinnedGameIds(): string[] {
  return readIds(LS_PINNED_GAMES)
}

export function togglePinnedGame(gameId: string): string[] {
  const current = readIds(LS_PINNED_GAMES)
  const next = current.includes(gameId)
    ? current.filter(id => id !== gameId)
    : [...current, gameId]
  writeIds(LS_PINNED_GAMES, next)
  return next
}

export function getRecentGameIds(): string[] {
  return readIds(LS_RECENT_GAMES)
}

// Most-recent-first, deduplicated, capped — called once per selection.
export function addRecentGameId(gameId: string): string[] {
  const current = readIds(LS_RECENT_GAMES)
  const next = [gameId, ...current.filter(id => id !== gameId)].slice(0, RECENT_GAMES_CAP)
  writeIds(LS_RECENT_GAMES, next)
  return next
}
