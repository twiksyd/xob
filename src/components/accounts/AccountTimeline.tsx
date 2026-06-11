'use client'

import { useMemo } from 'react'
import { OrderWithItems, RobloxReservation, OrderReassignment } from '@/lib/types/database'
import { format } from 'date-fns'
import { History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccountTimelineProps {
  accountId: string
  orders: OrderWithItems[]
  reservations: RobloxReservation[]
  reassignments: OrderReassignment[]
}

type TimelineEvent = {
  id: string
  date: string
  color: string
  title: string
  detail?: string
  amounts?: { label: string; value: string; positive: boolean }[]
}

export default function AccountTimeline({ accountId, orders, reservations, reassignments }: AccountTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = []

    for (const order of orders) {
      const label = order.order_number ? `Order #${order.order_number}` : 'Order'

      if (order.completed_at) {
        out.push({
          id: `${order.id}-completed`,
          date: order.completed_at,
          color: '#34d399',
          title: `Completed ${label}`,
          amounts: [
            { label: 'Revenue', value: `+₱${(order.selling_price ?? 0).toFixed(2)}`, positive: true },
            { label: 'Robux', value: `-${(order.robux_amount ?? 0).toLocaleString()} R$`, positive: false },
          ],
        })
      }

      if (order.refunded_at) {
        out.push({
          id: `${order.id}-refunded`,
          date: order.refunded_at,
          color: '#f43f5e',
          title: `Refund Issued — ${label}`,
          amounts: [
            { label: 'Robux Restored', value: `+${(order.robux_amount ?? 0).toLocaleString()} R$`, positive: true },
          ],
        })
      }

      if (order.status === 'cancelled') {
        out.push({
          id: `${order.id}-cancelled`,
          date: order.updated_at,
          color: '#f43f5e',
          title: `Cancelled ${label}`,
        })
      }
    }

    for (const res of reservations) {
      out.push({
        id: `${res.id}-created`,
        date: res.created_at,
        color: '#f59e0b',
        title: 'Reservation Created',
        detail: res.gamepass_names || undefined,
        amounts: [
          { label: 'Reserved', value: `${res.robux_amount.toLocaleString()} R$`, positive: false },
        ],
      })
      if (res.released_at) {
        out.push({
          id: `${res.id}-released`,
          date: res.released_at,
          color: '#94a3b8',
          title: 'Reservation Released',
          detail: res.gamepass_names || undefined,
          amounts: [
            { label: 'Released', value: `${res.robux_amount.toLocaleString()} R$`, positive: true },
          ],
        })
      }
    }

    for (const r of reassignments) {
      const incoming = r.to_account_id === accountId
      out.push({
        id: `${r.id}-reassigned`,
        color: '#22d3ee',
        date: r.created_at,
        title: incoming
          ? `Order Reassigned from ${r.from_account_username}`
          : `Order Reassigned to ${r.to_account_username}`,
        amounts: r.robux_amount > 0
          ? [{ label: 'Moved', value: `${incoming ? '+' : '-'}${r.robux_amount.toLocaleString()} R$`, positive: incoming }]
          : undefined,
      })
    }

    return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [accountId, orders, reservations, reassignments])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label-caps">Account Timeline</span>
        {events.length > 0 && (
          <span className="text-[12px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <History className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
          <p className="text-[14px] font-semibold mb-1" style={{ color: 'oklch(0.40 0.016 265)' }}>No activity yet</p>
          <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>
            Order completions, refunds, and reassignments will show up here
          </p>
        </div>
      ) : (
        <div className="glass-card p-5 max-h-[480px] overflow-y-auto">
          {events.map((event, i) => (
            <div key={event.id} className="flex gap-3">
              {/* Timeline rail */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: event.color, boxShadow: `0 0 6px ${event.color}80` }}
                />
                {i < events.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ background: 'rgba(15,13,42,0.08)', minHeight: '24px' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-5">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'oklch(0.58 0.010 265)' }}>
                  {format(new Date(event.date), 'MMMM d, yyyy')}
                </p>
                <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>{event.title}</p>
                {event.detail && (
                  <p className="text-[12px] mt-0.5" style={{ color: 'oklch(0.50 0.014 265)' }}>{event.detail}</p>
                )}
                {event.amounts && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {event.amounts.map((a, j) => (
                      <span
                        key={j}
                        className={cn('text-[12px] font-semibold tabular-nums', a.positive ? 'text-emerald-500' : 'text-red-400')}
                      >
                        {a.value} {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
