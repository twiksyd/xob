import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const config: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  // Gamepass status
  Good:       { dot: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  text: '#22d3ee',  border: 'rgba(34,211,238,0.25)'  },
  Okay:       { dot: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  text: '#fbbf24',  border: 'rgba(251,191,36,0.25)'  },
  Bad:        { dot: '#f87171', bg: 'rgba(248,113,113,0.10)', text: '#f87171',  border: 'rgba(248,113,113,0.25)' },
  // Order status
  pending:    { dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', text: 'rgba(255,255,255,0.55)', border: 'rgba(148,163,184,0.20)' },
  paid:       { dot: '#38bdf8', bg: 'rgba(56,189,248,0.10)',  text: '#38bdf8',  border: 'rgba(56,189,248,0.25)'  },
  delivering: { dot: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  text: '#fbbf24',  border: 'rgba(251,191,36,0.25)'  },
  completed:  { dot: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  text: '#22d3ee',  border: 'rgba(34,211,238,0.25)'  },
  refunded:   { dot: '#a78bfa', bg: 'rgba(167,139,250,0.10)', text: '#a78bfa',  border: 'rgba(167,139,250,0.25)' },
  cancelled:  { dot: '#f87171', bg: 'rgba(248,113,113,0.10)', text: '#f87171',  border: 'rgba(248,113,113,0.25)' },
  // Account status
  active:     { dot: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  text: '#22d3ee',  border: 'rgba(34,211,238,0.25)'  },
  inactive:   { dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', text: 'rgba(255,255,255,0.50)', border: 'rgba(148,163,184,0.20)' },
  banned:     { dot: '#f87171', bg: 'rgba(248,113,113,0.10)', text: '#f87171',  border: 'rgba(248,113,113,0.25)' },
  low:        { dot: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  text: '#fbbf24',  border: 'rgba(251,191,36,0.25)'  },
  // Transaction types
  sale:       { dot: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  text: '#22d3ee',  border: 'rgba(34,211,238,0.25)'  },
  topup:      { dot: '#38bdf8', bg: 'rgba(56,189,248,0.10)',  text: '#38bdf8',  border: 'rgba(56,189,248,0.25)'  },
  adjustment: { dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', text: 'rgba(255,255,255,0.50)', border: 'rgba(148,163,184,0.20)' },
  refund:     { dot: '#f87171', bg: 'rgba(248,113,113,0.10)', text: '#f87171',  border: 'rgba(248,113,113,0.25)' },
}

const fallback = { dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', text: 'rgba(255,255,255,0.50)', border: 'rgba(148,163,184,0.20)' }

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status] ?? fallback
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold capitalize whitespace-nowrap',
        className
      )}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c.dot, boxShadow: `0 0 5px ${c.dot}80` }}
      />
      {status}
    </span>
  )
}
