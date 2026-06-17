'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  MoreHorizontal, Edit2, Trash2, X, ChevronDown,
} from 'lucide-react'
import StatusBadge from '@/components/shared/StatusBadge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrderWithDetails } from '@/lib/types/database'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import { isActiveOrder, isHistoryOrder, isStaleOrder, groupOrderItems } from '@/lib/utils/orders'
import OrderInspectDialog from '@/components/orders/OrderInspectDialog'

const STATUS_FLOW: Record<string, string> = { pending: 'paid', paid: 'completed' }

const ACTION_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: 'Mark Paid', bg: 'rgba(245,158,11,0.09)', color: '#b45309', border: 'rgba(245,158,11,0.24)' },
  paid:    { label: 'Complete',  bg: 'rgba(52,211,153,0.09)', color: '#047857', border: 'rgba(52,211,153,0.24)' },
}

const STATUS_ACCENT: Record<string, string> = { pending: '#f59e0b', paid: '#22d3ee' }

interface OrderActivityPanelProps {
  orders: OrderWithDetails[]
  loading: boolean
  statusChanging: string | null
  hasMore: boolean
  loadingMore: boolean
  historyExpanded: boolean
  onToggleHistory: () => void
  onEdit: (order: OrderWithDetails) => void
  onStatusChange: (order: OrderWithDetails, newStatus: string) => void
  onDelete: (order: OrderWithDetails) => void
  onLoadMore: () => void
}

