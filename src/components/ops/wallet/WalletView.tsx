'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfDay, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { WalletTransaction } from '@/lib/types/database'
import { formatPHPCompact } from '@/lib/utils/pricing'
import { useToast } from '../feedback'
import { Button, Empty, Field, Input, Overlay, Segmented, SkeletonRows } from '../ui'
import { cn } from '@/lib/utils'

/* The cash side of the business, kept to what an operator acts on: what is in
   the wallet, what moved recently, and a fast way to log something that moved
   outside the app. Completed orders post here automatically through
   transition_order — nothing on this page writes those rows.

   Below `lg` this is a single stacked column: position, period, ledger, in
   that order. From `lg` the position becomes a standing sidebar (mirroring
   the account rail in Orders and the master list in Accounts) and the period
   + ledger take the rest of the width, which is where a 1728px screen was
   previously leaving several hundred pixels of nothing either side of an
   860px column.

   Deeper analysis (full ledger, capital planning, savings allocation) lives on
   the legacy Transactions and Wallet surfaces and is untouched. */

const INCOME_CATEGORIES = ['Sale', 'Bonus', 'Deposit', 'Other'] as const
const EXPENSE_CATEGORIES = ['Robux Purchase', 'Operating Cost', 'Refund Issued', 'Withdrawal', 'Other'] as const

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All' },
] as const

type Range = (typeof RANGES)[number]['value']

