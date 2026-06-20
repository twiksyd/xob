'use client'

import { useState } from 'react'
import { RobloxAccount, TransferLog } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface LogTransferDialogProps {
  open: boolean
  account: RobloxAccount | null
  /** Present when correcting an existing entry; absent when logging a new one. */
  editingLog?: TransferLog | null
  onClose: () => void
  onSubmit: (data: { amount: number; sentAt: string; note?: string }) => Promise<void>
}

interface FormState {
  amount: string
  sentAt: string
  note: string
  submitting: boolean
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyForm(editingLog?: TransferLog | null): FormState {
  return {
    amount: editingLog ? String(editingLog.amount) : '',
    sentAt: toDatetimeLocalValue(editingLog ? new Date(editingLog.sent_at) : new Date()),
    note: editingLog?.note ?? '',
    submitting: false,
  }
}

export default function LogTransferDialog({ open, account, editingLog, onClose, onSubmit }: LogTransferDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(editingLog))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(emptyForm(editingLog))
  }

  const parsedAmount = Number(form.amount)
  const isValid = form.amount !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && form.sentAt !== ''

  async function handleSubmit() {
    if (!isValid) return
    setForm(prev => ({ ...prev, submitting: true }))
    await onSubmit({
      amount: parsedAmount,
      sentAt: new Date(form.sentAt).toISOString(),
      note: form.note.trim() || undefined,
    })
    setForm(prev => ({ ...prev, submitting: false }))
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingLog ? 'Edit Transfer' : 'Log a Transfer'}{account ? ` — ${account.username}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
            {editingLog
              ? 'Correct the amount, time, or note for this entry.'
              : 'Record a transfer that already happened — earlier today, or backfilling a past day.'}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="log-amount">Amount (R$)</Label>
            <Input
              id="log-amount"
              type="number"
              min={1}
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="e.g. 200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-when">When it was sent</Label>
            <Input
              id="log-when"
              type="datetime-local"
              value={form.sentAt}
              onChange={e => setForm(prev => ({ ...prev, sentAt: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-note">Note (optional)</Label>
            <Textarea
              id="log-note"
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="e.g. Forgot to log, sent directly in Roblox"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={form.submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || form.submitting}>
            {form.submitting ? 'Saving…' : editingLog ? 'Save Changes' : 'Log Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
