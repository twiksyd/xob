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

const schema = z.object({
  username: z.string().min(1, 'Username required'),
  current_robux: z.number().min(0),
  reserved_robux: z.number().min(0),
  status: z.enum(['active', 'inactive', 'banned', 'low']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

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
      username: '',
      current_robux: 0,
      reserved_robux: 0,
      status: 'active',
      notes: '',
    }
  })

  useEffect(() => {
    if (account) {
      reset({
        username: account.username,
        current_robux: account.current_robux,
        reserved_robux: account.reserved_robux,
        status: account.status,
        notes: account.notes ?? '',
      })
    } else {
      reset({ username: '', current_robux: 0, reserved_robux: 0, status: 'active', notes: '' })
    }
  }, [account, reset])

  const statusValue = watch('status')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Roblox Account'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Roblox Username</Label>
            <Input {...register('username')} placeholder="e.g. SellerAccount1" className="bg-input" />
            {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
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

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusValue} onValueChange={(v) => setValue('status', (v ?? 'active') as FormData['status'])}>
              <SelectTrigger className="bg-input">
                <SelectValue />
              </SelectTrigger>
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
