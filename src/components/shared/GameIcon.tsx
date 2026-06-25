'use client'

import { useState } from 'react'

interface GameIconProps {
  iconUrl?: string | null
  color: string
  size?: number
  className?: string
}

// Mirrors RobloxAvatar.tsx's img-with-fallback pattern exactly — real
// thumbnail when available, falling back to the existing color dot on
// missing/broken URLs. Shape is deliberately different per state (rounded
// square for a real thumbnail, circle for the abstract color fallback) so
// it's never ambiguous which one is showing.
export default function GameIcon({ iconUrl, color, size = 20, className }: GameIconProps) {
  const [errored, setErrored] = useState(false)

  if (iconUrl && !errored) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={className}
        style={{ width: size, height: size, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <span
      className={className}
      style={{
        width: Math.round(size * 0.4),
        height: Math.round(size * 0.4),
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}80`,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}
