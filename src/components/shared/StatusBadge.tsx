import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const styles: Record<string, string> = {
  // Gamepass profit status
  Good: 'badge-good',
  Okay: 'badge-okay',
  Bad: 'badge-bad',
  // Order status
  pending: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  paid: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  delivering: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  completed: 'badge-good',
  refunded: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  cancelled: 'badge-bad',
  // Account status
  active: 'badge-good',
  inactive: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  banned: 'badge-bad',
  low: 'badge-okay',
  // Transaction type
  sale: 'badge-good',
  topup: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  adjustment: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  refund: 'badge-bad',
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize', styles[status] ?? 'bg-muted text-muted-foreground', className)}>
      {status}
    </span>
  )
}
