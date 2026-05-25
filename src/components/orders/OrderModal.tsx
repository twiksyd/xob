'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Order, Gamepass, Game, RobloxAccount, OrderItem, LineItem } from '@/lib/types/database'
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
import GamepassPicker from '@/components/orders/GamepassPicker'
import { Plus, X } from 'lucide-react'

type GamepassWithGame = Gamepass & { games: Game | null }

const schema = z.object({
  buyer_name: z.string().optional(),
  buyer_roblox_username: z.string().optional(),
  roblox_account_id: z.string().min(1, 'Select an account'),
  payment_method: z.enum(['GCash', 'Maya', 'Bank', 'Cash', 'Other']),
  status: z.enum(['pending', 'paid', 'completed', 'refunded', 'cancelled']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface OrderModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData, items: LineItem[]) => Promise<void>
  order?: (Order & { order_items?: OrderItem[] }) | null
  gamepasses: GamepassWithGame[]
  accounts: RobloxAccount[]
  loading?: boolean
}

function mkItem(): LineItem {
  return {
    _key: Math.random().toString(36).slice(2),
    gamepass_id: '', gamepass_name: '', game_name: null,
    robux_amount: 0, selling_price: 0, cost: 0, profit: 0,
  }
}

export default function OrderModal({ open, onClose, onSave, order, gamepasses, accounts, loading }: OrderModalProps) {
  const [items, setItems] = useState<LineItem[]>([mkItem()])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyer_name: '', buyer_roblox_username: '', roblox_account_id: '',
      payment_method: 'GCash', status: 'pending', notes: ''
    }
  })

  const accountId = watch('roblox_account_id')
  const totalRobux = items.reduce((s, i) => s + i.robux_amount, 0)
  const totalPrice = items.reduce((s, i) => s + i.selling_price, 0)
  const totalProfit = items.reduce((s, i) => s + i.profit, 0)
  const validItems = items.filter(i => i.gamepass_id)

  useEffect(() => {
    if (order) {
      reset({
        buyer_name: order.buyer_name ?? '',
        buyer_roblox_username: order.buyer_roblox_username ?? '',
        roblox_account_id: order.roblox_account_id ?? '',
        payment_method: order.payment_method,
        status: (order.status === 'delivering' ? 'paid' : order.status) as any,
        notes: order.notes ?? '',
      })
      if (order.order_items && order.order_items.length > 0) {
        setItems(order.order_items.map(oi => ({
          _key: oi.id,
          gamepass_id: oi.gamepass_id ?? '',
          gamepass_name: oi.gamepass_name,
          game_name: oi.game_name,
          robux_amount: oi.robux_amount,
          selling_price: oi.selling_price,
          cost: oi.cost,
          profit: oi.profit,
        })))
      } else {
        setItems([{
          _key: 'legacy',
          gamepass_id: order.gamepass_id ?? '',
          gamepass_name: '',
          game_name: null,
          robux_amount: order.robux_amount ?? 0,
          selling_price: order.selling_price ?? 0,
          cost: order.cost ?? 0,
          profit: order.profit ?? 0,
        }])
      }
    } else {
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      setItems([mkItem()])
    }
  }, [order, reset])

  function updateItem(key: string, gamepass_id: string) {
    const gp = gamepasses.find(g => g.id === gamepass_id)
    setItems(prev => prev.map(item => item._key !== key ? item : {
      ...item,
      gamepass_id,
      gamepass_name: gp?.name ?? '',
      game_name: gp?.games?.name ?? null,
      robux_amount: gp?.robux_amount ?? 0,
      selling_price: gp?.your_price ?? 0,
      cost: gp?.your_cost ?? 0,
      profit: gp?.profit ?? 0,
    }))
  }

  async function onSubmit(data: FormData) {
    if (validItems.length === 0) return
    await onSave(data, validItems)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-elevated max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{order ? 'Edit Order' : 'New Order'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <form id="order-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">

            {/* Buyer info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  Buyer Name / GCash Name
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.08)', color: 'oklch(0.50 0.14 280)' }}>optional</span>
                </Label>
                <Input {...register('buyer_name')} placeholder="John Doe" className="bg-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Roblox Username</Label>
                <Input {...register('buyer_roblox_username')} placeholder="JohnDoe123" className="bg-input" />
              </div>
            </div>

            {/* Gamepass line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gamepasses</Label>
                {validItems.length > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {validItems.length} item{validItems.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item._key} className="group relative">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <GamepassPicker
                          gamepasses={gamepasses}
                          value={item.gamepass_id}
                          onChange={id => updateItem(item._key, id)}
                        />
                        {item.gamepass_id && (
                          <div className="mt-1.5 grid grid-cols-3 gap-1">
                            <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(15,13,42,0.025)' }}>
                              <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Robux</p>
                              <p className="text-[11px] font-bold tabular-nums" style={{ color: 'oklch(0.10 0.030 272)' }}>{item.robux_amount.toLocaleString()} R$</p>
                            </div>
                            <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(15,13,42,0.025)' }}>
                              <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Price</p>
                              <p className="text-[11px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>₱{item.selling_price}</p>
                            </div>
                            <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(52,211,153,0.08)' }}>
                              <p className="text-[10px] text-emerald-500/70">Profit</p>
                              <p className="text-[11px] font-bold text-emerald-600">₱{item.profit.toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItems(prev => prev.filter(i => i._key !== item._key))}
                          className="mt-1 w-7 h-7 flex-shrink-0 rounded-lg bg-secondary hover:bg-red-500/15 text-muted-foreground hover:text-red-400 flex items-center justify-center transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setItems(prev => [...prev, mkItem()])}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add another gamepass
              </button>
            </div>

            {/* Multi-item totals */}
            {validItems.length > 1 && (
              <div className="rounded-xl p-3 grid grid-cols-3 gap-2 text-center" style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)' }}>
                <div>
                  <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Total Robux</p>
                  <p className="text-[12px] font-bold tabular-nums" style={{ color: 'oklch(0.10 0.030 272)' }}>{totalRobux.toLocaleString()} R$</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Total Price</p>
                  <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>₱{totalPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500/70">Total Profit</p>
                  <p className="text-[12px] font-bold text-emerald-600">₱{totalProfit.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Account selector */}
            <div className="space-y-1.5">
              <AccountSelector
                accounts={accounts}
                robuxRequired={totalRobux}
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
                    {['pending', 'paid', 'completed', 'refunded', 'cancelled'].map(s => (
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
          <Button form="order-form" type="submit" disabled={loading || validItems.length === 0} className="bg-primary text-primary-foreground">
            {loading ? 'Saving...' : order ? 'Save Changes' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
