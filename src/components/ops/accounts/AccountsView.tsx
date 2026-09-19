'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Check, ExternalLink, Plus, ChevronRight, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReservationWithDetails, RobloxAccount } from '@/lib/types/database'
import {
  getAvailableRobux,
  isPlusReminderActive,
  getAgingState,
  LOW_STOCK_THRESHOLD,
  RUNNING_LOW_THRESHOLD,
} from '@/lib/utils/accounts'
import { formatPHPCompact } from '@/lib/utils/pricing'
import { useActiveAccount } from '@/lib/ops/active-account'
import { saveAccount, type AccountFormData } from '@/lib/ops/save-account'
import AccountModal from '@/components/accounts/AccountModal'
import { useToast } from '../feedback'
import { Button, Empty, Input, Overlay, SkeletonRows } from '../ui'
import {
  Avatar,
  BalanceMeter,
  AccountBadges,
  accountBadges,
  accountTone,
  isUsableAccount,
  USABLE_MIN_ROBUX,
} from './parts'
import { cn } from '@/lib/utils'

/* Accounts, read the way an operator needs them during fulfillment.
 *
 * The dataset is ~200 accounts of which a handful hold spendable Robux. A
 * vertical list of all 200 is the wrong shape for that: it buries the six that
 * matter under 197 that cannot fulfill anything. So the default view is a
 * compact grid of only the usable accounts — small enough to take in at one
 * glance on a desktop — and everything at or under 99 R$ collapses into a
 * single group the operator opens deliberately. Nothing is hidden from the
 * database; this is presentation only.
 *
 * Detail is secondary and opens as a sheet rather than permanently occupying
 * half the screen, because comparing accounts is the job and reading one is
 * the exception.
 *
 * The rest of the account lifecycle — transfers, batches, price tiers, capital
 * planning — still lives on the legacy Accounts page. */

type AccountFilter = 'usable' | 'plus' | 'discount' | 'attention'

function needsAttention(account: RobloxAccount, now: Date): boolean {
  if (isPlusReminderActive(account)) return true
  const aging = getAgingState(account, now)
  return aging === 'warning' || aging === 'critical' || aging === 'expired'
}

function matchesFilter(account: RobloxAccount, filter: AccountFilter, now: Date): boolean {
  switch (filter) {
    case 'plus':
      return account.is_plus_account
    case 'discount':
      return account.has_active_discount || account.has_super_discount
    case 'attention':
      return needsAttention(account, now)
    default:
      return true
  }
}

/* One account, sized so a desktop shows every usable account at once. The
   available balance is the only figure that gets display weight — it is the
   number that decides whether this account can take the order in hand. */
function AccountTile({
  account,
  active,
  openOrders,
  scaleMax,
  now,
  dim,
  onOpen,
}: {
  account: RobloxAccount
  active: boolean
  openOrders: number
  scaleMax: number
  now: Date
  dim?: boolean
  onOpen: () => void
}) {
  const available = getAvailableRobux(account)
  const reserved = account.reserved_robux ?? 0
  const tone = accountTone(account)
  const valueColor =
    tone === 'ok'
      ? 'text-[var(--ok)]'
      : tone === 'bad'
        ? 'text-[var(--bad)]'
        : tone === 'accent'
          ? 'text-[var(--accent)]'
          : 'text-[var(--text-2)]'

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex flex-col items-stretch rounded-[var(--radius)] border p-3 text-left transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-wash)]'
          : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hi)]',
        dim && 'opacity-60 hover:opacity-100',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Avatar account={account} size={26} />
        <span className="truncate text-[12.5px] font-semibold text-[var(--text)]">
          {account.username}
        </span>
      </span>

      <span className={cn('num mt-2.5 block text-[24px] font-semibold leading-none', valueColor)}>
        {available.toLocaleString()}
      </span>
      <span className="ops-label mt-1 block">available R$</span>

      <span className="mt-2 block">
        <BalanceMeter account={account} scaleMax={scaleMax} />
      </span>

      <span className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-3)]">
        {reserved > 0 ? (
          <span className="num shrink-0 text-[var(--text-2)]">{reserved.toLocaleString()} reserved</span>
        ) : (
          <span className="shrink-0">Nothing reserved</span>
        )}
        {account.chrome_profile && (
          <>
            <span aria-hidden className="text-[var(--line-strong)]">
              &middot;
            </span>
            <span className="truncate">{account.chrome_profile}</span>
          </>
        )}
      </span>

      {openOrders > 0 && (
        <span className="num mt-1 block text-[11px] text-[var(--text-3)]">
          {openOrders} open order{openOrders !== 1 ? 's' : ''}
        </span>
      )}

      <AccountBadges
        badges={accountBadges(account, { active, now })}
        max={3}
        className="mt-2.5"
      />
    </button>
  )
}

