'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Order, Gamepass, Game, RobloxAccount } from '@/lib/types/database'
import AccountSelector from '@/components/inventory/AccountSelector'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

type GamepassWithGame = Gamepass & { games: Game | null }

const schema = z.object({
  buyer_name: z.string().min(1, 'Buyer name required'),
  buyer_roblox_username: z.string().optional(),
  gamepass_id: z.string().min(1, 'Select a gamepass'),
  roblox_account_id: z.string().min(1, 'Select an account'),
  payment_method: z.enum(['GCash', 'Maya', 'Bank', 'Cash', 'Other']),
  status: z.enum(['pending', 'paid', 'delivering', 'completed', 'refunded', 'cancelled']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface OrderModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData & { robux_amount?: number; selling_price?: number; cost?: number; profit?: number }) => Promise<void>
  order?: Order | null
  gamepasses: GamepassWithGame[]
  accounts: RobloxAccount[]
  loading?: boolean
}

export default function OrderModal({ open, onClose, onSave, order, gamepasses, accounts, loading }: OrderModalProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer_name: '', buyer_roblox_username: '', gamepass_id: '', roblox_account_id: '',
      payment_method: 'GCash', status: 'pending', notes: ''
    }
  })

  const gamepassId = watch('gamepass_id')
  const accountId = watch('roblox_account_id')

  const selectedGP = gamepasses.find(g => g.id === gamepassId)

  useEffect(() => {
    if (order) {
      reset({
        buyer_name: order.buyer_name ?? '',
        buyer_roblox_username: order.buyer_roblox_username ?? '',
        gamepass_id: order.gamepass_id ?? '',
        roblox_account_id: order.roblox_account_id ?? '',
        payment_method: order.payment_method,
        status: order.status,
        notes: order.notes ?? '',
      })
    } else {
      reset({ buyer_name: '', buyer_roblox_username: '', gamepass_id: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
    }
  }, [order, reset])

  async function onSubmit(data: FormData) {
    const extra = selectedGP ? {
      robux_amount: selectedGP.robux_amount,
      selling_price: selectedGP.your_price,
      cost: selectedGP.your_cost,
      profit: selectedGP.profit,
    } : {}
    await onSave({ ...data, ...extra })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{order ? 'Edit Order' : 'New Order'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <form id="order-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">
            {/* Buyer info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Buyer Name / GCash Name</Label>
                <Input {...register('buyer_name')} placeholder="e.g. John Doe" className="bg-input" />
                {errors.buyer_name && <p className="text-xs text-red-400">{errors.buyer_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Roblox Username</Label>
                <Input {...register('buyer_roblox_username')} placeholder="e.g. JohnDoe123" className="bg-input" />
              </div>
            </div>

            {/* Gamepass select */}
            <div className="space-y-1.5">
              <Label className="text-xs">Gamepass</Label>
              <Select value={gamepassId} onValueChange={v => setValue('gamepass_id', v ?? '')}>
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Select gamepass..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60">
                  {gamepasses.map(gp => (
                    <SelectItem key={gp.id} value={gp.id}>
                      <span className="text-xs">{gp.games?.name} — {gp.name} ({gp.robux_amount.toLocaleString()} R$ · ₱{gp.your_price})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gamepass_id && <p className="text-xs text-red-400">{errors.gamepass_id.message}</p>}
            </div>

            {/* Gamepass summary */}
            {selectedGP && (
              <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Robux</p>
                  <p className="text-xs font-bold text-foreground">{selectedGP.robux_amount.toLocaleString()} R$</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Price</p>
                  <p className="text-xs font-bold text-foreground">₱{selectedGP.your_price}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Profit</p>
                  <p className="text-xs font-bold text-emerald-400">₱{selectedGP.profit.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Account selector */}
            <div className="space-y-1.5">
              <AccountSelector
                accounts={accounts}
                robuxRequired={selectedGP?.robux_amount ?? 0}
                selectedId={accountId}
                onSelect={id => setValue('roblox_account_id', id)}
              />
              {errors.roblox_account_id && <p className="text-xs text-red-400">{errors.roblox_account_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={watch('payment_method')} onValueChange={v => setValue('payment_method', (v ?? 'GCash') as any)}>
                  <SelectTrigger className="bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {['GCash', 'Maya', 'Bank', 'Cash', 'Other'].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={watch('status')} onValueChange={v => setValue('status', (v ?? 'pending') as any)}>
                  <SelectTrigger className="bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {['pending', 'paid', 'delivering', 'completed', 'refunded', 'cancelled'].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea {...register('notes')} placeholder="Optional notes..." className="bg-input resize-none h-16" />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border/50">
          <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button form="order-form" type="submit" disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? 'Saving...' : order ? 'Save Changes' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
