'use client'

import { Bell } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TopBarProps {
  title: string
  subtitle?: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between h-14 px-6 sticky top-0 z-10"
      style={{
        background: 'oklch(0.07 0.016 258 / 0.90)',
        backdropFilter: 'blur(16px) saturate(160%)',
        borderBottom: '1px solid oklch(0.195 0.022 262 / 0.60)',
        boxShadow: '0 1px 0 oklch(0.22 0.024 262 / 0.10)',
      }}
    >
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'oklch(0.13 0.018 262)', border: '1px solid oklch(0.20 0.022 262)' }}
        >
          <Bell className="w-3.5 h-3.5" />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: 'oklch(0.74 0.22 150)', boxShadow: '0 0 6px oklch(0.74 0.22 150 / 0.8)' }}
          />
        </button>

        <Avatar
          className="w-8 h-8 cursor-pointer"
          style={{ border: '1.5px solid oklch(0.74 0.22 150 / 0.50)', boxShadow: '0 0 10px oklch(0.74 0.22 150 / 0.15)' }}
        >
          <AvatarFallback
            className="text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, oklch(0.74 0.22 150 / 0.20), oklch(0.65 0.20 165 / 0.10))',
              color: 'oklch(0.74 0.22 150)',
            }}
          >
            R
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