function DetailBody({
  account,
  reservations,
  now,
}: {
  account: RobloxAccount
  reservations: ReservationWithDetails[]
  now: Date
}) {
  const badges = accountBadges(account, { now })

  return (
    <>
      {badges.length > 0 && <AccountBadges badges={badges} className="mb-3" />}

      <BalanceMeter account={account} className="h-2" />

      <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)]">
        {[
          {
            label: 'Available',
            value: getAvailableRobux(account).toLocaleString(),
            tone:
              getAvailableRobux(account) > RUNNING_LOW_THRESHOLD
                ? 'text-[var(--ok)]'
                : getAvailableRobux(account) > LOW_STOCK_THRESHOLD
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--bad)]',
          },
          {
            label: 'Reserved',
            value: (account.reserved_robux ?? 0).toLocaleString(),
            tone: 'text-[var(--text-2)]',
          },
          {
            label: 'Total',
            value: (account.current_robux ?? 0).toLocaleString(),
            tone: 'text-[var(--text-2)]',
          },
        ].map(cell => (
          <div key={cell.label} className="bg-[var(--surface)] px-3 py-2.5">
            <dt className="ops-label">{cell.label}</dt>
            <dd className={cn('num mt-1 text-[16px] font-semibold', cell.tone)}>{cell.value}</dd>
          </div>
        ))}
      </dl>

      <p className="num mt-2 text-[11.5px] text-[var(--text-3)]">
        Cost basis {formatPHPCompact(account.robux_cost_rate ?? 0)} per 1,000 R$
        {account.is_plus_account && ' · Plus lowers Robux spent at fulfillment, not this rate'}
      </p>

      {isPlusReminderActive(account) && (
        <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--amber-wash)] px-2.5 py-1.5 text-[11.5px] text-[var(--amber)]">
          Plus is enabled — confirm auto-renewal is switched off on this account.
        </p>
      )}

      <section className="mt-4">
        <h3 className="ops-label mb-1.5">
          Reserved against {reservations.length} open order{reservations.length !== 1 ? 's' : ''}
        </h3>
        {reservations.length === 0 ? (
          <p className="text-[12.5px] text-[var(--text-3)]">
            Nothing is holding this account&apos;s Robux — all of it is spendable.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
            {reservations.map(r => (
              <li key={r.id} className="flex items-center gap-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[var(--text)]">
                    {r.orders?.buyer_name ?? 'Unnamed customer'}
                  </span>
                  <span className="num block truncate text-[11px] text-[var(--text-3)]">
                    {r.orders?.order_number ?? '—'} · {r.gamepass_names || 'no items listed'}
                  </span>
                </span>
                <span className="num shrink-0 text-[12.5px] font-semibold text-[var(--text-2)]">
                  {r.robux_amount.toLocaleString()} R$
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* roblox_accounts.notes is deliberately not rendered anywhere in this
          console: that field holds private account material and must never
          reach the UI, logs or an API response. */}
    </>
  )
}

export default function AccountsView() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AccountFilter>('usable')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<RobloxAccount | null>(null)
  const [showLow, setShowLow] = useState(false)
  const [activeId, setActiveAccount] = useActiveAccount()

  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<RobloxAccount | null>(null)
  const [saving, setSaving] = useState(false)

  // Aging is a slow clock — resolving it once per mount keeps every badge in a
  // render pass agreeing with every other one.
  const now = useMemo(() => new Date(), [])

  const load = useCallback(async () => {
    setLoading(true)
    const [accRes, resRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase
        .from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ])

    if (accRes.error) toast.error(`Could not load accounts: ${accRes.error.message}`)
    else if (accRes.data) setAccounts(accRes.data as RobloxAccount[])

    if (resRes.error) toast.error(`Could not load reservations: ${resRes.error.message}`)
    else if (resRes.data) setReservations(resRes.data as ReservationWithDetails[])

    setLoading(false)
    // `toast` is stable for the life of the provider; including it would make
    // this callback churn on every toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('xob-ops-accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roblox_accounts' }, () => {
        void load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'robux_reservations' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, supabase])

  const reservationsByAccount = useMemo(() => {
    const map = new Map<string, ReservationWithDetails[]>()
    for (const r of reservations) {
      map.set(r.account_id, [...(map.get(r.account_id) ?? []), r])
    }
    return map
  }, [reservations])

  const live = useMemo(() => accounts.filter(a => a.status === 'active'), [accounts])
  // One bar scale across the whole page so tile meters compare to each other.
  const scaleMax = useMemo(() => Math.max(1, ...accounts.map(a => a.current_robux ?? 0)), [accounts])

  const totals = useMemo(() => {
    const available = live.reduce((sum, a) => sum + Math.max(0, getAvailableRobux(a)), 0)
    const reserved = live.reduce((sum, a) => sum + (a.reserved_robux ?? 0), 0)
    const value = live.reduce(
      (sum, a) => sum + (Math.max(0, getAvailableRobux(a)) * (a.robux_cost_rate ?? 0)) / 1000,
      0,
    )
    return { available, reserved, value, ready: live.filter(isUsableAccount).length }
  }, [live])

  const byQuery = useCallback(
    (a: RobloxAccount) => {
      const q = query.trim().toLowerCase()
      return (
        !q ||
        a.username.toLowerCase().includes(q) ||
        (a.chrome_profile ?? '').toLowerCase().includes(q)
      )
    },
    [query],
  )

  const sortByAvailable = useCallback((a: RobloxAccount, b: RobloxAccount) => {
    const liveA = a.status === 'active' ? 1 : 0
    const liveB = b.status === 'active' ? 1 : 0
    if (liveA !== liveB) return liveB - liveA
    return getAvailableRobux(b) - getAvailableRobux(a)
  }, [])

  // The default population: what can actually take work today.
  const usable = useMemo(
    () => accounts.filter(isUsableAccount).sort(sortByAvailable),
    [accounts, sortByAvailable],
  )

  const counts = useMemo(
    () => ({
      usable: usable.length,
      plus: usable.filter(a => matchesFilter(a, 'plus', now)).length,
      discount: usable.filter(a => matchesFilter(a, 'discount', now)).length,
      attention: usable.filter(a => matchesFilter(a, 'attention', now)).length,
    }),
    [usable, now],
  )

  const visible = useMemo(
    () => usable.filter(a => matchesFilter(a, filter, now)).filter(byQuery),
    [usable, filter, now, byQuery],
  )

  // Kept out of the default view, never out of the database. A search always
  // reaches in here too, so looking up a drained account by name still works.
  const lowAccounts = useMemo(
    () => accounts.filter(a => !isUsableAccount(a)).sort(sortByAvailable),
    [accounts, sortByAvailable],
  )
  const lowVisible = useMemo(() => lowAccounts.filter(byQuery), [lowAccounts, byQuery])
  const searching = query.trim().length > 0

  function makeActive(account: RobloxAccount) {
    setActiveAccount(account.id)
    toast.success(`${account.username} is now the fulfillment account.`)
    setDetail(null)
  }

  async function handleSave(data: AccountFormData) {
    setSaving(true)
    const wasEdit = !!editAccount
    try {
      await saveAccount({ supabase, data, editAccount, accounts })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the account.')
      setSaving(false)
      return
    }
    setSaving(false)
    setModalOpen(false)
    setEditAccount(null)
    setDetail(null)
    toast.success(wasEdit ? 'Account updated.' : 'Account added.')
    await load()
  }

  /* The only path allowed to move current_robux / reserved_robux /
     robux_cost_rate on an existing account. `adjust_account_field` records
     who, when, old and new — a raw UPDATE on those columns would bypass that
     audit trail and desynchronise the reservation ledger. */
  async function handleAdjust(
    field: 'current_robux' | 'reserved_robux' | 'robux_cost_rate',
    newValue: number,
    reason: string,
  ) {
    if (!editAccount) return
    const { error } = await supabase.rpc('adjust_account_field', {
      p_account_id: editAccount.id,
      p_field: field,
      p_new_value: newValue,
      p_reason: reason,
    })
    if (error) throw error
    setEditAccount(prev => (prev ? { ...prev, [field]: newValue } : prev))
    toast.success('Adjustment recorded with audit trail.')
    await load()
  }

  const detailReservations = detail ? (reservationsByAccount.get(detail.id) ?? []) : []

  const FILTER_CHIPS: ReadonlyArray<{ value: AccountFilter; label: string; count: number }> = [
    { value: 'usable', label: 'Usable', count: counts.usable },
    { value: 'plus', label: 'Plus', count: counts.plus },
    { value: 'discount', label: 'Discounted', count: counts.discount },
    { value: 'attention', label: 'Attention', count: counts.attention },
  ]

  function renderGrid(list: RobloxAccount[], dim?: boolean) {
    return (
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {list.map(account => (
          <AccountTile
            key={account.id}
            account={account}
            active={account.id === activeId}
            openOrders={reservationsByAccount.get(account.id)?.length ?? 0}
            scaleMax={scaleMax}
            now={now}
            dim={dim}
            onOpen={() => setDetail(account)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Inventory position ─────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-3 lg:px-4">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-10">
            {[
              {
                label: 'Available now',
                value: `${totals.available.toLocaleString()} R$`,
                tone: 'text-[var(--ok)]',
              },
              {
                label: 'Reserved',
                value: `${totals.reserved.toLocaleString()} R$`,
                tone: 'text-[var(--text-2)]',
              },
              {
                label: 'Usable accounts',
                value: `${totals.ready} of ${accounts.length}`,
                tone: 'text-[var(--text)]',
              },
              {
                label: 'Stock value',
                value: formatPHPCompact(totals.value),
                tone: 'text-[var(--text)]',
              },
            ].map(cell => (
              <div key={cell.label}>
                <dt className="ops-label">{cell.label}</dt>
                <dd className={cn('num mt-0.5 text-[17px] font-semibold', cell.tone)}>
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>

          <Button
            intent="primary"
            size="md"
            onClick={() => {
              setEditAccount(null)
              setModalOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add account
          </Button>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2.5 lg:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[320px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-3)]"
              aria-hidden
            />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search accounts or Chrome profiles"
              aria-label="Search accounts"
              className="h-9 pl-8"
            />
          </div>

          <div className="ops-scroll flex gap-1.5 overflow-x-auto">
            {FILTER_CHIPS.map(({ value, label, count }) => {
              const active = value === filter
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors',
                    active
                      ? 'bg-[var(--accent-wash)] text-[var(--accent)]'
                      : 'text-[var(--text-3)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]',
                    !active && count === 0 && 'opacity-40',
                  )}
                >
                  {label}
                  <span className="num text-[11.5px] opacity-75">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Usable accounts ────────────────────────────────────────────── */}
      <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 lg:px-4">
        {loading && accounts.length === 0 ? (
          <SkeletonRows rows={8} />
        ) : visible.length === 0 ? (
          <Empty
            title={searching ? 'No usable accounts match' : 'Nothing spendable in this filter'}
            body={
              searching
                ? `Search covers the Roblox username and the Chrome profile. Accounts under ${USABLE_MIN_ROBUX} R$ are in the drawer below.`
                : `Every account is at or under ${USABLE_MIN_ROBUX - 1} R$ available — open the drawer below, or add a restocked account.`
            }
          />
        ) : (
          renderGrid(visible)
        )}
      </div>

      {/* ── Low / empty drawer ───────────────────────────────────────────
          Drained accounts are counted and one click away, but they never
          push the six that can take an order off the top of the screen.
          Docking the disclosure to the bottom of the region also means the
          page reads as a deliberate two-zone workspace instead of a short
          grid trailing off into empty space. */}
      {lowAccounts.length > 0 && (
        <section
          className={cn(
            'flex min-h-0 shrink-0 flex-col border-t border-[var(--line-strong)] bg-[var(--pane)]',
            showLow && 'max-h-[55%]',
          )}
        >
          <button
            type="button"
            onClick={() => setShowLow(o => !o)}
            aria-expanded={showLow}
            className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface)] lg:px-4"
          >
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-[var(--text-3)] transition-transform',
                showLow && 'rotate-90',
              )}
              aria-hidden
            />
            <span className="text-[13px] font-semibold text-[var(--text-2)]">
              Low / empty accounts
            </span>
            <span className="num text-[12.5px] text-[var(--text-3)]">{lowAccounts.length}</span>

            {/* A search matching only drained accounts would otherwise look
                like "no results" while this drawer sits closed. */}
            {searching && lowVisible.length > 0 && !showLow && (
              <span className="num text-[12px] text-[var(--accent)]">
                {lowVisible.length} match{lowVisible.length !== 1 ? 'es' : ''}
              </span>
            )}

            <span className="ml-auto hidden text-[11.5px] text-[var(--text-3)] sm:inline">
              under {USABLE_MIN_ROBUX} R$ available
            </span>
          </button>

          {showLow && (
            <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 lg:px-4">
              {lowVisible.length === 0 ? (
                <Empty title="None match your search" />
              ) : (
                renderGrid(lowVisible, true)
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────────── */}
      {detail && (
        <Overlay
          open
          onClose={() => setDetail(null)}
          title={detail.username}
          subtitle={
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="capitalize">{detail.status}</span>
              {detail.chrome_profile && <span>· {detail.chrome_profile}</span>}
            </span>
          }
          footer={
            <>
              <a
                href={`/legacy/accounts/${detail.id}`}
                className="mr-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
              >
                Full account record
                <ExternalLink className="size-3" aria-hidden />
              </a>
              <Button
                intent="neutral"
                size="lg"
                onClick={() => {
                  // The sheet sits above the form's layer; leaving it open
                  // would cover the form it just launched.
                  setEditAccount(detail)
                  setDetail(null)
                  setModalOpen(true)
                }}
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
              <Button
                intent={detail.id === activeId ? 'neutral' : 'primary'}
                size="lg"
                disabled={detail.id === activeId || detail.status !== 'active'}
                onClick={() => makeActive(detail)}
              >
                {detail.id === activeId ? (
                  <>
                    <Check className="size-3.5" aria-hidden /> Active account
                  </>
                ) : (
                  'Use for fulfillment'
                )}
              </Button>
            </>
          }
        >
          <DetailBody account={detail} reservations={detailReservations} now={now} />
        </Overlay>
      )}

      {/* The legacy account form, reused verbatim — it owns cost-basis
          derivation and the capital event a stock purchase records, and must
          not be reimplemented here. It renders in the legacy theme because it
          portals out of .ops-root. */}
      {modalOpen && (
        <AccountModal
          open
          account={editAccount}
          loading={saving}
          onClose={() => {
            setModalOpen(false)
            setEditAccount(null)
          }}
          onSave={handleSave}
          onAdjust={editAccount ? handleAdjust : undefined}
        />
      )}
    </div>
  )
}
