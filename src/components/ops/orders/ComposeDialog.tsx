'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import type { GamepassWithGame, LineItem, OrderWithDetails, RobloxAccount } from '@/lib/types/database'
import { calculateOrderTotals, formatPHPCompact } from '@/lib/utils/pricing'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { useOrderCart } from '@/hooks/useOrderCart'
import type { ManualOrderInput } from '@/lib/ops/submit-order'
import { Button, Field, Input, Overlay, Segmented } from '../ui'
import { Avatar } from '../accounts/parts'
import { rankForRequirement } from './AccountPicker'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'xob-ops-order-draft'

const PAYMENT_METHODS = ['GCash', 'Maya', 'Bank', 'Cash', 'Other'] as const

const EMPTY: ManualOrderInput = {
  buyerName: '',
  buyerRobloxUsername: '',
  accountId: '',
  paymentMethod: 'GCash',
  status: 'pending',
  notes: '',
}

function draftFromOrder(order: OrderWithDetails): { input: ManualOrderInput; items: LineItem[] } {
  return {
    input: {
      buyerName: order.buyer_name ?? '',
      buyerRobloxUsername: order.buyer_roblox_username ?? '',
      accountId: order.roblox_account_id ?? '',
      paymentMethod: order.payment_method,
      status: order.status === 'completed' ? 'completed' : order.status === 'paid' ? 'paid' : 'pending',
      notes: order.notes ?? '',
    },
    items: (order.order_items ?? []).map(item => ({
      _key: item.id,
      gamepass_id: item.gamepass_id ?? '',
      gamepass_name: item.gamepass_name,
      game_name: item.game_name,
      robux_amount: item.robux_amount,
      selling_price: item.selling_price,
      cost: item.cost,
      profit: item.profit,
    })),
  }
}

