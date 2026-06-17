'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RobloxAccount } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import { formatPHP } from '@/lib/utils/pricing'

const schema = z.object({
  username:        z.string().min(1, 'Username required'),
  current_robux:   z.number().min(0),
  reserved_robux:  z.number().min(0),
  robux_cost_rate: z.number().min(0),
  status:          z.enum(['active', 'inactive', 'banned', 'low']),
  notes:           z.string().optional(),
  roblox_profile:  z.string().optional(),
  purchase_cost:   z.number().min(0).optional(),
  supplier:        z.string().optional(),
  purchase_date:   z.string().optional(),
})

type FormData = z.infer<typeof schema>

type AdjustableField = 'current_robux' | 'reserved_robux' | 'robux_cost_rate'

const ADJUST_FIELD_LABELS: Record<AdjustableField, string> = {
  current_robux:   'Current Robux',
  reserved_robux:  'Reserved Robux',
  robux_cost_rate: 'Cost Rate (PHP / 1,000 R$)',
}

// Accepts a full profile URL (roblox.com/users/123456/profile) or a bare numeric ID
export function parseRobloxUserId(input?: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/users\/(\d+)/)
  return match ? match[1] : null
}

interface AccountModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
  onAdjust?: (field: AdjustableField, newValue: number, reason: string) => Promise<void>
  account?: RobloxAccount | null
  loading?: boolean
}

