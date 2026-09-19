'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { RobloxAccount } from '@/lib/types/database'
import type { LastUsed } from '@/lib/ops/last-used'
import { getAvailableRobux, isPlusReminderActive } from '@/lib/utils/accounts'
import { Button, Pill } from '../ui'
import { Avatar, BalanceMeter, USABLE_MIN_ROBUX, accountTone } from '../accounts/parts'
import { cn } from '@/lib/utils'

/* The fulfillment account dock.
 *
 * It replaces the full-height vertical rail the workspace used to carry. That
 * rail cost ~320px of horizontal space permanently and made choosing an
 * account a scrolling exercise through 200 rows — the same problem the
 * Accounts page had. A horizontal dock costs ~110px of vertical space, is
 * scanned left-to-right in one pass, and shows only accounts that can
 * plausibly take this order.
 *
 * Nothing about assignment semantics changes here: the dock only decides which
 * account is *active*, and the workspace's own actions do the assigning. */

/** Accounts below this cannot meaningfully help with any real order, so they
 *  are kept out of the dock entirely — "More accounts" still reaches them. */
const DOCK_MIN_ROBUX = USABLE_MIN_ROBUX

/** The dock is a glance, not a list. Beyond this the operator wants the
 *  searchable picker, not a longer strip. Matches the cap the legacy switch
 *  list used. */
const DOCK_LIMIT = 12

/* Ranking, in the order an operator actually wants to be offered accounts:
   accounts that can cover the whole requirement come first and among those the
   tightest fit leads, so nearly-drained accounts are consumed before fresh
   ones and a big account stays whole for the order that needs it. Everything
   else follows by size. The active account is excluded — it already has the
   dock's left-hand slot.

   "Last used" only ever breaks an exact tie; it never lifts an account over
   one that fits better. */
export function rankForDock(
  accounts: RobloxAccount[],
  required: number,
  activeAccountId: string | null,
  lastUsedAccountId: string | null = null,
): RobloxAccount[] {
  return accounts
    .filter(
      a =>
        a.id !== activeAccountId &&
        a.status === 'active' &&
        getAvailableRobux(a) >= DOCK_MIN_ROBUX,
    )
    .sort((a, b) => {
      const availableA = getAvailableRobux(a)
      const availableB = getAvailableRobux(b)
      if (required > 0) {
        const coversA = availableA >= required ? 1 : 0
        const coversB = availableB >= required ? 1 : 0
        if (coversA !== coversB) return coversB - coversA
        if (coversA === 1 && availableA !== availableB) return availableA - availableB
      }
      if (availableA !== availableB) return availableB - availableA
      if (lastUsedAccountId) {
        if (a.id === lastUsedAccountId) return -1
        if (b.id === lastUsedAccountId) return 1
      }
      return a.username.localeCompare(b.username)
    })
}

