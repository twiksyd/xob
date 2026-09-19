'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { RobloxAccount } from '@/lib/types/database'
import { getAvailableRobux, isPlusReminderActive } from '@/lib/utils/accounts'
import { Empty, Input, Pill } from '../ui'
import { Avatar, BalanceMeter, accountTone } from '../accounts/parts'
import { cn } from '@/lib/utils'

/* The fulfillment rail. One account is "active" and is what the primary
   action in the work area spends from — switching is a single tap and never
   leaves the order. Ranking puts accounts that can actually cover the current
   requirement first, so the top of the list is always a valid choice. */

export function rankForRequirement(accounts: RobloxAccount[], required: number, query: string) {
  const q = query.trim().toLowerCase()
  return accounts
    .filter(
      a =>
        !q ||
        a.username.toLowerCase().includes(q) ||
        (a.chrome_profile ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const availableA = getAvailableRobux(a)
      const availableB = getAvailableRobux(b)
      if (required > 0) {
        const coversA = availableA >= required ? 1 : 0
        const coversB = availableB >= required ? 1 : 0
        if (coversA !== coversB) return coversB - coversA
        // Among accounts that fit, drain the tightest one first so fresh
        // accounts stay whole for the orders that need them.
        if (coversA === 1) return availableA - availableB
      }
      const usableA = a.status === 'active' ? 1 : 0
      const usableB = b.status === 'active' ? 1 : 0
      if (usableA !== usableB) return usableB - usableA
      if (availableA !== availableB) return availableB - availableA
      return a.username.localeCompare(b.username)
    })
}

function AccountOption({
  account,
  required,
  scaleMax,
  lastUsed,
  onSelect,
}: {
  account: RobloxAccount
  required: number
  scaleMax: number
  lastUsed: boolean
  onSelect: () => void
}) {
  const available = getAvailableRobux(account)
  const covers = required <= 0 || available >= required
  const tone = accountTone(account)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-2 text-left transition-colors',
        'hover:bg-[var(--surface-hi)]',
        !covers && 'opacity-55',
      )}
    >
      <Avatar account={account} size={28} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold text-[var(--text)]">
            {account.username}
          </span>
          {account.is_plus_account && <Pill tone="amber">Plus</Pill>}
          {lastUsed && <Pill tone="blue">Last used</Pill>}
        </span>
        <span className="mt-1 block">
          <BalanceMeter account={account} scaleMax={scaleMax} />
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'num block text-[12px] font-semibold',
            tone === 'ok'
              ? 'text-[var(--ok)]'
              : tone === 'bad'
                ? 'text-[var(--bad)]'
                : tone === 'accent'
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-2)]',
          )}
        >
          {available.toLocaleString()}
        </span>
        <span className="block text-[10px] text-[var(--text-3)]">available</span>
      </span>
    </button>
  )
}

export default function AccountPicker({
  accounts,
  activeAccountId,
  onSelect,
  required,
  requirementLabel,
  className,
  lastUsedAccountId = null,
}: {
  accounts: RobloxAccount[]
  activeAccountId: string | null
  onSelect: (accountId: string) => void
  required: number
  requirementLabel?: string
  className?: string
  /** Labelled only — the picker's ranking is unchanged by it. */
  lastUsedAccountId?: string | null
}) {
  const [query, setQuery] = useState('')
  const active = accounts.find(a => a.id === activeAccountId) ?? null
  const ranked = useMemo(
    () => rankForRequirement(accounts.filter(a => a.id !== activeAccountId), required, query),
    [accounts, activeAccountId, required, query],
  )

  const available = active ? getAvailableRobux(active) : 0
  const covers = active ? available >= required : false
  // One scale for every bar in the list, so their lengths are comparable.
  const scaleMax = Math.max(1, ...accounts.map(a => a.current_robux ?? 0))

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-3">
        <h2 className="ops-label mb-2">Fulfilling from</h2>

        {active ? (
          <div>
            <div className="flex items-center gap-2.5">
              <Avatar account={active} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">
                    {active.username}
                  </p>
                  {active.is_plus_account && <Pill tone="amber">Plus</Pill>}
                </div>
                <p className="truncate text-[11.5px] text-[var(--text-3)]">
                  {active.chrome_profile || 'No Chrome profile set'}
                </p>
              </div>
            </div>

            <BalanceMeter account={active} pending={required} className="mt-2.5" />

            <dl className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: 'Available', value: available, tone: covers ? 'text-[var(--ok)]' : 'text-[var(--bad)]' },
                { label: 'Reserved', value: active.reserved_robux ?? 0, tone: 'text-[var(--text-2)]' },
                { label: 'Total', value: active.current_robux ?? 0, tone: 'text-[var(--text-2)]' },
              ].map(cell => (
                <div key={cell.label}>
                  <dt className="ops-label">{cell.label}</dt>
                  <dd className={cn('num mt-0.5 text-[13px] font-semibold', cell.tone)}>
                    {cell.value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>

            {required > 0 && (
              <p
                className={cn(
                  'num mt-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[11.5px]',
                  covers
                    ? 'bg-[var(--ok-wash)] text-[var(--ok)]'
                    : 'bg-[var(--bad-wash)] text-[var(--bad)]',
                )}
              >
                {requirementLabel ?? 'This order'} needs {required.toLocaleString()} R$ —{' '}
                {covers
                  ? `${(available - required).toLocaleString()} R$ would remain`
                  : `${(required - available).toLocaleString()} R$ short`}
              </p>
            )}

            {isPlusReminderActive(active) && (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
                Plus is on for this account — confirm auto-renewal is off.
              </p>
            )}
          </div>
        ) : (
          <p className="py-2 text-[12.5px] text-[var(--text-3)]">
            No account chosen. Pick one below to start assigning orders to it.
          </p>
        )}
      </div>

      <div className="shrink-0 px-3 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-3)]"
            aria-hidden
          />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Switch account"
            aria-label="Search accounts"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="ops-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {ranked.length === 0 ? (
          <Empty title="No accounts match" body="Clear the search to see every active account." />
        ) : (
          ranked.map(account => (
            <AccountOption
              key={account.id}
              account={account}
              required={required}
              scaleMax={scaleMax}
              lastUsed={account.id === lastUsedAccountId}
              onSelect={() => onSelect(account.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
