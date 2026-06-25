'use client'

import { useEffect, useRef } from 'react'
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Trash2, X, CheckCircle2, ArrowRight } from 'lucide-react'
import GamepassCatalog from '@/components/orders/GamepassCatalog'
import AccountSelector from '@/components/inventory/AccountSelector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Gamepass, Game, RobloxAccount, OrderWithDetails } from '@/lib/types/database'
import { formatRobux, formatPHP, OrderTotals } from '@/lib/utils/pricing'
import { rankAccountsForOrder } from '@/lib/utils/accounts'
import { getGameNameStyle } from '@/lib/utils/games'
import { CartGroup } from '@/hooks/useOrderCart'

export type GamepassWithGame = Gamepass & { games: Game | null }

export const orderFormSchema = z.object({
  buyer_name:            z.string().optional(),
  buyer_roblox_username: z.string().optional(),
  roblox_account_id:     z.string().min(1, 'Select an account'),
  payment_method:        z.enum(['GCash', 'Maya', 'Bank', 'Cash', 'Other']),
  status:                z.enum(['pending', 'paid', 'completed', 'refunded', 'cancelled']),
  notes:                 z.string().optional(),
})
export type OrderFormData = z.infer<typeof orderFormSchema>

interface OrderFormProps {
  register: UseFormRegister<OrderFormData>
  watch: UseFormWatch<OrderFormData>
  setValue: UseFormSetValue<OrderFormData>
  errors: FieldErrors<OrderFormData>
  onFormSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>

  isEditMode: boolean
  editOrder: OrderWithDetails | null
  onCancelEdit: () => void

  gamepasses: GamepassWithGame[]
  accounts: RobloxAccount[]

  cartGroups: CartGroup[]
  cartCounts: Map<string, number>
  validItemsCount: number
  onAddToCart: (gamepassId: string) => void
  onRemoveFromCart: (gamepassId: string) => void
  onClearCart: () => void

  totals: OrderTotals
  accountRate: number

  saving: boolean
  justCreated: boolean
}

function Divider() {
  return <div className="section-divider" />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>
}

