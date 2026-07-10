import type { CSSProperties } from 'react'

// ── Deterministic game accent colors ─────────────────────────────────────────
// Hashes the game name to one of 12 tasteful palette entries. No DB storage —
// the same game name always produces the same color, everywhere, forever.
const GAME_ACCENT_PALETTE = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#84cc16', // Lime
  '#14b8a6', // Teal
] as const

function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h
}

export function getGameAccentColor(gameName: string): string {
  if (!gameName) return GAME_ACCENT_PALETTE[4] // Violet fallback
  return GAME_ACCENT_PALETTE[djb2(gameName) % GAME_ACCENT_PALETTE.length]
}

// ── Discounted Game Status ────────────────────────────────────────────────────
// Purely visual, never read by any cost/profit/inventory calculation. One
// shared style so every render site stays in sync.
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
