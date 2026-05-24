import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const config: Record<string, { dot: string; pill: string; glow?: string }> = {
  // Gamepass profit status
  Good:        { dot: '#10b981', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Okay:        { dot: '#f59e0b', pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Bad:         { dot: '#ef4444', pill: 'bg-red-50 text-red-600 border border-red-200' },
  // Order status
  pending:     { dot: '#94a3b8', pill: 'bg-slate-100 text-slate-600 border border-slate-200' },
  paid:        { dot: '#3b82f6', pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  delivering:  { dot: '#f59e0b', pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  completed:   { dot: '#00d4ff', pill: 'bg-cyan-50 text-cyan-700 border border-cyan-200', glow: '0 0 8px rgba(0,212,255,0.30)' },
  refunded:    { dot: '#8b5cf6', pill: 'bg-violet-50 text-violet-700 border border-violet-200' },
  cancelled:   { dot: '#ff0066', pill: 'bg-pink-50 text-pink-700 border border-pink-200' },
  // Account status
  active:      { dot: '#10b981', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  inactive:    { dot: '#94a3b8', pill: 'bg-slate-100 text-slate-600 border border-slate-200' },
  banned:      { dot: '#ef4444', pill: 'bg-red-50 text-red-600 border border-red-200' },
  low:         { dot: '#f59e0b', pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  // Transaction type
  sale:        { dot: '#10b981', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  topup:       { dot: '#3b82f6', pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  adjustment:  { dot: '#94a3b8', pill: 'bg-slate-100 text-slate-600 border border-slate-200' },
  refund:      { dot: '#ef4444', pill: 'bg-red-50 text-red-600 border border-red-200' },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status] ?? { dot: '#94a3b8', pill: 'bg-slate-100 text-slate-600 border border-slate-200' }
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap', c.pill, className)}
      style={c.glow ? { boxShadow: c.glow } : undefined}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c.dot, boxShadow: `0 0 5px ${c.dot}80` }}
      />
      {status}
    </span>
  )
}
