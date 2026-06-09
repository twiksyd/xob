'use client'

import { Bell, Search, Plus, Menu } from 'lucide-react'
import { useMobileNav } from './MobileNavContext'

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
  const { open } = useMobileNav()

  return (
    <header
      className="flex items-center h-[60px] px-4 sm:px-6 gap-3 sm:gap-4 flex-shrink-0 sticky top-0 z-10"
      style={{
        background: 'rgba(240,236,255,0.80)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid rgba(139,92,246,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.60) inset, 0 1px 16px rgba(139,92,246,0.06)',
      }}
    >
      {/* Hamburger — mobile only (lg+ shows the sidebar inline) */}
      <button
        onClick={open}
        aria-label="Open navigation menu"
        className="lg:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
        style={{
          background: 'rgba(255,255,255,0.70) padding-box, linear-gradient(135deg, rgba(139,92,246,0.20), rgba(34,211,238,0.16)) border-box',
          border: '1px solid transparent',
          color: 'oklch(0.32 0.18 220)',
        }}
      >
        <Menu className="w-[18px] h-[18px]" />
      </button>

      {/* Left */}
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-[15px] font-bold tracking-tight leading-tight" style={{ color: 'oklch(0.10 0.030 272)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] mt-0.5 leading-none" style={{ color: 'oklch(0.50 0.014 265)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Center — search (hidden on mobile, visible sm+) */}
      <div className="hidden sm:flex flex-1 justify-center">
        {searchPlaceholder && (
          <div
            className="relative flex items-center w-full max-w-[440px]"
            style={{
              background: 'rgba(255,255,255,0.84) padding-box, linear-gradient(135deg, rgba(139,92,246,0.18), rgba(34,211,238,0.14)) border-box',
              border: '1px solid transparent',
              borderRadius: '100px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 6px rgba(139,92,246,0.07), 0 2px 12px rgba(15,13,42,0.04)',
            }}
          >
            <Search className="absolute left-4 w-3.5 h-3.5 flex-shrink-0 pointer-events-none" style={{ color: 'oklch(0.55 0.014 265)' }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent pl-10 pr-16 py-[8px] text-[13px] outline-none"
              style={{ color: 'oklch(0.10 0.030 272)' }}
            />
            <kbd
              className="absolute right-4 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold pointer-events-none"
              style={{
                background: 'rgba(139,92,246,0.07)',
                border: '1px solid rgba(139,92,246,0.14)',
                color: 'oklch(0.45 0.12 280)',
              }}
            >
              Ctrl K
            </kbd>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && (
          <button
            onClick={onActionClick}
            className="btn-outline h-[34px] px-4 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            {actionLabel.replace(/^\+\s*/, '')}
          </button>
        )}

        {/* Bell with count badge */}
        <div className="relative">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(255,255,255,0.85) padding-box, linear-gradient(135deg, rgba(139,92,246,0.20), rgba(34,211,238,0.20)) border-box',
              border: '1px solid transparent',
              color: 'oklch(0.45 0.014 265)',
            }}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, #e879f9, #a78bfa)', boxShadow: '0 0 8px rgba(232,121,249,0.60)' }}
          >
            3
          </span>
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, oklch(0.10 0.030 272), oklch(0.18 0.025 280))',
            color: 'white',
            boxShadow: '0 2px 8px rgba(15,13,42,0.25)',
          }}
        >
          X
        </div>
      </div>
    </header>
  )
}