function DockChip({
  account,
  required,
  lastUsed,
  onSelect,
}: {
  account: RobloxAccount
  required: number
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
      title={`Fulfil from ${account.username}`}
      className={cn(
        'flex w-[172px] shrink-0 flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-left transition-colors',
        'hover:border-[var(--line-strong)] hover:bg-[var(--surface-hi)]',
        // Dimmed rather than hidden: it cannot take this order whole, but it
        // is still a legitimate choice for a split assignment.
        !covers && 'opacity-50 hover:opacity-100',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Avatar account={account} size={20} />
        <span className="truncate text-[12px] font-semibold text-[var(--text)]">
          {account.username}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'num text-[15px] font-semibold leading-none',
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
        {account.is_plus_account && <Pill tone="amber">Plus</Pill>}
        {lastUsed && <Pill tone="blue">Last used</Pill>}
      </span>
    </button>
  )
}

export default function AccountDock({
  accounts,
  activeAccountId,
  onSelect,
  onBrowse,
  required,
  requirementLabel,
  lastUsed,
}: {
  accounts: RobloxAccount[]
  activeAccountId: string | null
  onSelect: (accountId: string) => void
  /** Opens the full searchable picker — every account, including drained ones. */
  onBrowse: () => void
  required: number
  requirementLabel?: string
  /** Which account last fulfilled this order's gamepass or game, if known. */
  lastUsed?: LastUsed | null
}) {
  const active = accounts.find(a => a.id === activeAccountId) ?? null
  const lastUsedId = lastUsed?.accountId ?? null
  const lastUsedAccount = lastUsedId ? (accounts.find(a => a.id === lastUsedId) ?? null) : null
  const ranked = useMemo(
    () => rankForDock(accounts, required, activeAccountId, lastUsedId),
    [accounts, required, activeAccountId, lastUsedId],
  )
  const shown = ranked.slice(0, DOCK_LIMIT)

  const available = active ? getAvailableRobux(active) : 0
  const covers = active ? available >= required : false

  return (
    // A fixed band. The dock trades a slice of height for the width the rail
    // used to take, so that height has to stay predictable no matter which
    // account is active or how many candidates there are.
    <div className="flex h-[120px] items-stretch gap-4 px-4 py-2.5">
      {/* ── The active account ──────────────────────────────────────────
          Given a standing, bordered slot of its own so "what am I spending
          from" is answerable without reading any of the alternatives. */}
      <div
        className={cn(
          'flex w-[280px] shrink-0 flex-col justify-center rounded-[var(--radius)] border px-3 py-2',
          active
            ? 'border-[var(--accent-line)] bg-[var(--accent-wash)]'
            : 'border-dashed border-[var(--line-strong)] bg-[var(--surface)]',
        )}
      >
        <p className="ops-label mb-1.5">Fulfilling from</p>
        {active ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar account={active} size={26} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-[var(--text)]">
                    {active.username}
                  </span>
                  {active.is_plus_account && (
                    <Pill tone="amber" title={
                      isPlusReminderActive(active)
                        ? 'Plus is on — confirm auto-renewal is switched off'
                        : undefined
                    }>
                      Plus{isPlusReminderActive(active) && ' !'}
                    </Pill>
                  )}
                </span>
              </span>
              <span
                className={cn(
                  'num shrink-0 text-[15px] font-semibold',
                  covers || required <= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
                )}
              >
                {available.toLocaleString()}
              </span>
            </div>

            <BalanceMeter account={active} pending={required} className="mt-1.5" />

            <p className="num mt-1.5 truncate text-[11px] text-[var(--text-3)]">
              {required > 0 ? (
                <>
                  {requirementLabel ?? 'This order'} needs {required.toLocaleString()} —{' '}
                  <span className={covers ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
                    {covers
                      ? `${(available - required).toLocaleString()} left`
                      : `${(required - available).toLocaleString()} short`}
                  </span>
                </>
              ) : (
                (active.chrome_profile ?? 'No Chrome profile set')
              )}
            </p>

          </>

        ) : (
          <p className="text-[12px] leading-snug text-[var(--text-3)]">
            No account chosen. Pick one to the right to start assigning orders to it.
          </p>
        )}
      </div>

      {/* ── Candidates ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="ops-label shrink-0">
            {required > 0 ? 'Best for this order' : 'Switch account'}
          </p>
          {/* The hint names what matched, so it reads as a reason rather than
              as a recommendation that overrides the ranking. */}
          {lastUsed && lastUsedAccount && (
            <p className="min-w-0 truncate text-[11.5px] text-[var(--text-3)]">
              <span aria-hidden className="mr-2 text-[var(--line-strong)]">
                &middot;
              </span>
              Last used for {lastUsed.basis === 'game' ? 'this game' : 'this gamepass'}:{' '}
              <span className="font-semibold text-[var(--blue)]">{lastUsedAccount.username}</span>
              {lastUsedAccount.id === activeAccountId && ' (active)'}
            </p>
          )}
          <Button intent="quiet" size="sm" onClick={onBrowse} className="ml-auto">
            More accounts
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </div>

        {shown.length === 0 ? (
          <p className="text-[12px] text-[var(--text-3)]">
            No other account holds {DOCK_MIN_ROBUX} R$ or more. Open More accounts to assign one
            manually.
          </p>
        ) : (
          <div className="ops-scroll flex gap-2 overflow-x-auto pb-1">
            {shown.map(account => (
              <DockChip
                key={account.id}
                account={account}
                required={required}
                lastUsed={account.id === lastUsedId}
                onSelect={() => onSelect(account.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
