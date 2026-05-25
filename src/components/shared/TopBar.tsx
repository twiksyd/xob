'use client'

import { Bell, Search } from 'lucide-react'

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
      className="flex items-center h-[60px] px-6 gap-4 flex-shrink-0 sticky top-0 z-10"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(15,13,42,0.055)',
        boxShadow: '0 1px 0 rgba(15,13,42,0.03)',
      }}
    >
      {/* Left */}
      <div className="flex-shrink-0 min-w-[160px]">
        <h1 className="text-[15px] font-bold tracking-tight leading-tight" style={{ color: 'oklch(0.10 0.030 272)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] mt-0.5 leading-none" style={{ color: 'oklch(0.50 0.014 265)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Center — search */}
      <div className="flex-1 flex justify-center">
        {searchPlaceholder && (
          <div
            className="relative flex items-center w-full max-w-[400px]"
            style={{
              background: 'white',
              border: '1px solid rgba(15,13,42,0.08)',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(15,13,42,0.04)',
            }}
          >
            <Search className="absolute left-3 w-3.5 h-3.5 flex-shrink-0 pointer-events-none" style={{ color: 'oklch(0.60 0.010 265)' }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent pl-9 pr-12 py-[7px] text-[13px] outline-none"
              style={{ color: 'oklch(0.10 0.030 272)' }}
            />
            <kbd
              className="absolute right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium pointer-events-none"
              style={{
                background: 'rgba(15,13,42,0.04)',
                border: '1px solid rgba(15,13,42,0.08)',
                color: 'oklch(0.55 0.010 265)',
              }}
            >
              ⌘K
            </kbd>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && (
          <button
            onClick={onActionClick}
            className="btn-outline h-[34px] px-4 flex items-center gap-2 cursor-pointer"
          >
            {actionLabel}
          </button>
        )}

        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'white',
            border: '1px solid rgba(15,13,42,0.08)',
            color: 'oklch(0.50 0.014 265)',
          }}
        >
          <Bell className="w-3.5 h-3.5" />
          <span
            className="absolute top-[5px] right-[5px] w-1.5 h-1.5 rounded-full"
            style={{ background: '#e879f9', boxShadow: '0 0 5px rgba(232,121,249,0.6)' }}
          />
        </button>

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, oklch(0.10 0.030 272), oklch(0.18 0.025 280))',
            color: 'white',
            boxShadow: '0 2px 6px rgba(15,13,42,0.20)',
          }}
        >
          R
        </div>
      </div>
    </header>
  )
}
