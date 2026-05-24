'use client'

import { Bell, Search } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
        background: 'rgba(250, 251, 255, 0.94)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.10)',
        boxShadow: '0 1px 0 rgba(139,92,246,0.06), 0 4px 16px rgba(0,0,0,0.03)',
      }}
    >
      {/* Left — title */}
      <div className="flex-shrink-0 min-w-[180px]">
        <h1 className="text-base font-black tracking-tight leading-tight uppercase" style={{ color: '#1e1b4b' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium mt-0.5 leading-none" style={{ color: '#9ca3af' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Center — search */}
      <div className="flex-1 flex justify-center">
        {searchPlaceholder && (
          <div
            className="relative flex items-center w-full max-w-md"
            style={{
              background: 'white',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Search className="absolute left-3 w-3.5 h-3.5 flex-shrink-0" style={{ color: '#9ca3af' }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent pl-9 pr-3 py-2 text-sm outline-none placeholder:text-gray-400"
              style={{ color: '#1e1b4b', minWidth: 0 }}
            />
            <div
              className="flex-shrink-0 mr-3 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: 'rgba(139,92,246,0.08)', color: '#7c3aed' }}
            >
              Ctrl K
            </div>
          </div>
        )}
      </div>

      {/* Right — action + bell + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionLabel && (
          <button
            onClick={onActionClick}
            className="h-9 px-4 text-xs font-bold tracking-wide uppercase flex items-center gap-2 transition-all hover:shadow-lg"
            style={{
              background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #ec4899, #8b5cf6) border-box',
              border: '1.5px solid transparent',
              borderRadius: '10px',
              color: '#7c3aed',
            }}
          >
            {actionLabel}
          </button>
        )}

        <button
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{
            background: 'white',
            border: '1px solid rgba(139,92,246,0.15)',
            color: '#6b7280',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <Bell className="w-3.5 h-3.5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full flex items-center justify-center text-[8px] font-black text-white"
            style={{ background: '#8b5cf6', boxShadow: '0 0 6px rgba(139,92,246,0.6)' }}
          >
            3
          </span>
        </button>

        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black hover:scale-105 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(30,27,75,0.30)',
          }}
        >
          X
        </button>
      </div>
    </header>
  )
}
