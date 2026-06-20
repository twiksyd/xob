'use client'

import { useState } from 'react'
import { RobloxAccount, InstantSendPriceTier } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPHP, formatRobux } from '@/lib/utils/pricing'
import { decomposeAmount } from '@/lib/utils/transfers'

interface LogInstantSendSaleDialogProps {
  open: boolean
  account: RobloxAccount | null
  tiers: InstantSendPriceTier[]
  onClose: () => void
  onSubmit: (data: { chunks: { amount: number; sentAt: string }[]; customerLabel?: string }) => Promise<void>
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface FormState {
  totalAmount: string
  customerLabel: string
  chunkDates: string[]
  submitting: boolean
}

const EMPTY_FORM: FormState = { totalAmount: '', customerLabel: '', chunkDates: [], submitting: false }

export default function LogInstantSendSaleDialog({ open, account, tiers, onClose, onSubmit }: LogInstantSendSaleDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(EMPTY_FORM)
  }

  const total = Number(form.totalAmount)
  const hasValidTotal = form.totalAmount !== '' && Number.isFinite(total) && total > 0
  const chunks = hasValidTotal ? decomposeAmount(total, tiers) : null
  const decomposeFailed = hasValidTotal && tiers.length > 0 && chunks === null
  const noTiers = tiers.length === 0

  // chunkDates is kept in sync with the current decomposition's length —
  // resized here (during render) rather than in an effect, since it's a
  // direct, synchronous response to a prop/derived-value change.
  if (chunks && chunks.length !== form.chunkDates.length) {
    const now = toDatetimeLocalValue(new Date())
    setForm(prev => ({ ...prev, chunkDates: chunks.map((_, i) => prev.chunkDates[i] ?? now) }))
  }

  const totalPrice  = chunks ? chunks.reduce((s, c) => s + c.price, 0) : 0
  const totalProfit = chunks ? chunks.reduce((s, c) => s + c.profit, 0) : 0
  const isValid = chunks !== null && chunks.length > 0 && form.chunkDates.every(d => d !== '')

  async function handleSubmit() {
    if (!chunks || !isValid) return
    setForm(prev => ({ ...prev, submitting: true }))
    await onSubmit({
      chunks: chunks.map((c, i) => ({ amount: c.robux_amount, sentAt: new Date(form.chunkDates[i]).toISOString() })),
      customerLabel: form.customerLabel.trim() || undefined,
    })
    setForm(prev => ({ ...prev, submitting: false }))
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Instant Send Sale{account ? ` — ${account.username}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Enter the total a customer is buying. It is broken into priced chunks if it does not match one tier exactly (e.g. 700 = 500 + 200), and credits the wallet once for the combined price.
          </p>

          {noTiers && (
            <p className="text-[12px] font-semibold" style={{ color: '#f87171' }}>
              No price tiers yet — add some in Manage Pricing first.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sale-amount">Total Robux Amount</Label>
            <Input
              id="sale-amount"
              type="number"
              min={1}
              value={form.totalAmount}
              onChange={e => setForm(prev => ({ ...prev, totalAmount: e.target.value, chunkDates: [] }))}
              placeholder="e.g. 700"
            />
            {decomposeFailed && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>
                No combination of your price tiers sums to {form.totalAmount} exactly.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sale-customer">Customer (optional)</Label>
            <Input
              id="sale-customer"
              value={form.customerLabel}
              onChange={e => setForm(prev => ({ ...prev, customerLabel: e.target.value }))}
              placeholder="Order #1023, or a customer name"
            />
          </div>

          {chunks && chunks.length > 0 && (
            <div className="space-y-2">
              <Label>Breakdown — date each chunk was/will be sent</Label>
              {chunks.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="flex-shrink-0 w-20 text-[12px] font-bold tabular-nums px-2 py-2 rounded-lg text-center"
                    style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.22)' }}
                  >
                    {formatRobux(c.robux_amount)}
                  </span>
                  <Input
                    type="datetime-local"
                    value={form.chunkDates[i] ?? ''}
                    onChange={e => setForm(prev => {
                      const next = [...prev.chunkDates]
                      next[i] = e.target.value
                      return { ...prev, chunkDates: next }
                    })}
                    className="flex-1"
                  />
                  <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.50)' }}>
                    {formatPHP(c.price)}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between text-[12px] font-bold pt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.80)' }}
              >
                <span>Total: {formatPHP(totalPrice)}</span>
                <span style={{ color: '#34d399' }}>Profit: {formatPHP(totalProfit)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={form.submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || form.submitting}>
            {form.submitting ? 'Saving…' : 'Log Sale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
