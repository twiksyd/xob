'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RobloxAvatarProps {
  username: string
  userId?: string | null
  size?: number
  className?: string
  gradient?: string
  glow?: string
  textColor?: string
}

export default function RobloxAvatar({
  username,
  userId,
  size = 40,
  className,
  gradient = 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))',
  glow = '0 0 8px rgba(139,92,246,0.16)',
  textColor = 'white',
}: RobloxAvatarProps) {
  const [errored, setErrored] = useState(false)

  if (userId && !errored) {
    return (
      <img
        src={`/api/roblox-avatar?userId=${userId}`}
        alt={username}
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={cn('rounded-2xl object-cover flex-shrink-0', className)}
        style={{ width: size, height: size, boxShadow: glow === 'none' ? undefined : glow }}
      />
    )
  }

  return (
    <div
      className={cn('rounded-2xl flex items-center justify-center font-black flex-shrink-0', className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: gradient, boxShadow: glow === 'none' ? undefined : glow, color: textColor }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  )
}
