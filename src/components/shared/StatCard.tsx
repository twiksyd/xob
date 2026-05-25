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
  title, value, subtitle, icon: Icon,
  iconColor = '#22d3ee', accentColor = '#22d3ee',
  trend, className,
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 ${className ?? ''}`}
      style={{
        background: 'rgba(255,255,255,0.90)',
        border: '1px solid rgba(15,13,42,0.055)',
        boxShadow: '0 1px 3px rgba(15,13,42,0.04), 0 4px 16px rgba(15,13,42,0.03)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-5 right-5 h-[1.5px] rounded-b"
        style={{ background: `linear-gradient(90deg, ${accentColor}50, ${accentColor}10 80%, transparent)` }}
      />

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}22`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="label-caps mb-1">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && (
            <p className="text-[11px] mt-1 leading-snug" style={{ color: 'oklch(0.55 0.012 265)' }}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={`text-[11px] font-bold mt-1 ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
