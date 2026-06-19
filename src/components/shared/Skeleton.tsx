'use client'

import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl', className)}
      style={{ background: 'rgba(255,255,255,0.065)', ...style }}
    />
  )
}

export function SkeletonCard({ icon = true, lines = 1, className }: { icon?: boolean; lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-2xl p-5', className)} style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-4">
        {icon && <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />}
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
          {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-2/3" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" style={{ maxWidth: i === 0 ? '90px' : undefined }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="px-5 py-3.5 flex items-center gap-6"
          style={{ borderBottom: r < rows - 1 ? '1px solid rgba(255,255,255,0.045)' : 'none' }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" style={{ opacity: 1 - r * 0.07, maxWidth: c === 0 ? '110px' : undefined }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 220 }: { height?: number }) {
  const bars = [0.4, 0.65, 0.5, 0.8, 0.55, 0.7, 0.45, 0.6, 0.5, 0.75, 0.6, 0.85]
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {bars.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h * 100}%` }} />
        ))}
      </div>
    </div>
  )
}
