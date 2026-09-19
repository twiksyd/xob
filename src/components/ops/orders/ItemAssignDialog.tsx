'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { RobloxAccount } from '@/lib/types/database'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { ticketName, ticketRef } from '@/lib/ops/queue'
import { lastUsedForItem, type LastUsedIndex } from '@/lib/ops/last-used'
import type { ItemAssignResult } from './useOrderActions'
import { rankForRequirement } from './AccountPicker'
import { Button, Overlay, Pill } from '../ui'
import { Avatar } from '../accounts/parts'
import { cn } from '@/lib/utils'

/* Per-item assignment, for the case a single BudgetWise checkout has to be
   split across accounts because no one account holds enough Robux for all of
   it. The common case — one account takes the whole order — is the primary
   button in the work area and never opens this dialog. */

function AccountSelect({
  accounts,
  value,
  required,
  lastUsedId,
  onChange,
}: {
  accounts: RobloxAccount[]
  value: string | null
  required: number
  lastUsedId: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = accounts.find(a => a.id === value) ?? null
  const ranked = useMemo(() => rankForRequirement(accounts, required, ''), [accounts, required])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] border px-2 text-left transition-colors',
          selected
            ? 'border-[var(--line-strong)] bg-[var(--raised)]'
            : 'border-dashed border-[var(--accent-line)] bg-[var(--accent-wash)]',
        )}
      >
        {selected ? (
          <>
            <Avatar account={selected} size={20} />
            <span className="num min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--text)]">
              {selected.username}
            </span>
            <span className="num shrink-0 text-[11px] text-[var(--text-3)]">
              {getAvailableRobux(selected).toLocaleString()}
            </span>
          </>
        ) : (
          <span className="flex-1 text-[12px] font-medium text-[var(--accent)]">Choose account</span>
        )}
        <ChevronDown className="size-3.5 shrink-0 text-[var(--text-3)]" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="ops-scroll ops-enter absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--raised)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="flex h-8 w-full items-center rounded-[var(--radius-sm)] px-2 text-[12px] text-[var(--bad)] transition-colors hover:bg-[var(--bad-wash)]"
              >
                Unassign this item
              </button>
            )}
            {ranked.map(account => {
              const available = getAvailableRobux(account)
              const covers = available >= required
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    onChange(account.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 transition-colors hover:bg-[var(--surface-hi)]',
                    !covers && 'opacity-55',
                  )}
                >
                  <Avatar account={account} size={20} />
                  <span className="min-w-0 flex-1 truncate text-left text-[12px] text-[var(--text)]">
                    {account.username}
                  </span>
                  {account.id === lastUsedId && <Pill tone="blue">Last used</Pill>}
                  <span
                    className={cn(
                      'num shrink-0 text-[11px]',
                      covers ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
                    )}
                  >
                    {available.toLocaleString()}
                  </span>
                  {account.id === value && <Check className="size-3.5 text-[var(--accent)]" aria-hidden />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function ItemAssignDialog({
  order,
  accounts,
  activeAccountId,
  saving,
  results,
  lastUsedIndex,
  onSave,
  onClose,
}: {
  order: LogicalOrder
  accounts: RobloxAccount[]
  activeAccountId: string | null
  /** History for the per-item "Last used" hint. A label only — it never
   *  pre-fills an assignment. */
  lastUsedIndex?: LastUsedIndex
  saving: boolean
  results: ItemAssignResult[] | null
  onSave: (assignments: Record<string, string | null>) => void
  onClose: () => void
}) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(order.items.map(item => [item.id, item.robloxAccountId ?? null])),
  )

  const resultById = useMemo(
    () => new Map((results ?? []).map(r => [r.itemId, r])),
    [results],
  )

  const dirty = order.items.some(item => (assignments[item.id] ?? null) !== (item.robloxAccountId ?? null))

  // Show the combined draw per account so it is obvious before saving that two
  // items pointed at the same account add up past what it holds.
  const perAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of order.items) {
      const target = assignments[item.id]
      if (!target) continue
      if (target === item.robloxAccountId) continue
      map.set(target, (map.get(target) ?? 0) + item.robuxAmount)
    }
    return map
  }, [assignments, order.items])

  const shortfalls = Array.from(perAccount.entries()).flatMap(([id, need]) => {
    const account = accounts.find(a => a.id === id)
    if (!account) return []
    const freed = order.items
      .filter(i => i.robloxAccountId === id && assignments[i.id] !== id)
      .reduce((sum, i) => sum + i.robuxAmount, 0)
    const effective = getAvailableRobux(account) + freed
    return effective < need ? [{ username: account.username, need, effective }] : []
  })

  const unassignedCount = order.items.filter(item => !assignments[item.id]).length

  return (
    <Overlay
      open
      onClose={onClose}
      title={ticketName(order)}
      subtitle={
        <span className="num">
          {ticketRef(order)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
          {unassignedCount} unassigned
        </span>
      }
      width="lg"
      footer={
        <>
          <Button intent="quiet" size="lg" onClick={onClose}>
            Close
          </Button>
          <Button
            intent="primary"
            size="lg"
            busy={saving}
            disabled={!dirty || shortfalls.length > 0}
            onClick={() => onSave(assignments)}
          >
            Save assignments
          </Button>
        </>
      }
    >
      {activeAccountId && unassignedCount > 0 && (
        <Button
          intent="neutral"
          size="md"
          block
          className="mb-3"
          onClick={() =>
            setAssignments(prev => {
              const next = { ...prev }
              for (const item of order.items) if (!next[item.id]) next[item.id] = activeAccountId
              return next
            })
          }
        >
          Fill {unassignedCount} empty item{unassignedCount !== 1 ? 's' : ''} with the active account
        </Button>
      )}

      <ul className="space-y-2">
        {order.items.map(item => {
          const result = resultById.get(item.id)
          const hint = lastUsedIndex ? lastUsedForItem(lastUsedIndex, item) : null
          const hintAccount = hint ? accounts.find(a => a.id === hint.accountId) : undefined
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-[var(--radius)] border px-2.5 py-2',
                result && !result.ok ? 'border-[var(--bad-line)] bg-[var(--bad-wash)]' : 'border-[var(--line)]',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-[var(--text)]">
                    {item.gamepassName}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-[var(--text-3)]">
                    {item.gameName ?? 'Other'} · {item.robuxAmount.toLocaleString()} R$
                  </p>
                  {hintAccount && (
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-3)]">
                      Last used for this {hint?.basis === 'game' ? 'game' : 'gamepass'}:{' '}
                      <span className="font-semibold text-[var(--blue)]">{hintAccount.username}</span>
                    </p>
                  )}
                </div>
                {result?.ok && <Pill tone="ok">saved</Pill>}
              </div>

              <div className="mt-2">
                <AccountSelect
                  accounts={accounts}
                  value={assignments[item.id] ?? null}
                  required={item.robuxAmount}
                  lastUsedId={hintAccount?.id ?? null}
                  onChange={id => setAssignments(prev => ({ ...prev, [item.id]: id }))}
                />
              </div>

              {result && !result.ok && result.error && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-[var(--bad)]">
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                  {result.error}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {shortfalls.length > 0 && (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--bad-line)] bg-[var(--bad-wash)] px-3 py-2">
          {shortfalls.map(s => (
            <p key={s.username} className="num text-[11.5px] text-[var(--bad)]">
              {s.username} would need {s.need.toLocaleString()} R$ but only{' '}
              {s.effective.toLocaleString()} R$ is available.
            </p>
          ))}
        </div>
      )}
    </Overlay>
  )
}
