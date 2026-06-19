'use client'

import { LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUpVariants, hoverLift } from '@/lib/motion'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  accentColor?: string
  trend?: { value: string; positive: boolean }
  className?: string
  animKey?: string
  /** Elevates this card as the grid's focal point — use on at most one card per grid. */
  featured?: boolean
}

export default function StatCard({
  title, value, subtitle, icon: Icon,
  iconColor = '#22d3ee', accentColor = '#22d3ee',
  trend, className, animKey, featured = false,
}: StatCardProps) {
  return (
    <motion.div
      {...hoverLift}
      className={`relative overflow-hidden rounded-2xl p-5 stat-card ${className ?? ''}`}
      style={{
        background: featured
          ? `rgba(255,255,255,0.052) padding-box, linear-gradient(135deg, ${accentColor}55, rgba(34,211,238,0.28) 50%, rgba(232,121,249,0.18)) border-box`
          : `rgba(255,255,255,0.042) padding-box, linear-gradient(135deg, ${accentColor}38, rgba(34,211,238,0.22) 50%, rgba(232,121,249,0.14)) border-box`,
        border: '1px solid transparent',
        backdropFilter: 'blur(24px) saturate(170%)',
        boxShadow: featured
          ? `0 0 28px ${accentColor}22, 0 4px 24px rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.26)`
          : `0 2px 16px ${accentColor}14, 0 4px 24px rgba(255,255,255,0.092), inset 0 0 0 1px rgba(255,255,255,0.22)`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${accentColor}70 40%, ${accentColor}50 60%, transparent 95%)` }}
      />

      <div className="flex items-center gap-4">
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

        <div className="min-w-0 flex-1">
          <p className="label-caps mb-1">{title}</p>
          <div className="overflow-hidden" style={{ height: featured ? '40px' : '32px' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={animKey ?? value}
                variants={fadeUpVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="stat-value"
                style={featured ? { fontSize: '34px', textShadow: `0 0 24px ${accentColor}40, 0 0 48px ${accentColor}18` } : undefined}
              >
                {value}
              </motion.p>
            </AnimatePresence>
          </div>
          {subtitle && (
            <div className="overflow-hidden" style={{ height: '18px' }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={`sub-${animKey ?? subtitle}`}
                  variants={fadeUpVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-[11px] mt-0.5 leading-snug"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {subtitle}
                </motion.p>
              </AnimatePresence>
            </div>
          )}
          {trend && (
            <p className={`text-[11px] font-bold mt-1 ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
