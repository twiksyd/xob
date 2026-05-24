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

const defaultAccent = 'oklch(0.74 0.22 150)'

export default function StatCard({
  title, value, subtitle, icon: Icon, iconColor = 'text-primary',
  accentColor = defaultAccent, trend, className
}: StatCardProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-5 space-y-3', className)}
      style={{
        background: 'oklch(0.11 0.018 262 / 0.98)',
        border: '1px solid oklch(0.22 0.024 262 / 0.75)',
        boxShadow: `0 8px 32px oklch(0.00 0.000 0 / 0.45), 0 1px 0 oklch(0.36 0.040 262 / 0.12) inset`,
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl opacity-70"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent 80%)` }}
      />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-[26px] font-black text-foreground mt-1.5 leading-none tabular-nums tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{subtitle}</p>}
        </div>

        <div
          className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ml-3', iconColor)}
          style={{
            background: `${accentColor}18`,
            boxShadow: `0 0 20px ${accentColor}22, 0 1px 0 ${accentColor}20 inset`,
            border: `1px solid ${accentColor}28`,
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend && (
        <div className={cn('flex items-center gap-1 text-xs font-semibold', trend.positive ? 'text-emerald-400' : 'text-red-400')}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}
