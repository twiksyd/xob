'use client'

import { Bell, Search } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (val: string) => void
  actionLabel?: string
  onActionClick?: () => void
}

export default function TopBar({
  title, subtitle,
  searchPlaceholder, searchValue, onSearchChange,
  actionLabel, onActionClick,
}: TopBarProps) {
  return (
    <header
      className="flex items-center h-16 px-6 gap-4 sticky top-0 z-10"
      style={{
        background: 'rgba(250, 251, 255, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.14)',
        boxShadow: '0 1px 0 rgba(0,212,255,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      {/* Left — title */}
      <div className="flex-shrink-0 min-w-[160px]">
        <h1 className="text-base font-bold tracking-tight leading-tight" style={{ color: 'oklch(0.13 0.030 270)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium mt-0.5 leading-none" style={{ color: 'oklch(0.52 0.018 265)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Center — search */}
      <div className="flex-1 flex justify-center">
        {searchPlaceholder && (
          <div className="relative w-full max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'oklch(0.52 0.018 265)' }}
            />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              className="pl-9 h-9 text-sm bg-white/80 border-border/60"
              style={{ borderRadius: '10px' }}
            />
          </div>
        )}
      </div>

      {/* Right — action + bell + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && (
          <Button
            onClick={onActionClick}
            className="h-8 px-4 text-xs font-bold tracking-wide uppercase gap-2"
            style={{
              background: 'linear-gradient(135deg, oklch(0.62 0.22 200) 0%, oklch(0.52 0.22 215) 100%)',
              boxShadow: '0 0 16px rgba(0,212,255,0.35), 0 4px 12px rgba(0,150,200,0.20)',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
            }}
          >
            {actionLabel}
          </Button>
        )}

        <button
          className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{
            background: 'white',
            border: '1px solid rgba(0, 212, 255, 0.20)',
            color: 'oklch(0.46 0.018 265)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Bell className="w-3.5 h-3.5" />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: '#ff0066', boxShadow: '0 0 6px #ff0066' }}
          />
        </button>

        <Avatar
          className="w-8 h-8 cursor-pointer hover:scale-105 transition-transform"
          style={{
            border: '1.5px solid rgba(0, 212, 255, 0.40)',
            boxShadow: '0 0 12px rgba(0, 212, 255, 0.20)',
          }}
        >
          <AvatarFallback
            className="text-xs font-black"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.10))',
              color: 'oklch(0.50 0.22 200)',
            }}
          >
            R
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
