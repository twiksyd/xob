'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { Edit2, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/shared/StatusBadge'
import { OrderWithDetails } from '@/lib/types/database'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import { groupOrderItems } from '@/lib/utils/orders'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'

interface OrderInspectDialogProps {
  order: OrderWithDetails | null
  onClose: () => void
  onEdit: (order: OrderWithDetails) => void
}

export default function OrderInspectDialog({ order, onClose, onEdit }: OrderInspectDialogProps) {
  const items   = order ? groupOrderItems(order) : []
  const account = order?.roblox_accounts ?? null
  const profit  = order?.profit ?? 0

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        style={{
          background: '#ffffff',
          border: '1px solid #a78bfa',
        }}
      >
        <DialogClose
          render={
            <Button
              variant="outline"
              size="icon-sm"
              className="absolute top-2 right-2 border-slate-300"
            />
          }
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="font-mono text-[14px]" style={{ color: '#22d3ee' }}>
              {order?.order_number ?? 'Order Details'}
            </DialogTitle>
            {order && <StatusBadge status={order.status} className="border-slate-300" />}
          </div>
          {order && (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
              Created {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
              {' '}({formatDistanceToNow(new Date(order.created_at), { addSuffix: true })})
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Items */}
          <div className="space-y-2">
            <span className="label-caps">Items</span>
            <div className="glass-modal p-3 space-y-2.5 max-h-48 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>No items recorded</p>
              ) : items.map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {g.gamepass_name}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.44)' }}>
                      {g.game_name ? `${g.game_name} · ` : ''}{formatRobux(g.unit_robux)} ea
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.47)' }}>
                      ×{g.count} @ {formatPHP(g.unit_price)}
                    </p>
                    <p className="text-[12px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {formatPHP(g.subtotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <span className="label-caps">Fulfillment Account</span>
            {account ? (
              <div className="glass-modal p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {account.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge status={account.status} />
                    {isDepleted(account) && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.20)' }}
                      >
                        Low stock
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>Available</p>
                  <p className="text-[13px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {formatRobux(getAvailableRobux(account))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-modal p-3">
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>No account assigned</p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="glass-modal grid grid-cols-3 gap-2 text-center p-3.5">
            <div>
              <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.44)' }}>Total Robux</p>
              <p className="text-[14px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {formatRobux(order?.robux_amount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.44)' }}>Total PHP</p>
              <p className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {formatPHP(order?.selling_price ?? 0)}
              </p>
            </div>
            <div>
              <p className={`text-[10px] mb-1 ${profit >= 0 ? 'text-emerald-500/70' : 'text-red-400/70'}`}>Profit</p>
              <p className={`text-[14px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatPHP(profit)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {order && (
            <Button onClick={() => { onEdit(order); onClose() }} className="gap-1.5">
              <Edit2 className="w-3.5 h-3.5" /> Edit Order
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