export default function ComposeDialog({
  gamepasses,
  accounts,
  editOrder,
  activeAccountId,
  saving,
  onSubmit,
  onClose,
}: {
  gamepasses: GamepassWithGame[]
  accounts: RobloxAccount[]
  editOrder: OrderWithDetails | null
  activeAccountId: string | null
  saving: boolean
  onSubmit: (input: ManualOrderInput, items: LineItem[]) => void
  onClose: () => void
}) {
  const seed = useMemo(() => {
    if (editOrder) return draftFromOrder(editOrder)
    // A half-written order survives a reload or an accidental close: the draft
    // is restored rather than lost, which is the part of the old multi-tab
    // workspace that actually mattered.
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as { input: ManualOrderInput; items: LineItem[] }
          if (parsed?.input) {
            return { input: { ...EMPTY, ...parsed.input }, items: parsed.items ?? [] }
          }
        }
      } catch {
        /* a corrupt draft is simply discarded */
      }
    }
    return { input: { ...EMPTY, accountId: activeAccountId ?? '' }, items: [] as LineItem[] }
  }, [editOrder, activeAccountId])

  const [input, setInput] = useState<ManualOrderInput>(seed.input)
  const [gameId, setGameId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const cart = useOrderCart(gamepasses, seed.items)
  const { items, cartGroups, cartCounts, addToCart, removeFromCart, clearCart } = cart

  useEffect(() => {
    if (editOrder) return
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ input, items }))
      } catch {
        /* storage full or blocked — the draft is a convenience, not a contract */
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [input, items, editOrder])

  const games = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const gp of gamepasses) {
      if (!gp.is_active || !gp.games) continue
      const existing = map.get(gp.games.id)
      if (existing) existing.count += 1
      else map.set(gp.games.id, { id: gp.games.id, name: gp.games.name, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [gamepasses])

  const visiblePasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return gamepasses
      .filter(gp => gp.is_active)
      .filter(gp => (gameId ? gp.game_id === gameId : true))
      .filter(gp => (q ? gp.name.toLowerCase().includes(q) || (gp.games?.name ?? '').toLowerCase().includes(q) : true))
      .slice(0, 120)
  }, [gamepasses, gameId, query])

  const account = accounts.find(a => a.id === input.accountId) ?? null
  const totals = calculateOrderTotals(
    items.filter(i => i.gamepass_id),
    account?.robux_cost_rate ?? 0,
    account?.is_plus_account ?? false,
  )
  const rankedAccounts = rankForRequirement(accounts, totals.effectiveRobux, '')
  const covers = account ? getAvailableRobux(account) >= totals.effectiveRobux : false
  const canSubmit = items.length > 0 && !!input.accountId

  return (
    <Overlay
      open
      onClose={onClose}
      title={editOrder ? 'Edit order' : 'New order'}
      subtitle={
        items.length > 0 ? (
          <span className="num">
            {items.length} item{items.length !== 1 ? 's' : ''} · {totals.totalRobux.toLocaleString()} R$ ·{' '}
            {formatPHPCompact(totals.totalPrice)}
          </span>
        ) : (
          'Manual XOB order'
        )
      }
      width="lg"
      footer={
        <>
          {items.length > 0 && (
            <Button intent="quiet" size="lg" onClick={clearCart} className="mr-auto">
              Clear items
            </Button>
          )}
          <Button intent="quiet" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            intent="primary"
            size="lg"
            busy={saving}
            disabled={!canSubmit}
            onClick={() => onSubmit(input, items)}
          >
            {editOrder ? 'Save order' : 'Create order'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* ── Catalog ────────────────────────────────────────────────── */}
        <section className="min-w-0">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-3)]"
              aria-hidden
            />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search gamepasses"
              aria-label="Search gamepasses"
              className="pl-8"
            />
          </div>

          <div className="ops-scroll -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setGameId(null)}
              aria-pressed={gameId === null}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors',
                gameId === null
                  ? 'border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text-2)]',
              )}
            >
              All games
            </button>
            {games.map(game => (
              <button
                key={game.id}
                type="button"
                onClick={() => setGameId(game.id)}
                aria-pressed={gameId === game.id}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors',
                  gameId === game.id
                    ? 'border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text-2)]',
                )}
              >
                {game.name}
              </button>
            ))}
          </div>

          <ul className="ops-scroll mt-2 max-h-[38dvh] divide-y divide-[var(--line-soft)] overflow-y-auto border-y border-[var(--line-soft)] lg:max-h-[46dvh]">
            {visiblePasses.length === 0 && (
              <li className="py-6 text-center text-[12.5px] text-[var(--text-3)]">
                No gamepasses match.
              </li>
            )}
            {visiblePasses.map(gp => {
              const count = cartCounts.get(gp.id) ?? 0
              return (
                <li key={gp.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-[var(--text)]">{gp.name}</span>
                    <span className="num block text-[11px] text-[var(--text-3)]">
                      {gp.games?.name ?? 'Other'} · {gp.robux_amount.toLocaleString()} R$ ·{' '}
                      {formatPHPCompact(gp.your_price)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      intent="quiet"
                      size="sm"
                      onClick={() => removeFromCart(gp.id)}
                      disabled={count === 0}
                      aria-label={`Remove one ${gp.name}`}
                      className="px-1.5"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </Button>
                    <span
                      className={cn(
                        'num w-6 text-center text-[12px] font-bold',
                        count > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                      )}
                    >
                      {count}
                    </span>
                    <Button
                      intent="quiet"
                      size="sm"
                      onClick={() => addToCart(gp.id)}
                      aria-label={`Add one ${gp.name}`}
                      className="px-1.5"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>

          {cartGroups.length > 0 && (
            <div className="mt-3">
              <h3 className="ops-label mb-1.5">In this order</h3>
              <ul className="space-y-1">
                {cartGroups.map(group => (
                  <li key={group.gamepass_id} className="flex items-center gap-2 text-[12px]">
                    <span className="num w-7 shrink-0 font-bold text-[var(--text-3)]">{group.count}×</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text)]">{group.gamepass_name}</span>
                    <span className="num shrink-0 text-[var(--text-2)]">
                      {formatPHPCompact(group.selling_price * group.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── Order details ──────────────────────────────────────────── */}
        <section className="min-w-0 space-y-3 lg:order-3">
          <Field label="Customer name">
            <Input
              value={input.buyerName}
              onChange={e => setInput(p => ({ ...p, buyerName: e.target.value }))}
              placeholder="Facebook name"
              autoComplete="off"
            />
          </Field>

          <Field label="Roblox username">
            <Input
              value={input.buyerRobloxUsername}
              onChange={e => setInput(p => ({ ...p, buyerRobloxUsername: e.target.value }))}
              placeholder="Delivery target"
              autoComplete="off"
            />
          </Field>

          <div>
            <span className="ops-label mb-1.5 block">Fulfillment account</span>
            <div className="ops-scroll max-h-40 space-y-0.5 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--line)] p-1">
              {rankedAccounts.map(a => {
                const available = getAvailableRobux(a)
                const fits = available >= totals.effectiveRobux
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setInput(p => ({ ...p, accountId: a.id }))}
                    aria-pressed={a.id === input.accountId}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors',
                      a.id === input.accountId ? 'bg-[var(--accent-wash)]' : 'hover:bg-[var(--surface-hi)]',
                      !fits && 'opacity-55',
                    )}
                  >
                    <Avatar account={a} size={20} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text)]">
                      {a.username}
                    </span>
                    <span
                      className={cn('num shrink-0 text-[11px]', fits ? 'text-[var(--ok)]' : 'text-[var(--bad)]')}
                    >
                      {available.toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
            {account && totals.effectiveRobux > 0 && (
              <p
                className={cn(
                  'num mt-1.5 text-[11.5px]',
                  covers ? 'text-[var(--text-3)]' : 'text-[var(--bad)]',
                )}
              >
                {covers
                  ? `${(getAvailableRobux(account) - totals.effectiveRobux).toLocaleString()} R$ would remain`
                  : `${(totals.effectiveRobux - getAvailableRobux(account)).toLocaleString()} R$ short`}
                {account.is_plus_account && totals.effectiveRobux !== totals.totalRobux && (
                  <> · Plus saves {(totals.totalRobux - totals.effectiveRobux).toLocaleString()} R$</>
                )}
              </p>
            )}
          </div>

          <div>
            <span className="ops-label mb-1.5 block">Payment</span>
            <div className="flex flex-wrap gap-1">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setInput(p => ({ ...p, paymentMethod: method }))}
                  aria-pressed={input.paymentMethod === method}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[var(--radius-sm)] border px-2.5 text-[12px] font-semibold transition-colors',
                    input.paymentMethod === method
                      ? 'border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent)]'
                      : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text-2)]',
                  )}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="ops-label mb-1.5 block">Status</span>
            <Segmented
              value={input.status}
              onChange={status => setInput(p => ({ ...p, status }))}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'paid', label: 'Paid' },
                { value: 'completed', label: 'Completed' },
              ]}
              className="w-full"
            />
          </div>

          <Field label="Notes">
            <textarea
              value={input.notes}
              onChange={e => setInput(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--bg-sunken)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent-line)]"
            />
          </Field>

          {items.length > 0 && (
            <dl className="grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
              <div>
                <dt className="ops-label">Robux</dt>
                <dd className="num mt-0.5 text-[13px] font-semibold text-[var(--text)]">
                  {totals.totalRobux.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="ops-label">Price</dt>
                <dd className="num mt-0.5 text-[13px] font-semibold text-[var(--text)]">
                  {formatPHPCompact(totals.totalPrice)}
                </dd>
              </div>
              <div>
                <dt className="ops-label">Profit</dt>
                <dd
                  className={cn(
                    'num mt-0.5 text-[13px] font-semibold',
                    totals.totalProfit >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
                  )}
                >
                  {formatPHPCompact(totals.totalProfit)}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </Overlay>
  )
}

export function clearOrderDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}
