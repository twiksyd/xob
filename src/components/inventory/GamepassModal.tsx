'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Gamepass, Game } from '@/lib/types/database'
import { computeGamepassFields, ROBUX_RATE } from '@/lib/utils/pricing'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import StatusBadge from '@/components/shared/StatusBadge'

const schema = z.object({
  game_id: z.string().min(1, 'Select a game'),
  name: z.string().min(1, 'Name required'),
  robux_amount: z.number().min(1),
  competitor_price: z.number().min(0),
  your_price: z.number().min(0),
  robux_rate: z.number().min(1),
  is_active: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface GamepassModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData & { your_cost: number; profit: number; status: 'Good' | 'Okay' | 'Bad'; suggested_lower_price: number }) => Promise<void>
  gamepass?: Gamepass | null
  games: Game[]
  loading?: boolean
}

export default function GamepassModal({ open, onClose, onSave, gamepass, games, loading }: GamepassModalProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      game_id: '', name: '', robux_amount: 0, competitor_price: 0, your_price: 0,
      robux_rate: ROBUX_RATE, is_active: true,
    }
  })

  const gameId = watch('game_id')
  const robuxAmount = watch('robux_amount') || 0
  const yourPrice = watch('your_price') || 0
  const competitorPrice = watch('competitor_price') || 0
  const rate = watch('robux_rate') || ROBUX_RATE

  const computed = computeGamepassFields(robuxAmount, yourPrice, competitorPrice, rate)

  useEffect(() => {
    if (gamepass) {
      reset({
        game_id: gamepass.game_id ?? '',
        name: gamepass.name,
        robux_amount: gamepass.robux_amount,
        competitor_price: gamepass.competitor_price,
        your_price: gamepass.your_price,
        robux_rate: gamepass.robux_rate,
        is_active: gamepass.is_active,
      })
    } else {
      reset({ game_id: '', name: '', robux_amount: 0, competitor_price: 0, your_price: 0, robux_rate: ROBUX_RATE, is_active: true })
    }
  }, [gamepass, reset])

  async function onSubmit(data: FormData) {
    const fields = computeGamepassFields(data.robux_amount, data.your_price, data.competitor_price, data.robux_rate)
    await onSave({ ...data, ...fields })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>{gamepass ? 'Edit Gamepass' : 'Add Gamepass'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Game</Label>
              <Select value={gameId} onValueChange={(v) => setValue('game_id', v ?? '')}>
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Select game..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {games.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.game_id && <p className="text-xs text-red-400">{errors.game_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gamepass Name</Label>
              <Input {...register('name')} placeholder="e.g. VIP" className="bg-input" />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Robux Amount</Label>
              <Input {...register('robux_amount', { valueAsNumber: true })} type="number" className="bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Competitor Price (₱)</Label>
              <Input {...register('competitor_price', { valueAsNumber: true })} type="number" step="0.01" className="bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Your Price (₱)</Label>
              <Input {...register('your_price', { valueAsNumber: true })} type="number" step="0.01" className="bg-input" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Robux Rate (₱ per 1000 R$)</Label>
            <Input {...register('robux_rate', { valueAsNumber: true })} type="number" step="1" className="bg-input w-40" />
          </div>

          {/* Live preview */}
          <div className="rounded-xl bg-secondary/50 p-4 space-y-2 border border-border/50">
            <p className="text-xs font-semibold text-foreground">Live Calculation Preview</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Your Cost</p>
                <p className="text-sm font-bold text-foreground">₱{computed.your_cost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Profit</p>
                <p className={`text-sm font-bold ${computed.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ₱{computed.profit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Status</p>
                <StatusBadge status={computed.status} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Suggested lower price: ₱{computed.suggested_lower_price.toFixed(0)}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? 'Saving...' : gamepass ? 'Save Changes' : 'Add Gamepass'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
