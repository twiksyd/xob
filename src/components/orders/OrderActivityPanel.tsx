'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { Edit2, ChevronDown, Trash2 } from 'lucide-react'
import StatusBadge from '@/components/shared/StatusBadge'
import { OrderWithDetails } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { isHistoryOrder } from '@/lib/utils/orders'
import { Skeleton } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { Inbox } from 'lucide-react'

interface OrderActivityPanelProps {
  orders: OrderWithDetails[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  historyExpanded: boolean
  onToggleHistory: () => void
  onEdit: (order: OrderWithDetails) => void
  onInspect: (order: OrderWithDetails) => void
  onDelete: (order: OrderWithDetails) => void
  onLoadMore: () => void
}

// Active orders are owned by the Action Center above (§02) — this panel is
// purely the historical record, so there's exactly one place to manage a
// live order instead of two copies with different capabilities.
export default function OrderActivityPanel({
  orders, loading, hasMore, loadingMore,
  historyExpanded, onToggleHistory, onEdit, onInspect, onDelete, onLoadMore,
}: OrderActivityPanelProps) {
  const historyOrders = useMemo(() => orders.filter(isHistoryOrder), [orders])

  if (loading) {
    return (
      <div className="glass-secondary overflow-hidden p-4 space-y-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="glass-secondary order-table-glow overflow-hidden">
      <button
        onClick={onToggleHistory}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{
          background: historyExpanded ? 'rgba(255,255,255,0.28)' : 'transparent',
          borderBottom: historyExpanded ? '1px solid rgba(255,255,255,0.078)' : 'none',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="label-caps">History</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.47)' }}
          >
            {historyOrders.length}
          </span>
        </div>
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            color: 'rgba(255,255,255,0.47)',
            transform: historyExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <AnimatePresence>
        {historyExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {historyOrders.length === 0 ? (
              <EmptyState icon={Inbox} title="No history yet" description="Completed, refunded, and cancelled orders show up here." bare />
            ) : (
              <div style={{ maxHeight: '560px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {historyOrders.slice(0, 40).map((order) => {
                    const oi = order.order_items ?? []
                    return (
                      <div
                        key={order.id}
                        className="flex items-center gap-2.5 px-4 py-2.5 group order-row-shimmer transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.065)' }}
                        onClick={() => onInspect(order)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-[10px] font-semibold" style={{ color: '#22d3ee' }}>
                              {order.order_number ?? '—'}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>
                            {order.buyer_name ?? '—'}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            {oi.length > 0 ? oi[0].gamepass_name : (order.gamepasses?.name ?? '—')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                            {order.selling_price ? formatPHP(order.selling_price) : '—'}
                          </p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(order) }}
                            className="w-6 h-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(order) }}
                            className="w-6 h-6 rounded-md hover:bg-accent text-muted-foreground hover:text-red-400 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {hasMore && (
                  <div className="px-4 py-3 text-center">
                    <button
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className="text-[11px] font-medium disabled:opacity-40 transition-opacity"
                      style={{ color: '#22d3ee' }}
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
