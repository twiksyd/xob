import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  accentColor?: string
  trend?: { value: string; positive: boolean }
  className?: string
}

export default function StatCard({
  title, value, subtitle, icon: Icon, iconColor = 'text-primary',
  accentColor = '#00d4ff', trend, className
}: StatCardProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-5', className)}
      style={{
        background: 'rgba(255, 255, 255, 0.92)',
        border: `1px solid ${accentColor}28`,
        borderRadius: '16px',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.95) inset, 0 4px 24px rgba(0,0,0,0.06), 0 0 32px ${accentColor}0a`,
      }}
    >
      {/* Top neon accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00 80%)` }}
      />

      <div className="flex items-center gap-4">
        {/* Icon — left */}
        <div
          className={cn('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0', iconColor)}
          style={{
            background: `${accentColor}16`,
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 0 20px ${accentColor}22`,
          }}
        >
          <Icon className="w-6 h-6" />
        </div>

        {/* Content — right */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'oklch(0.52 0.018 265)' }}
          >
            {title}
          </p>
          <p
            className="text-[26px] font-black mt-0.5 leading-none tabular-nums tracking-tight"
            style={{ color: 'oklch(0.13 0.030 270)' }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs mt-1 leading-snug" style={{ color: 'oklch(0.52 0.018 265)' }}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-bold mt-1', trend.positive ? 'text-emerald-600' : 'text-red-500')}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
