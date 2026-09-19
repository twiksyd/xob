'use client'

import { useState } from 'react'
import type { RobloxAccount } from '@/lib/types/database'
import {
  getAvailableRobux,
  classifyAccountHealth,
  getAgingState,
  getAgingRemainingMs,
  isPlusReminderActive,
} from '@/lib/utils/accounts'
import { Pill, type Tone } from '../ui'
import { cn } from '@/lib/utils'

/* Presentation-only cut-off. An account holding 99 R$ or less cannot fulfill
   anything a customer actually buys, so it is kept out of the default view —
   the row is never touched, only hidden behind the Low / empty group. This is
   deliberately NOT `MIN_SELECTABLE_ROBUX`, which gates bulk selection. */
export const USABLE_MIN_ROBUX = 100

export function isUsableAccount(account: RobloxAccount): boolean {
  return getAvailableRobux(account) >= USABLE_MIN_ROBUX
}

/* Account presentation shared by the Orders fulfillment rail and the Accounts
   page, so an account looks and reads identically wherever it appears. */

export function accountTone(account: RobloxAccount): Tone {
  if (account.status !== 'active') return 'neutral'
  switch (classifyAccountHealth(account)) {
    case 'healthy':
      return 'ok'
    case 'low':
      return 'accent'
    case 'depleted':
      return 'bad'
  }
}

export function Avatar({
  account,
  size = 32,
  className,
}: {
  account: Pick<RobloxAccount, 'username' | 'roblox_user_id'>
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = account.roblox_user_id && !failed

  // Proxied through our own route handler; next/image would add a second
  // fetch layer for a 32px avatar the proxy already caches.
  return showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/roblox-avatar?userId=${account.roblox_user_id}`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-[6px] bg-[var(--raised)] object-cover', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[6px] bg-[var(--raised)] font-bold text-[var(--text-2)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {account.username.charAt(0).toUpperCase()}
    </span>
  )
}

/* A single bar carrying the whole balance story: the filled part is what can
   be spent right now, the dimmed part is already reserved against open orders.
   Reading "how much is left" is then one glance, not three numbers. */
export function BalanceMeter({
  account,
  pending = 0,
  scaleMax,
  className,
}: {
  account: RobloxAccount
  /** Robux a proposed assignment would additionally reserve, shown as a
   *  hatched segment so the operator sees the outcome before committing. */
  pending?: number
  /** When set, the bar is drawn against this figure instead of the account's
   *  own total — so bars in a list are comparable to each other rather than
   *  each one filling its own track. */
  scaleMax?: number
  className?: string
}) {
  const current = Math.max(0, account.current_robux ?? 0)
  const reserved = Math.max(0, account.reserved_robux ?? 0)
  const available = Math.max(0, getAvailableRobux(account))
  const total = Math.max(scaleMax ?? 0, current, reserved + available, 1)

  const pendingWidth = Math.min(pending, available)
  const freeWidth = Math.max(0, available - pendingWidth)
  const tone = accountTone(account)
  const fill =
    tone === 'ok' ? 'var(--ok)' : tone === 'accent' ? 'var(--accent)' : tone === 'bad' ? 'var(--bad)' : 'var(--text-3)'

  return (
    <div
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--line-soft)]', className)}
      role="img"
      aria-label={`${available.toLocaleString()} Robux available of ${current.toLocaleString()}`}
    >
      <span style={{ width: `${(freeWidth / total) * 100}%`, background: fill }} />
      {pendingWidth > 0 && (
        <span
          style={{
            width: `${(pendingWidth / total) * 100}%`,
            background: `repeating-linear-gradient(115deg, var(--accent) 0 3px, transparent 3px 6px)`,
          }}
        />
      )}
      <span style={{ width: `${(reserved / total) * 100}%`, background: 'var(--line-strong)' }} />
    </div>
  )
}

/* ── Account classifications ───────────────────────────────────────────────
   Every badge the legacy account card carried, minus the ones that depended on
   the transfer tracker (that surface still owns those). Each entry is driven by
   a real column — nothing here is inferred or invented. */

export interface AccountBadge {
  key: string
  label: string
  tone: Tone
}

export function accountBadges(
  account: RobloxAccount,
  { active, now }: { active?: boolean; now?: Date } = {},
): AccountBadge[] {
  const badges: AccountBadge[] = []

  if (active) badges.push({ key: 'active', label: 'Active', tone: 'accent' })
  if (account.status !== 'active') {
    badges.push({ key: 'status', label: account.status, tone: account.status === 'banned' ? 'bad' : 'neutral' })
  }
  if (account.is_plus_account) badges.push({ key: 'plus', label: 'Plus', tone: 'amber' })
  if (account.has_super_discount) badges.push({ key: 'super', label: 'Super', tone: 'bad' })
  if (account.has_active_discount) badges.push({ key: 'discount', label: 'Discount', tone: 'pink' })

  // Inventory aging — an account has nine days to be spent down before the
  // capital tied up in it is considered at risk.
  const aging = now ? getAgingState(account, now) : null
  if (aging === 'expired') {
    badges.push({ key: 'aging', label: 'Expired', tone: 'bad' })
  } else if (now && (aging === 'critical' || aging === 'warning')) {
    const hours = Math.floor(getAgingRemainingMs(account, now) / 3_600_000)
    badges.push({
      key: 'aging',
      label: hours < 24 ? `${hours}h left` : `${Math.floor(hours / 24)}d left`,
      tone: aging === 'critical' ? 'bad' : 'amber',
    })
  }

  if (isPlusReminderActive(account)) {
    badges.push({ key: 'renewal', label: 'Renewal', tone: 'amber' })
  }

  return badges
}

export function AccountBadges({
  badges,
  max,
  className,
}: {
  badges: AccountBadge[]
  /** Beyond this, the remainder collapses to a +N chip so a busy account
   *  cannot push the tile's balance figure out of place. */
  max?: number
  className?: string
}) {
  if (badges.length === 0) return null
  const shown = max ? badges.slice(0, max) : badges
  const hidden = badges.length - shown.length

  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {shown.map(b => (
        <Pill key={b.key} tone={b.tone} className="capitalize">
          {b.label}
        </Pill>
      ))}
      {hidden > 0 && (
        <Pill tone="neutral" className="num">
          +{hidden}
        </Pill>
      )}
    </span>
  )
}

export function Robux({
  value,
  className,
  tone,
}: {
  value: number
  className?: string
  tone?: 'default' | 'muted' | 'ok' | 'bad' | 'accent'
}) {
  const color =
    tone === 'muted'
      ? 'text-[var(--text-3)]'
      : tone === 'ok'
        ? 'text-[var(--ok)]'
        : tone === 'bad'
          ? 'text-[var(--bad)]'
          : tone === 'accent'
            ? 'text-[var(--accent)]'
            : 'text-[var(--text)]'
  return (
    <span className={cn('num', color, className)}>
      {value.toLocaleString()}
      <span className="ml-0.5 text-[0.82em] opacity-55">R$</span>
    </span>
  )
}