export default function OrderActivityPanel({
  orders, loading, statusChanging, hasMore, loadingMore,
  historyExpanded, onToggleHistory, onEdit, onStatusChange, onDelete, onLoadMore,
}: OrderActivityPanelProps) {
  const activeOrders  = useMemo(() => orders.filter(isActiveOrder), [orders])
  const historyOrders = useMemo(() => orders.filter(isHistoryOrder), [orders])
  const [now] = useState(() => Date.now())
  const [inspectOrder, setInspectOrder] = useState<OrderWithDetails | null>(null)

  return (
    <div
      className="w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-4 lg:overflow-y-auto"
      style={{ scrollbarWidth: 'thin' }}
    >

      {/* Active orders */}
      <div className="glass-secondary overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{
            background: 'rgba(255,255,255,0.28)',
            borderBottom: '1px solid rgba(255,255,255,0.078)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="label-caps">Active Orders</span>
            {activeOrders.length > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: 'rgba(34,211,238,0.10)', color: '#0e7490', border: '1px solid rgba(34,211,238,0.20)' }}
              >
                {activeOrders.length}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><div className="spinner" /></div>
        ) : activeOrders.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>No active orders</p>
            <p className="text-[11px] mt-1" style={{ color: 'oklch(0.70 0.010 265)' }}>Orders appear here after creation</p>
          </div>
        ) : (
          <AnimatePresence>
            {activeOrders.map((order) => {
              const nextStatus = STATUS_FLOW[order.status]
              const action     = nextStatus ? ACTION_CFG[order.status] : null
              const accent     = STATUS_ACCENT[order.status] ?? '#a78bfa'
              const isBusy     = statusChanging === order.id
              const stale      = isStaleOrder(order, now)
              const dispItems  = order.order_items && order.order_items.length > 0
                ? order.order_items
                : order.gamepasses
                  ? [{ gamepass_name: order.gamepasses.name }]
                  : []
              const itemGroups = groupOrderItems(order)

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.18 }}
                  className="relative order-row-shimmer group cursor-pointer"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.068)' }}
                  onClick={() => setInspectOrder(order)}
                >
                  {/* Left accent */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[2px]"
                    style={{ background: accent }}
                  />

                  <div className="pl-4 pr-3 py-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold" style={{ color: '#22d3ee' }}>
                          {order.order_number ?? '—'}
                        </span>
                        <StatusBadge status={order.status} />
                        {stale && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.20)' }}
                          >
                            Stale
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(order) }}
                          className="w-6 h-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={isBusy}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            {order.status !== 'refunded' && (
                              <DropdownMenuItem onClick={() => onStatusChange(order, 'refunded')} className="gap-2 text-xs cursor-pointer text-amber-400 focus:text-amber-400">
                                <X className="w-3.5 h-3.5" /> Mark Refunded
                              </DropdownMenuItem>
                            )}
                            {order.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => onStatusChange(order, 'cancelled')} className="gap-2 text-xs cursor-pointer text-slate-400 focus:text-slate-400">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-border/50" />
                            <DropdownMenuItem onClick={() => onDelete(order)} className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Buyer */}
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'oklch(0.095 0.032 272)' }}>
                      {order.buyer_name || (
                        <span style={{ color: 'rgba(255,255,255,0.50)', fontStyle: 'italic', fontWeight: 400, fontSize: '11px' }}>
                          No buyer name
                        </span>
                      )}
                    </p>

                    {/* Gamepass name */}
                    {dispItems.length > 0 && (
                      <p className="text-[11px] truncate mt-0.5 mb-2.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                        {dispItems[0].gamepass_name}
                        {dispItems.length > 1 && (
                          <span style={{ color: '#22d3ee' }}> +{dispItems.length - 1}</span>
                        )}
                      </p>
                    )}

                    {/* Price + action button */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: 'oklch(0.095 0.032 272)' }}>
                        {order.selling_price ? formatPHP(order.selling_price) : '—'}
                      </span>
                      {action && nextStatus && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onStatusChange(order, nextStatus) }}
                          disabled={isBusy}
                          className="h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-40 flex-shrink-0"
                          style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}` }}
                        >
                          {isBusy
                            ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            : action.label}
                        </button>
                      )}
                    </div>

                    {/* Hover preview — quick inspection without opening the dialog */}
                    <div className="max-h-0 group-hover:max-h-40 overflow-hidden transition-all duration-200 ease-out">
                      <div className="mt-2.5 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.092)' }}>
                        {itemGroups.slice(0, 3).map((g, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>
                              {g.gamepass_name}
                              <span style={{ color: 'rgba(255,255,255,0.44)' }}> ×{g.count}</span>
                            </span>
                            <span className="font-semibold tabular-nums flex-shrink-0" style={{ color: 'oklch(0.30 0.020 270)' }}>
                              {formatPHP(g.subtotal)}
                            </span>
                          </div>
                        ))}
                        {itemGroups.length > 3 && (
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            +{itemGroups.length - 3} more item{itemGroups.length - 3 > 1 ? 's' : ''}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span style={{ color: 'rgba(255,255,255,0.44)' }}>Account</span>
                          <span className="font-semibold truncate" style={{ color: 'oklch(0.30 0.020 270)' }}>
                            {order.roblox_accounts?.username ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span style={{ color: 'rgba(255,255,255,0.44)' }}>Total</span>
                          <span className="font-bold tabular-nums" style={{ color: 'oklch(0.095 0.032 272)' }}>
                            {formatRobux(order.robux_amount ?? 0)} · {formatPHP(order.selling_price ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* History */}
      {!loading && (
        <div className="glass-secondary overflow-hidden">
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
                <div style={{ maxHeight: '420px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                  {historyOrders.length === 0 ? (
                    <p className="text-center text-[12px] py-6" style={{ color: 'oklch(0.62 0.010 265)' }}>
                      No history yet
                    </p>
                  ) : (
                    <>
                      {historyOrders.slice(0, 40).map((order) => {
                        const oi = order.order_items ?? []
                        return (
                          <div
                            key={order.id}
                            className="flex items-center gap-2.5 px-4 py-2.5 group order-row-shimmer transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.065)' }}
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
                              <p className="text-[12px] font-bold" style={{ color: 'oklch(0.095 0.032 272)' }}>
                                {order.selling_price ? formatPHP(order.selling_price) : '—'}
                              </p>
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <button
                              onClick={() => onEdit(order)}
                              className="w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-all flex-shrink-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
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
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <OrderInspectDialog
        order={inspectOrder}
        onClose={() => setInspectOrder(null)}
        onEdit={onEdit}
      />
    </div>
  )
}
