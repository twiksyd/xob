'use client'

import { motion } from 'framer-motion'
import { LucideIcon, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
  /** Skip the glass-card surface — use when already nested inside another glass surface. */
  bare?: boolean
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, actionHref, className, bare = false }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(bare ? 'p-6' : 'glass-card p-10 sm:p-12', 'text-center', className)}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.20)' }}
      >
        <Icon className="w-5.5 h-5.5" style={{ color: '#a78bfa' }} />
      </div>
      <p className="text-[14px] font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.82)' }}>{title}</p>
      <p className="text-[12.5px] max-w-sm mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
        {description}
      </p>
      {actionLabel && (onAction || actionHref) && (
        actionHref ? (
          <Button render={<a href={actionHref} />} variant="primary" className="gap-1.5 px-4 h-9 mt-5">
            {actionLabel} <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button type="button" onClick={onAction} variant="primary" className="gap-1.5 px-4 h-9 mt-5">
            {actionLabel} <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        )
      )}
    </motion.div>
  )
}
