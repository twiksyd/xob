'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { OrderWithItems, RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import AccountBadgeRow from '@/components/shared/AccountBadgeRow'
import ChromeProfileBadge from '@/components/shared/ChromeProfileBadge'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

interface ReassignDialogProps {
  order: OrderWithItems | null
  currentAccount: RobloxAccount
  accounts: RobloxAccount[]
  onClose: () => void
  onSuccess: () => void
}

export default function ReassignDialog({ order, currentAccount, accounts, onClose, onSuccess }: ReassignDialogProps) {
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (order) {
      setTargetId('')
      setError(null)
    }
  }, [order])

  const otherAccounts = useMemo(
    () => accounts.filter(a => a.id !== currentAccount.id),
    [accounts, currentAccount.id]
  )

  const targetAccount = otherAccounts.find(a => a.id === targetId) ?? null
  const robuxAmount   = order?.robux_amount ?? 0
  const isCompleted   = order?.status === 'completed'

  async function handleConfirm() {
    if (!order || !targetId) return
    setLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('reassign_order_account', {
      p_order_id: order.id,
      p_new_account_id: targetId,
    })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onSuccess()
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Order</DialogTitle>
          <DialogDescription>
            Move {order?.order_number ? `order ${order.order_number}` : 'this order'} to a different account.
            {' '}{order?.robux_amount ? `${order.robux_amount.toLocaleString()} R$ will move with it.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="glass-secondary p-3">
            <p className="label-caps mb-1">Currently Assigned To</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {currentAccount.username}
              </p>
              <AccountBadgeRow account={currentAccount} />
              {currentAccount.chrome_profile && <ChromeProfileBadge profile={currentAccount.chrome_profile} />}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="label-caps">Reassign To</p>
            <Select value={targetId} onValueChange={v => setTargetId(v ?? '')}>
              <SelectTrigger className="w-full h-9 bg-input text-sm">
                <SelectValue placeholder="Select an account…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {otherAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-1.5">
                      {a.username}
                      <AccountBadgeRow account={a} />
                      {a.chrome_profile && <ChromeProfileBadge profile={a.chrome_profile} />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetAccount && robuxAmount > 0 && (
            <div className="glass-secondary p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-[12px]" style={{ color: 'oklch(0.30 0.020 270)' }}>
                  <span className="font-bold text-red-400">Remove {robuxAmount.toLocaleString()} R$</span>
                  {' '}from <span className="font-semibold">{currentAccount.username}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-[12px]" style={{ color: 'oklch(0.30 0.020 270)' }}>
                  <span className="font-bold text-emerald-500">Apply {robuxAmount.toLocaleString()} R$</span>
                  {' '}to <span className="font-semibold">{targetAccount.username}</span>
                </p>
              </div>
              <p className="text-[11px] pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.092)', color: 'rgba(255,255,255,0.44)' }}>
                {isCompleted
                  ? 'This order is completed — real Robux balances will move between accounts.'
                  : 'This order is still active — its Robux reservation will move to the new account.'}
              </p>
            </div>
          )}

          {targetAccount && robuxAmount === 0 && (
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
              This order has no Robux amount — only the order record will move to {targetAccount.username}.
            </p>
          )}

          {error && (
            <p className="text-[12px] font-semibold" style={{ color: '#f43f5e' }}>{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!targetId || loading}>
            {loading ? 'Reassigning…' : 'Confirm Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
