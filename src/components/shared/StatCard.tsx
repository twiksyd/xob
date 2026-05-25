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
        background: `rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, ${accentColor}42, rgba(34,211,238,0.28) 50%, rgba(232,121,249,0.18)) border-box`,
        border: '1px solid transparent',
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: `0 2px 16px ${accentColor}18, 0 4px 24px rgba(15,13,42,0.04)`,
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${accentColor}70 40%, ${accentColor}50 60%, transparent 95%)` }}
      />

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}0c)`,
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 0 20px ${accentColor}20`,
          }}
        >
          <Icon
            className="w-6 h-6"
            style={{ color: iconColor, filter: `drop-shadow(0 0 5px ${accentColor}80)` }}
          />
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
