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
