import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const config: Record<string, { dot: string; pill: string }> = {
  // Gamepass status
  Good:       { dot: '#22d3ee', pill: 'bg-sky-50    text-sky-700    border border-sky-200/80'   },
  Okay:       { dot: '#f59e0b', pill: 'bg-amber-50  text-amber-700  border border-amber-200/80' },
  Bad:        { dot: '#f43f5e', pill: 'bg-rose-50   text-rose-700   border border-rose-200/80'  },
  // Order status
  pending:    { dot: '#94a3b8', pill: 'bg-slate-50  text-slate-500  border border-slate-200/80' },
  paid:       { dot: '#38bdf8', pill: 'bg-sky-50    text-sky-700    border border-sky-200/80'   },
  delivering: { dot: '#f59e0b', pill: 'bg-amber-50  text-amber-700  border border-amber-200/80' },
  completed:  { dot: '#22d3ee', pill: 'bg-cyan-50   text-cyan-700   border border-cyan-200/80'  },
  refunded:   { dot: '#a78bfa', pill: 'bg-violet-50 text-violet-700 border border-violet-200/80'},
  cancelled:  { dot: '#f43f5e', pill: 'bg-rose-50   text-rose-700   border border-rose-200/80'  },
  // Account status
  active:     { dot: '#22d3ee', pill: 'bg-cyan-50   text-cyan-700   border border-cyan-200/80'  },
  inactive:   { dot: '#94a3b8', pill: 'bg-slate-50  text-slate-500  border border-slate-200/80' },
  banned:     { dot: '#f43f5e', pill: 'bg-rose-50   text-rose-700   border border-rose-200/80'  },
  low:        { dot: '#f59e0b', pill: 'bg-amber-50  text-amber-700  border border-amber-200/80' },
  // Transaction
  sale:       { dot: '#22d3ee', pill: 'bg-cyan-50   text-cyan-700   border border-cyan-200/80'  },
  topup:      { dot: '#38bdf8', pill: 'bg-sky-50    text-sky-700    border border-sky-200/80'   },
  adjustment: { dot: '#94a3b8', pill: 'bg-slate-50  text-slate-500  border border-slate-200/80' },
  refund:     { dot: '#f43f5e', pill: 'bg-rose-50   text-rose-700   border border-rose-200/80'  },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status] ?? { dot: '#94a3b8', pill: 'bg-slate-50 text-slate-500 border border-slate-200/80' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold capitalize whitespace-nowrap',
        c.pill, className
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c.dot, boxShadow: `0 0 4px ${c.dot}60` }}
      />
      {status}
    </span>
  )
}