export default function OrderForm({
  register, watch, setValue, errors, onFormSubmit,
  isEditMode, editOrder, onCancelEdit,
  gamepasses, accounts,
  cartGroups, cartCounts, validItemsCount, onAddToCart, onRemoveFromCart, onClearCart,
  totals, accountRate,
  saving, justCreated,
}: OrderFormProps) {
  const accountId = watch('roblox_account_id')
  const payMethod = watch('payment_method')
  const statusVal = watch('status')

  // Auto-pick the best-fit account the moment the cart goes from empty to non-empty,
  // if nothing's been chosen yet — saves a click on the common path without ever
  // overriding a deliberate manual pick.
  const prevValidCount = useRef(0)
  useEffect(() => {
    if (prevValidCount.current === 0 && validItemsCount > 0 && !accountId) {
      const best = rankAccountsForOrder(accounts, totals.totalRobux).find(a => a.canAfford)
      if (best) setValue('roblox_account_id', best.id, { shouldValidate: true })
    }
    prevValidCount.current = validItemsCount
  }, [validItemsCount, accountId, accounts, totals.totalRobux, setValue])

  return (
    <div className="glass-workspace overflow-hidden">

      {/* Panel header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(139,92,246,0.022) 0%, transparent 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(139,92,246,0.11), inset 0 -1px 0 rgba(34,211,238,0.07)',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isEditMode ? 'edit' : 'new'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-[14px] font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {isEditMode ? 'Edit Order' : 'Create Order'}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
              {isEditMode
                ? `${editOrder?.order_number ?? '—'} · ${editOrder?.buyer_name ?? 'No buyer name'}`
                : 'Resets after submit — ready for the next order immediately'}
            </p>
          </motion.div>
        </AnimatePresence>

        {isEditMode && (
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'rgba(255,255,255,0.065)', color: 'rgba(255,255,255,0.47)', border: '1px solid rgba(255,255,255,0.110)' }}
          >
            <X className="w-3 h-3" /> Cancel Edit
          </button>
        )}
      </div>

      {/* Form body */}
      <form onSubmit={onFormSubmit} className="p-6 space-y-6 form-stagger">

        {/* ── Buyer ── */}
        <div className="form-section" style={{ animationDelay: '0.04s' }}>
          <SectionLabel>Buyer</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Name / GCash Name
              </Label>
              <Input
                {...register('buyer_name')}
                placeholder="John Doe"
                className="bg-input h-9 text-[13px]"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Roblox Username
              </Label>
              <Input
                {...register('buyer_roblox_username')}
                placeholder="JohnDoe123"
                className="bg-input h-9 text-[13px]"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Gamepasses — click-to-add catalog ── */}
        <div className="form-section" style={{ animationDelay: '0.09s' }}>
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel>Gamepasses</SectionLabel>
            {validItemsCount > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="flex items-center gap-1 text-[10px] font-semibold transition-colors hover:text-red-400"
                style={{ color: 'rgba(255,255,255,0.44)' }}
              >
                <Trash2 className="w-3 h-3" /> Clear ({validItemsCount})
              </button>
            )}
          </div>

          <GamepassCatalog gamepasses={gamepasses} cartCounts={cartCounts} onAdd={onAddToCart} onRemove={onRemoveFromCart} />

          {/* Cart — grouped line items with quantity steppers */}
          {cartGroups.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {cartGroups.map(g => {
                // Resolved live (not from the cart's own game_name snapshot) so
                // the discount badge always reflects the game's current status.
                const isDiscounted = gamepasses.find(gp => gp.id === g.gamepass_id)?.games?.is_discounted
                return (
                <div
                  key={g.gamepass_id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.072)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {g.gamepass_name}
                    </p>
                    <p className="text-[10px] truncate">
                      <span style={getGameNameStyle(isDiscounted)}>{g.game_name ?? '—'}</span>
                      <span style={{ color: 'rgba(255,255,255,0.48)' }}> · {formatRobux(g.robux_amount)} · {formatPHP(g.selling_price)} each</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(g.gamepass_id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(255,255,255,0.082)', color: 'rgba(255,255,255,0.47)' }}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-[12px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {g.count}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddToCart(g.gamepass_id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(139,92,246,0.10)', color: 'oklch(0.50 0.090 280)' }}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span
                    className="text-[12px] font-bold tabular-nums flex-shrink-0 text-right"
                    style={{ color: 'rgba(255,255,255,0.88)', minWidth: '64px' }}
                  >
                    {formatPHP(g.selling_price * g.count)}
                  </span>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Totals preview — always show when any item has a gamepass */}
        {validItemsCount > 0 && (
          <div className="space-y-2">
            <div className="totals-bar grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.44)' }}>Total Robux</p>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {formatRobux(totals.totalRobux)}
                </p>
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.44)' }}>Total Price</p>
                <p className="text-[14px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {formatPHP(totals.totalPrice)}
                </p>
              </div>
              <div>
                <p className="text-[10px] mb-1 text-emerald-500/70">Net Profit</p>
                <p className="text-[14px] font-bold text-emerald-600">{formatPHP(totals.totalProfit)}</p>
              </div>
            </div>
            {/* Cost basis detail line */}
            {accountRate > 0 && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px]"
                style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.14)' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.47)' }}>
                  Rate: {formatPHP(accountRate)}/1k R$ · Cost: {formatPHP(totals.totalCost)}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.47)' }}>
                  Gross {formatPHP(totals.totalPrice)} − Cost {formatPHP(totals.totalCost)} = <span style={{ color: '#34d399', fontWeight: 700 }}>{formatPHP(totals.totalProfit)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* ── Account ── */}
        <div className="form-section" style={{ animationDelay: '0.14s' }}>
          <SectionLabel>Account</SectionLabel>
          <AccountSelector
            accounts={accounts}
            robuxRequired={totals.totalRobux}
            selectedId={accountId}
            onSelect={id => setValue('roblox_account_id', id, { shouldValidate: true })}
          />
          {errors.roblox_account_id && (
            <p className="text-xs text-red-400 mt-1.5">{errors.roblox_account_id.message}</p>
          )}
        </div>

        <Divider />

        {/* ── Order details ── */}
        <div className="form-section" style={{ animationDelay: '0.19s' }}>
          <SectionLabel>Order Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Payment Method
              </Label>
              <Select value={payMethod} onValueChange={v => setValue('payment_method', (v ?? 'GCash') as OrderFormData['payment_method'])}>
                <SelectTrigger className="bg-input h-9 text-[13px]">
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
              <Label className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                Status
              </Label>
              <Select value={statusVal} onValueChange={v => setValue('status', (v ?? 'pending') as OrderFormData['status'])}>
                <SelectTrigger className="bg-input h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {/* Refunded/cancelled only make sense for an order that already exists */}
                  {(isEditMode
                    ? ['pending', 'paid', 'completed', 'refunded', 'cancelled']
                    : ['pending', 'paid', 'completed']
                  ).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="form-section pt-1" style={{ animationDelay: '0.24s' }}>
          <div className="submit-glow-wrap">
          <AnimatePresence mode="wait">
            {justCreated ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-bold"
                style={{
                  background: 'rgba(52,211,153,0.11)',
                  border: '1px solid rgba(52,211,153,0.28)',
                  color: '#047857',
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Order created — ready for next
              </motion.div>
            ) : (
              <motion.button
                key="submit"
                type="submit"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                disabled={saving || validItemsCount === 0}
                className="btn-primary w-full h-11 text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isEditMode ? 'Save Changes' : 'Create Order'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            )}
          </AnimatePresence>
          </div>
          {!isEditMode && (
            <p className="text-center text-[11px] mt-2" style={{ color: 'oklch(0.64 0.010 265)' }}>
              Form resets automatically — no need to reopen
            </p>
          )}
        </div>

      </form>
    </div>
  )
}
