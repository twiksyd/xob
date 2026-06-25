'use client'

import { Search, Plus } from 'lucide-react'
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
      className="flex items-center h-[56px] px-4 sm:px-6 gap-3 sm:gap-4 flex-shrink-0 sticky top-0 z-10"
      style={{
        background: 'rgba(5, 5, 10, 0.80)',
        backdropFilter: 'blur(24px) saturate(150%)',
        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        borderBottom: '1px solid rgba(255,255,255,0.058)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.030), 0 1px 12px rgba(0,0,0,0.40)',
      }}
    >
      {/* Left — title */}
      <div className="flex-shrink-0 min-w-0">
        <h1
          className="text-[14px] font-bold tracking-tight leading-tight"
          style={{ color: 'rgba(255,255,255,0.88)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.34)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Center — search */}
      <div className="hidden sm:flex flex-1 justify-center">
        {searchPlaceholder && (
          <div
            className="relative flex items-center w-full max-w-[400px]"
            style={{
              background: 'rgba(255,255,255,0.040)',
              border: '1px solid rgba(255,255,255,0.080)',
              borderRadius: '100px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.28)',
            }}
          >
            <Search
              className="absolute left-3.5 w-3.5 h-3.5 flex-shrink-0 pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              className="flex-1 bg-transparent pl-10 pr-4 py-[7px] text-[12px] outline-none"
              style={{ color: 'rgba(255,255,255,0.80)' }}
            />
          </div>
        )}
      </div>

      {/* Right — CTA */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        {actionLabel && (
          <Button
            onClick={onActionClick}
            variant="pillOutline"
            className="h-[32px] px-3.5 gap-1.5"
          >
            <Plus className="w-3 h-3" />
            {actionLabel.replace(/^\+\s*/, '')}
          </Button>
        )}
      </div>
    </header>
  )
}
