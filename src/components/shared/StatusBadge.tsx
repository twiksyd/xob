import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const config: Record<string, { dot: string; pill: string; label?: string }> = {
  // Gamepass profit status
  Good:        { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  Okay:        { dot: 'bg-amber-400',   pill: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  Bad:         { dot: 'bg-red-400',     pill: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  // Order status
  pending:     { dot: 'bg-slate-400',   pill: 'bg-slate-500/15 text-slate-300 border border-slate-500/30' },
  paid:        { dot: 'bg-blue-400',    pill: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  delivering:  { dot: 'bg-amber-400',   pill: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  completed:   { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  refunded:    { dot: 'bg-purple-400',  pill: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
  cancelled:   { dot: 'bg-red-400',     pill: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  // Account status
  active:      { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  inactive:    { dot: 'bg-slate-400',   pill: 'bg-slate-500/15 text-slate-300 border border-slate-500/30' },
  banned:      { dot: 'bg-red-400',     pill: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  low:         { dot: 'bg-amber-400',   pill: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  // Transaction type
  sale:        { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  topup:       { dot: 'bg-blue-400',    pill: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  adjustment:  { dot: 'bg-slate-400',   pill: 'bg-slate-500/15 text-slate-300 border border-slate-500/30' },
  refund:      { dot: 'bg-red-400',     pill: 'bg-red-500/15 text-red-400 border border-red-500/30' },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status] ?? { dot: 'bg-muted-foreground', pill: 'bg-muted text-muted-foreground border border-border/40' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize', c.pill, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {status}
    </span>
  )
}