export default function AccountModal({ open, onClose, onSave, onAdjust, account, loading }: AccountModalProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '', current_robux: 0, reserved_robux: 0,
      robux_cost_rate: 0, status: 'active', notes: '', roblox_profile: '',
      purchase_cost: 0, supplier: '', purchase_date: '',
    }
  })

  // ── Account Adjustment (audited correction of read-only inventory fields) ──
  const [adjustField, setAdjustField]   = useState<AdjustableField>('current_robux')
  const [adjustValue, setAdjustValue]   = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting]       = useState(false)
  const [adjustError, setAdjustError]   = useState<string | null>(null)

  useEffect(() => {
    if (account) {
      reset({
        username:        account.username,
        current_robux:   account.current_robux,
        reserved_robux:  account.reserved_robux,
        robux_cost_rate: account.robux_cost_rate ?? 0,
        status:          account.status,
        notes:           account.notes ?? '',
        roblox_profile:  account.roblox_user_id ?? '',
        purchase_cost:   0,
        supplier:        '',
        purchase_date:   '',
      })
    } else {
      reset({
        username: '', current_robux: 0, reserved_robux: 0, robux_cost_rate: 0, status: 'active', notes: '', roblox_profile: '',
        purchase_cost: 0, supplier: '', purchase_date: new Date().toISOString().slice(0, 10),
      })
    }
    setAdjustField('current_robux')
    setAdjustValue('')
    setAdjustReason('')
    setAdjustError(null)
  }, [account, reset])

  const currentAdjustValue = account
    ? adjustField === 'robux_cost_rate' ? (account.robux_cost_rate ?? 0) : account[adjustField]
    : 0

  async function handleApplyAdjustment() {
    if (!account || !onAdjust) return
    const newValue = Number(adjustValue)
    if (adjustValue.trim() === '' || !Number.isFinite(newValue) || newValue < 0) {
      setAdjustError('Enter a valid, non-negative number')
      return
    }
    if (!adjustReason.trim()) {
      setAdjustError('A reason is required')
      return
    }
    setAdjusting(true)
    setAdjustError(null)
    try {
      await onAdjust(adjustField, newValue, adjustReason.trim())
      setAdjustValue('')
      setAdjustReason('')
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to apply adjustment')
    } finally {
      setAdjusting(false)
    }
  }

  const statusValue = watch('status')
  const usernameValue = watch('username')
  const profileValue = watch('roblox_profile')
  const previewUserId = parseRobloxUserId(profileValue)
  const purchaseCostValue = watch('purchase_cost') ?? 0
  const currentRobuxValue = watch('current_robux') ?? 0
  const derivedRate = currentRobuxValue > 0 ? (purchaseCostValue / currentRobuxValue) * 1000 : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-elevated sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Roblox Account'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Roblox Username</Label>
            <Input {...register('username')} placeholder="e.g. SellerAccount1" className="bg-input" />
            {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-2">
              Profile Picture Override
              <span
                className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(34,211,238,0.08)', color: 'rgba(34,211,238,0.70)' }}
              >
                optional
              </span>
            </Label>
            <div className="flex items-center gap-3">
              <RobloxAvatar
                username={usernameValue || '?'}
                userId={previewUserId}
                size={40}
              />
              <Input
                {...register('roblox_profile')}
                placeholder="https://www.roblox.com/users/123456/profile"
                className="bg-input flex-1"
              />
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {profileValue && !previewUserId
                ? 'Could not find a user ID in that link — paste the full profile URL or just the numeric ID'
                : 'The avatar is looked up automatically from the username on save — only fill this in if you need to point at a different profile'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Robux</Label>
              {account ? (
                <Input value={account.current_robux} disabled className="bg-input opacity-60" />
              ) : (
                <Input {...register('current_robux', { valueAsNumber: true })} type="number" className="bg-input" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reserved Robux</Label>
              {account ? (
                <Input value={account.reserved_robux} disabled className="bg-input opacity-60" />
              ) : (
                <Input {...register('reserved_robux', { valueAsNumber: true })} type="number" className="bg-input" />
              )}
            </div>
          </div>
          {account && (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
              These values are read-only — use Record Adjustment below to change them with an audit trail.
            </p>
          )}

          {/* Stock purchase — new accounts only, auto-generates a Capital Event */}
          {!account && (
            <div className="space-y-3 rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.16)' }}>
              <Label className="text-xs flex items-center gap-2">
                Stock Purchase
                <span
                  className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.10)', color: '#047857' }}
                >
                  auto-records a Capital Event
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase Cost (₱)</Label>
                  <Input {...register('purchase_cost', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="e.g. 1035" className="bg-input" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase Date</Label>
                  <Input {...register('purchase_date')} type="date" className="bg-input" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Supplier (optional)</Label>
                <Input {...register('supplier')} placeholder="e.g. JuanDeals" className="bg-input" />
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
                {purchaseCostValue > 0
                  ? `Robux Cost Rate will be set to ${formatPHP(derivedRate)} per 1,000 R$, and this purchase will be recorded in the Capital Events Ledger.`
                  : 'Leave blank if this account isn’t a new supplier purchase — no Capital Event will be recorded.'}
              </p>
            </div>
          )}

          {/* Cost rate */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-2">
              Robux Cost Rate (PHP / 1,000 R$)
              <span
                className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.08)', color: 'rgba(167,139,250,0.70)' }}
              >
                cost basis
              </span>
            </Label>
            {account ? (
              <Input value={account.robux_cost_rate ?? 0} disabled className="bg-input opacity-60" />
            ) : (
              <Input
                {...register('robux_cost_rate', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 240"
                className="bg-input"
                disabled={purchaseCostValue > 0}
              />
            )}
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {account
                ? 'Read-only — use Record Adjustment below to change this with an audit trail.'
                : purchaseCostValue > 0
                  ? 'Calculated automatically from Purchase Cost above'
                  : 'How much PHP you paid per 1,000 Robux on this account'}
            </p>
          </div>

          {/* Record Adjustment — audited correction of read-only inventory fields */}
          {account && onAdjust && (
            <div className="space-y-3 rounded-xl p-3.5" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.16)' }}>
              <Label className="text-xs flex items-center gap-2">
                Record Adjustment
                <span
                  className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}
                >
                  audited correction
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Field</Label>
                  <Select value={adjustField} onValueChange={(v) => setAdjustField(v as AdjustableField)}>
                    <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="current_robux">Current Robux</SelectItem>
                      <SelectItem value="reserved_robux">Reserved Robux</SelectItem>
                      <SelectItem value="robux_cost_rate">Cost Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Value</Label>
                  <Input
                    type="number"
                    step={adjustField === 'robux_cost_rate' ? '0.01' : '1'}
                    min="0"
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                    placeholder={`Current: ${currentAdjustValue}`}
                    className="bg-input"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason (required)</Label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Correcting after manual Roblox trade"
                  className="bg-input"
                />
              </div>
              {adjustError && <p className="text-xs text-red-400">{adjustError}</p>}
              <Button
                type="button"
                variant="outline"
                disabled={adjusting}
                onClick={handleApplyAdjustment}
                className="w-full border-border"
              >
                {adjusting ? 'Applying...' : `Apply Adjustment to ${ADJUST_FIELD_LABELS[adjustField]}`}
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusValue} onValueChange={(v) => setValue('status', (v ?? 'active') as FormData['status'])}>
              <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="low">Low Balance</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea {...register('notes')} placeholder="Any notes about this account..." className="bg-input resize-none h-20" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? 'Saving...' : account ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