function dayLabel(iso: string): string {
  const date = new Date(iso)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

/* Daily net movement over the last two weeks. It answers one question — is
   the balance trending up or down, and by how much — so each bar carries a
   title (date + signed amount) and the strip is bookended with its date
   range and a 14-day net total, rather than being a decoration next to the
   balance. */
function NetTrend({ transactions }: { transactions: WalletTransaction[] }) {
  const days = useMemo(() => {
    const buckets = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      buckets.set(format(subDays(new Date(), i), 'yyyy-MM-dd'), 0)
    }
    const cutoff = startOfDay(subDays(new Date(), 13)).getTime()
    for (const t of transactions) {
      const time = new Date(t.created_at).getTime()
      if (time < cutoff) continue
      const key = format(new Date(t.created_at), 'yyyy-MM-dd')
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.amount)
    }
    return Array.from(buckets.entries()).map(([day, net]) => ({ day, net }))
  }, [transactions])

  const peak = Math.max(1, ...days.map(d => Math.abs(d.net)))
  const totalNet = days.reduce((sum, d) => sum + d.net, 0)
  const first = days[0]
  const last = days[days.length - 1]

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="ops-label">Last 14 days</p>
        <span
          className={cn(
            'num text-[12px] font-semibold',
            totalNet >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
          )}
        >
          {totalNet >= 0 ? '+' : '−'}
          {formatPHPCompact(Math.abs(totalNet))}
        </span>
      </div>

      <div className="mt-2 flex h-14 items-end gap-[3px] lg:h-16">
        {days.map(({ day, net }) => {
          const height = Math.max(3, (Math.abs(net) / peak) * 100)
          return (
            <span
              key={day}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${format(parseISO(day), 'MMM d')}: ${net >= 0 ? '+' : '−'}${formatPHPCompact(Math.abs(net))}`}
            >
              <span
                className="w-full rounded-[2px]"
                style={{
                  height: `${height}%`,
                  background: net >= 0 ? 'var(--ok)' : 'var(--bad)',
                  opacity: net === 0 ? 0.18 : 0.8,
                }}
              />
            </span>
          )
        })}
      </div>

      {first && last && (
        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-3)]">
          <span>{format(parseISO(first.day), 'MMM d')}</span>
          <span>{format(parseISO(last.day), 'MMM d')}</span>
        </div>
      )}
    </div>
  )
}

export default function WalletView() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('30')
  const [entryOpen, setEntryOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, summaryRes] = await Promise.all([
      supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.rpc('get_wallet_summary').single(),
    ])

    if (txRes.error) toast.error(`Could not load the ledger: ${txRes.error.message}`)
    else if (txRes.data) setTransactions(txRes.data as WalletTransaction[])

    if (summaryRes.error) toast.error(`Could not load the balance: ${summaryRes.error.message}`)
    else if (summaryRes.data) {
      const summary = summaryRes.data as { balance: number; total_income: number; total_expenses: number }
      setBalance(Number(summary.balance))
      setTotalIncome(Number(summary.total_income))
      setTotalExpenses(Number(summary.total_expenses))
    }

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = useMemo(() => {
    if (range === 'all') return transactions
    const cutoff = startOfDay(subDays(new Date(), Number(range) - 1)).getTime()
    return transactions.filter(t => new Date(t.created_at).getTime() >= cutoff)
  }, [transactions, range])

  const periodIn = visible.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const periodOut = visible.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const grouped = useMemo(() => {
    const map = new Map<string, WalletTransaction[]>()
    for (const t of visible) {
      const key = format(new Date(t.created_at), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return Array.from(map.entries())
  }, [visible])

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const parsedAmount = Number.parseFloat(amount)
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0

  async function saveEntry() {
    if (!canSave) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Sign carries the direction — the ledger stores a signed amount and
      // every balance in the app is derived from it.
      const { error } = await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        type: kind,
        amount: kind === 'income' ? parsedAmount : -parsedAmount,
        category: category || 'Other',
        description: description || null,
      })
      if (error) throw new Error(error.message)

      toast.success(`${kind === 'income' ? 'Income' : 'Expense'} of ${formatPHPCompact(parsedAmount)} logged.`)
      setAmount('')
      setCategory('')
      setDescription('')
      setEntryOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ── Position ─────────────────────────────────────────────────────
          Below `lg` this is the top of the stack. From `lg` it becomes a
          standing sidebar — same role as the fulfillment rail in Orders and
          the master list in Accounts: durable context beside the thing that
          scrolls. */}
      <section
        aria-label="Wallet position"
        className="shrink-0 border-b border-[var(--line)] px-3 py-4 lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r lg:border-[var(--line-strong)] lg:bg-[var(--pane)] lg:px-5 lg:py-5"
      >
        <div>
          <p className="ops-label">Cash on hand</p>
          <p
            className={cn(
              'num mt-1 text-[34px] font-semibold leading-none lg:text-[44px]',
              balance >= 0 ? 'text-[var(--text)]' : 'text-[var(--bad)]',
            )}
          >
            {formatPHPCompact(balance)}
          </p>
          <p className="num mt-2 text-[12px] text-[var(--text-3)]">
            <span className="text-[var(--ok)]">+{formatPHPCompact(totalIncome)}</span> in ·{' '}
            <span className="text-[var(--bad)]">−{formatPHPCompact(totalExpenses)}</span> out all time
          </p>
        </div>

        <div className="mt-5 lg:mt-7">
          <NetTrend transactions={transactions} />
        </div>

        <Button
          intent="primary"
          size="lg"
          block
          className="mt-5 lg:mt-7"
          onClick={() => setEntryOpen(true)}
        >
          <Plus className="size-4" aria-hidden />
          Log an entry
        </Button>
      </section>

      {/* ── Period + ledger ──────────────────────────────────────────────
          One flex column so the existing mobile stacking order (position,
          period, ledger) falls out for free — this is simply the second
          grid cell from `lg`, with its own header + scrolling list inside. */}
      <section aria-label="Transaction ledger" className="flex min-h-0 flex-1 flex-col lg:bg-[var(--stage)]">
        <div className="shrink-0 border-b border-[var(--line)] px-3 py-2.5 lg:px-6 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <p className="num ml-auto text-[12px] text-[var(--text-3)]">
              <span className="text-[var(--ok)]">+{formatPHPCompact(periodIn)}</span>
              {' · '}
              <span className="text-[var(--bad)]">−{formatPHPCompact(periodOut)}</span>
              {' · net '}
              <span className={periodIn - periodOut >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
                {formatPHPCompact(periodIn - periodOut)}
              </span>
            </p>
          </div>
        </div>

        <div className="ops-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="w-full px-3 pb-6 lg:mx-auto lg:max-w-[1120px] lg:px-6">
            {loading && transactions.length === 0 ? (
              <SkeletonRows rows={8} />
            ) : grouped.length === 0 ? (
              <Empty
                title="Nothing in this period"
                body="Completed orders post income here automatically. Use “Log an entry” for money that moved outside XOB."
              />
            ) : (
              grouped.map(([day, rows]) => {
                const net = rows.reduce((s, t) => s + t.amount, 0)
                return (
                  <section key={day} className="pt-4">
                    <div className="flex items-baseline justify-between gap-3 pb-1.5">
                      <h2 className="ops-label">{dayLabel(rows[0].created_at)}</h2>
                      <span
                        className={cn(
                          'num text-[11.5px] font-semibold',
                          net >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
                        )}
                      >
                        {net >= 0 ? '+' : '−'}
                        {formatPHPCompact(Math.abs(net))}
                      </span>
                    </div>

                    <ul className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                      {rows.map(t => {
                        const incoming = t.amount > 0
                        return (
                          <li key={t.id} className="flex items-center gap-2.5 py-2.5">
                            <span
                              className={cn(
                                'grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)]',
                                incoming ? 'bg-[var(--ok-wash)]' : 'bg-[var(--bad-wash)]',
                              )}
                            >
                              {incoming ? (
                                <ArrowDownLeft className="size-3.5 text-[var(--ok)]" aria-hidden />
                              ) : (
                                <ArrowUpRight className="size-3.5 text-[var(--bad)]" aria-hidden />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] text-[var(--text)]">
                                {t.description || t.category}
                              </span>
                              <span className="num block text-[11px] text-[var(--text-3)]">
                                {t.description ? `${t.category} · ` : ''}
                                {format(new Date(t.created_at), 'HH:mm')}
                              </span>
                            </span>

                            <span
                              className={cn(
                                'num shrink-0 text-[13px] font-semibold',
                                incoming ? 'text-[var(--ok)]' : 'text-[var(--text-2)]',
                              )}
                            >
                              {incoming ? '+' : '−'}
                              {formatPHPCompact(Math.abs(t.amount))}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* ── Entry ──────────────────────────────────────────────────────── */}
      {entryOpen && (
        <Overlay
          open
          onClose={() => setEntryOpen(false)}
          title="Log an entry"
          subtitle="Cash that moved outside XOB"
          width="sm"
          footer={
            <>
              <Button intent="quiet" size="lg" onClick={() => setEntryOpen(false)}>
                Cancel
              </Button>
              <Button
                intent={kind === 'income' ? 'positive' : 'primary'}
                size="lg"
                busy={saving}
                disabled={!canSave}
                onClick={() => void saveEntry()}
              >
                {kind === 'income' ? 'Add income' : 'Add expense'}
              </Button>
            </>
          }
        >
          <Segmented
            value={kind}
            onChange={next => {
              setKind(next)
              setCategory('')
            }}
            options={[
              { value: 'expense', label: 'Money out' },
              { value: 'income', label: 'Money in' },
            ]}
            className="w-full"
          />

          <Field label="Amount" className="mt-4">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="num h-12 text-[18px] font-semibold"
            />
          </Field>

          <div className="mt-3">
            <span className="ops-label mb-1.5 block">Category</span>
            <div className="flex flex-wrap gap-1">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[var(--radius-sm)] border px-2.5 text-[12px] font-semibold transition-colors',
                    category === c
                      ? 'border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent)]'
                      : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text-2)]',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Field label="Note" hint="Optional" className="mt-3">
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
            />
          </Field>
        </Overlay>
      )}
    </div>
  )
}
