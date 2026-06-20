'use client'

import { useState } from 'react'
import { RobloxAccount } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatRobux } from '@/lib/utils/pricing'

interface ReserveTransferDialogProps {
  open: boolean
  account: RobloxAccount | null
  /** Remaining allowance for this account right now — caps the amount field. */
  available: number
  onClose: () => void
  onSubmit: (data: { amount: number; customerLabel?: string; note?: string; scheduledFor?: string }) => Promise<void>
}

interface FormState {
  amount: string
  customerLabel: string
  note: string
  scheduledFor: string
  submitting: boolean
}

const EMPTY_FORM: FormState = { amount: '', customerLabel: '', note: '', scheduledFor: '', submitting: false }

export default function ReserveTransferDialog({ open, account, available, onClose, onSubmit }: ReserveTransferDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // Reset the form when the dialog transitions closed -> open. Done during
  // render (React's documented "adjusting state when a prop changes"
  // pattern) rather than in a useEffect, so it doesn't cost an extra render pass.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(EMPTY_FORM)
  }

  const parsedAmount = Number(form.amount)
  const isValid = form.amount !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= available

  async function handleSubmit() {
    if (!isValid) return
    setForm(prev => ({ ...prev, submitting: true }))
    await onSubmit({
      amount: parsedAmount,
      customerLabel: form.customerLabel.trim() || undefined,
      note: form.note.trim() || undefined,
      scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
    })
    setForm(prev => ({ ...prev, submitting: false }))
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve Transfer Allowance{account ? ` — ${account.username}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reserve-amount">Amount (R$)</Label>
            <Input
              id="reserve-amount"
              type="number"
              min={1}
              max={available}
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder={`Up to ${formatRobux(available)} available`}
            />
            {form.amount !== '' && parsedAmount > available && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>
                Exceeds the {formatRobux(available)} still available today.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reserve-customer">Customer / Order (optional)</Label>
            <Input
              id="reserve-customer"
              value={form.customerLabel}
              onChange={e => setForm(prev => ({ ...prev, customerLabel: e.target.value }))}
              placeholder="Order #1023, or a customer name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reserve-when">Scheduled for (optional)</Label>
            <Input
              id="reserve-when"
              type="datetime-local"
              value={form.scheduledFor}
              onChange={e => setForm(prev => ({ ...prev, scheduledFor: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reserve-note">Note (optional)</Label>
            <Textarea
              id="reserve-note"
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Anything worth remembering about this reservation"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={form.submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || form.submitting}>
            {form.submitting ? 'Reserving…' : 'Reserve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
