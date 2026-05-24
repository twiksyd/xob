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
      className={cn('relative overflow-hidden rounded-2xl p-5 space-y-3', className)}
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

      {/* Corner glow */}
      <div
        className="absolute top-0 left-0 w-32 h-32 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}0c 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'oklch(0.52 0.018 265)' }}
          >
            {title}
          </p>
          <p
            className="text-[28px] font-black mt-1.5 leading-none tabular-nums tracking-tight"
            style={{ color: 'oklch(0.13 0.030 270)' }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs mt-1.5 leading-snug" style={{ color: 'oklch(0.52 0.018 265)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ml-3', iconColor)}
          style={{
            background: `${accentColor}14`,
            border: `1px solid ${accentColor}28`,
            boxShadow: `0 0 16px ${accentColor}20`,
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend && (
        <div className={cn('flex items-center gap-1 text-xs font-bold', trend.positive ? 'text-emerald-600' : 'text-red-500')}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}
