'use client'

import { useEffect } from 'react'
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

const schema = z.object({
  username:        z.string().min(1, 'Username required'),
  current_robux:   z.number().min(0),
  reserved_robux:  z.number().min(0),
  robux_cost_rate: z.number().min(0),
  status:          z.enum(['active', 'inactive', 'banned', 'low']),
  notes:           z.string().optional(),
  roblox_profile:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

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
  account?: RobloxAccount | null
  loading?: boolean
}

export default function AccountModal({ open, onClose, onSave, account, loading }: AccountModalProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '', current_robux: 0, reserved_robux: 0,
      robux_cost_rate: 0, status: 'active', notes: '', roblox_profile: '',
    }
  })

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
      })
    } else {
      reset({ username: '', current_robux: 0, reserved_robux: 0, robux_cost_rate: 0, status: 'active', notes: '', roblox_profile: '' })
    }
  }, [account, reset])

  const statusValue = watch('status')
  const usernameValue = watch('username')
  const profileValue = watch('roblox_profile')
  const previewUserId = parseRobloxUserId(profileValue)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-elevated max-w-md">
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
            <Label className="text-xs">Roblox Profile Link (optional)</Label>
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
            <p className="text-[11px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
              {profileValue && !previewUserId
                ? 'Could not find a user ID in that link — paste the full profile URL or just the numeric ID'
                : 'Paste the profile link (or numeric user ID) to show the account’s real Roblox avatar'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current Robux</Label>
              <Input {...register('current_robux', { valueAsNumber: true })} type="number" className="bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reserved Robux</Label>
              <Input {...register('reserved_robux', { valueAsNumber: true })} type="number" className="bg-input" />
            </div>
          </div>

          {/* Cost rate */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-2">
              Robux Cost Rate (PHP / 1,000 R$)
              <span
                className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.08)', color: 'oklch(0.50 0.14 280)' }}
              >
                cost basis
              </span>
            </Label>
            <Input
              {...register('robux_cost_rate', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 240"
              className="bg-input"
            />
            <p className="text-[11px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
              How much PHP you paid per 1,000 Robux on this account
            </p>
          </div>

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
