'use client'

import { useState } from 'react'
import { InstantSendPriceTier } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'
import { formatPHP } from '@/lib/utils/pricing'

export interface DefaultPriceTier {
  robux_amount: number
  price: number
  profit: number
  status: string
}

interface PriceTierManagerProps {
  open: boolean
  tiers: InstantSendPriceTier[]
  onClose: () => void
  onAdd: (data: { robux_amount: number; price: number; profit: number; status?: string }) => Promise<void>
  onDelete: (id: string) => void
  onLoadDefaults: (missing: DefaultPriceTier[]) => void
}

export const DEFAULT_TIERS: DefaultPriceTier[] = [
  { robux_amount: 100,  price: 45,  profit: 32.89,  status: 'Okay' },
  { robux_amount: 200,  price: 85,  profit: 65.78,  status: 'Okay' },
  { robux_amount: 300,  price: 130, profit: 98.67,  status: 'Good' },
  { robux_amount: 400,  price: 170, profit: 131.56, status: 'Good' },
  { robux_amount: 500,  price: 210, profit: 164.45, status: 'Good' },
  { robux_amount: 600,  price: 255, profit: 197.34, status: 'Good' },
  { robux_amount: 800,  price: 310, profit: 262.89, status: 'Good' },
  { robux_amount: 1000, price: 410, profit: 328.67, status: 'Good' },
]

export default function PriceTierManager({ open, tiers, onClose, onAdd, onDelete, onLoadDefaults }: PriceTierManagerProps) {
  const [form, setForm] = useState({ robux_amount: '', price: '', profit: '', status: '' })
  const [adding, setAdding] = useState(false)

  const sorted = [...tiers].sort((a, b) => a.robux_amount - b.robux_amount)
  const missingDefaults = DEFAULT_TIERS.filter(d => !tiers.some(t => t.robux_amount === d.robux_amount))

  async function handleAdd() {
    const amount = Number(form.robux_amount)
    const price = Number(form.price)
    const profit = Number(form.profit)
    if (!(amount > 0) || !(price >= 0) || !Number.isFinite(profit)) return
    setAdding(true)
    await onAdd({ robux_amount: amount, price, profit, status: form.status.trim() || undefined })
    setForm({ robux_amount: '', price: '', profit: '', status: '' })
    setAdding(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Instant Send Pricing</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Each row is a tier the sale decomposer can use to break a total (e.g. 700 = 500 + 200) into priced chunks.
          </p>

          {missingDefaults.length > 0 && (
            <button
              type="button"
              onClick={() => onLoadDefaults(missingDefaults)}
              className="text-[12px] font-semibold underline"
              style={{ color: '#22d3ee' }}
            >
              Load {missingDefaults.length} missing default tier{missingDefaults.length !== 1 ? 's' : ''}
            </button>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.090)' }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.045)' }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>R$</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Price</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Profit</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.060)' }}>
                    <td className="px-3 py-2 font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.robux_amount}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'rgba(255,255,255,0.70)' }}>{formatPHP(t.price)}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: '#34d399' }}>{formatPHP(t.profit)}</td>
                    <td className="px-3 py-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{t.status || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => onDelete(t.id)} style={{ color: '#f87171' }} title="Delete tier">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'rgba(255,255,255,0.40)' }}>No tiers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="tier-amount" className="text-[11px]">R$</Label>
              <Input id="tier-amount" type="number" min={1} value={form.robux_amount} onChange={e => setForm(p => ({ ...p, robux_amount: e.target.value }))} placeholder="700" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier-price" className="text-[11px]">Price</Label>
              <Input id="tier-price" type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="295" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier-profit" className="text-[11px]">Profit</Label>
              <Input id="tier-profit" type="number" step="0.01" value={form.profit} onChange={e => setForm(p => ({ ...p, profit: e.target.value }))} placeholder="230.23" />
            </div>
            <Button onClick={handleAdd} disabled={adding} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
