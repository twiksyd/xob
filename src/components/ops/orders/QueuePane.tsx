'use client'

import { Search, Check } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import { formatPHPCompact } from '@/lib/utils/pricing'
import {
  queueState,
  ticketName,
  ticketRef,
  relativeAge,
  requiredRobux,
  type QueueState,
} from '@/lib/ops/queue'
import { Button, Empty, SkeletonRows, type Tone } from '../ui'
import { cn } from '@/lib/utils'

export type QueueFilter = 'all' | 'unassigned' | 'ready' | 'pending' | 'stalled'

export const QUEUE_FILTERS: ReadonlyArray<{ value: QueueFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Needs account' },
  { value: 'ready', label: 'Ready' },
  { value: 'pending', label: 'Unpaid' },
  { value: 'stalled', label: 'Stalled' },
]

const STATE_META: Record<QueueState, { label: string; tone: Tone; bar: string; fg: string }> = {
  unassigned: {
    label: 'Needs account',
    tone: 'accent',
    bar: 'var(--accent)',
    fg: 'text-[var(--text-2)]',
  },
  ready: { label: 'Ready', tone: 'ok', bar: 'var(--ok)', fg: 'text-[var(--ok)]' },
  'awaiting-payment': {
    label: 'Unpaid',
    tone: 'neutral',
    bar: 'var(--line-strong)',
    fg: 'text-[var(--text-3)]',
  },
  stalled: { label: 'Stalled', tone: 'bad', bar: 'var(--bad)', fg: 'text-[var(--bad)]' },
  working: { label: 'In progress', tone: 'blue', bar: 'var(--blue)', fg: 'text-[var(--blue)]' },
}

export function queueStateMeta(state: QueueState) {
  return STATE_META[state]
}

// A filter chip already says what every row under it shares — repeating
// "Needs account" down 274 rows is noise, not information. Only suppressed
// when the row's own computed state genuinely matches the chip: a stalled
// row that is also unassigned still displays as unassigned (state priority
// puts assignment first), so under the Stalled filter its label stays put.
const FILTER_STATE: Partial<Record<QueueFilter, QueueState>> = {
  unassigned: 'unassigned',
  ready: 'ready',
  pending: 'awaiting-payment',
  stalled: 'stalled',
}

/* One ticket. Three things carry the row — the customer's name, the status and
   the money — and everything else is secondary and sized accordingly. The bar
   on the left edge makes the shape of the queue readable without reading any
   text at all. */
function QueueRow({
  order,
  nowMs,
  filter,
  current,
  selected,
  selecting,
  busy,
  flash,
  onOpen,
  onToggleSelect,
}: {
  order: LogicalOrder
  nowMs: number
  filter: QueueFilter
  current: boolean
  selected: boolean
  selecting: boolean
  busy: boolean
  flash?: 'ok' | 'bad'
  onOpen: () => void
  onToggleSelect: (shiftKey: boolean) => void
}) {
  const state = queueState(order, nowMs)
  const meta = STATE_META[state]
  const need = requiredRobux(order)
  const showLabel = FILTER_STATE[filter] !== state

  return (
    <div
      className={cn(
        'group relative flex items-stretch transition-colors',
        // Accent-wash rather than the neutral surface-hi tint: most of a
        // real queue sits in the "needs account" state, whose own left bar
        // is already accent-colored, so a same-hue edge stripe alone left
        // the open row nearly invisible against its neighbors. Tinting the
        // whole row keeps "this is what's open" legible no matter what
        // color the row's own status happens to be.
        current ? 'bg-[var(--accent-wash)]' : 'hover:bg-[var(--surface)]',
        busy && 'opacity-55',
        flash === 'ok' && 'ops-flash-ok',
        flash === 'bad' && 'ops-flash-bad',
      )}
    >
      {/* The row that is actually open always reads as accent, regardless of
          its status color — "this is what I'm working on" outranks "what
          state it's in," which the text line just beneath still carries. */}
      <span
        aria-hidden
        className={cn('shrink-0', current ? 'w-1' : 'w-[3px]')}
        style={{ background: current ? 'var(--accent)' : meta.bar }}
      />

      {/* Selection stays out of the way until it is wanted. */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onToggleSelect(e.shiftKey)
        }}
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${ticketName(order)}` : `Select ${ticketName(order)}`}
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden transition-[width,opacity] duration-100',
          selecting || selected
            ? 'w-8 opacity-100'
            : 'w-0 opacity-0 focus-visible:w-8 focus-visible:opacity-100 lg:group-hover:w-8 lg:group-hover:opacity-100',
        )}
      >
        <span
          className={cn(
            'grid size-[17px] place-items-center rounded-[5px] border transition-colors',
            selected
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
              : 'border-[var(--line-strong)]',
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold leading-tight text-[var(--text)]">
              {ticketName(order)}
            </span>
            {order.hasMixedStatus && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--bad)]">
                mixed
              </span>
            )}
          </span>

          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight text-[var(--text-3)]">
            {showLabel && (
              <>
                <span className={cn('shrink-0 font-medium', meta.fg)}>{meta.label}</span>
                <span aria-hidden className="text-[var(--line-strong)]">
                  &middot;
                </span>
              </>
            )}
            <span className="num shrink-0">{order.items.length}</span>
            <span className="shrink-0">item{order.items.length !== 1 ? 's' : ''}</span>
            <span aria-hidden className="text-[var(--line-strong)]">
              &middot;
            </span>
            <span className="num shrink-0">{relativeAge(nowMs, order.createdAt)}</span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="num block text-[14px] font-semibold leading-tight text-[var(--text)]">
            {formatPHPCompact(order.totalSellingPrice)}
          </span>
          <span className="num mt-1 block text-[12px] leading-tight text-[var(--text-3)]">
            {(need > 0 ? need : order.totalRobux).toLocaleString()} R$
          </span>
        </span>
      </button>

      {/* The reference is real but rarely what is being looked for, so it shows
          on hover rather than competing in all 320 rows. */}
      <span className="num pointer-events-none absolute bottom-1 right-3.5 hidden text-[10px] text-[var(--text-3)] opacity-0 transition-opacity lg:block lg:group-hover:opacity-70">
        {ticketRef(order)}
      </span>
    </div>
  )
}

export default function QueuePane({
  orders,
  counts,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  nowMs,
  loading,
  capped,
  currentKey,
  selectedKeys,
  busyKey,
  flashes,
  onOpen,
  onToggleSelect,
  onClearSelection,
  selectionBar,
}: {
  orders: LogicalOrder[]
  counts: Record<QueueFilter, number>
  filter: QueueFilter
  onFilterChange: (filter: QueueFilter) => void
  search: string
  onSearchChange: (value: string) => void
  nowMs: number
  loading: boolean
  capped: boolean
  currentKey: string | null
  selectedKeys: Set<string>
  busyKey: string | null
  flashes: Record<string, 'ok' | 'bad'>
  onOpen: (order: LogicalOrder) => void
  onToggleSelect: (order: LogicalOrder, index: number, shiftKey: boolean) => void
  onClearSelection: () => void
  selectionBar?: React.ReactNode
}) {
  const selecting = selectedKeys.size > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-2.5 pt-3">
        <div className="flex items-baseline justify-between gap-2 pb-2.5">
          <h2 className="ops-label">Order queue</h2>
          <span className="num text-[12px] text-[var(--text-3)]">{counts.all}</span>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-3)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search customer or reference"
            aria-label="Search the queue"
            className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--bg)] pl-8 pr-3 text-[13px] text-[var(--text)] outline-none transition-colors hover:border-[var(--line-strong)] focus:border-[var(--accent-line)]"
          />
        </div>

        {/* Filters carry their counts: the shape of the queue is readable
            without opening any of them. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUEUE_FILTERS.map(({ value, label }) => {
            const active = value === filter
            const count = counts[value] ?? 0
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                aria-pressed={active}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors',
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

      {selecting && (
        <div className="ops-enter flex shrink-0 flex-wrap items-center gap-2 border-y border-[var(--accent-line)] bg-[var(--accent-wash)] px-3 py-2">
          <span className="num text-[12.5px] font-semibold text-[var(--accent)]">
            {selectedKeys.size} selected
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {selectionBar}
            <Button intent="quiet" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* The list is the only thing in this pane that scrolls. */}
      <div className="ops-scroll min-h-0 flex-1 divide-y divide-[var(--line-soft)] overflow-y-auto border-t border-[var(--line)]">
        {loading && orders.length === 0 ? (
          <SkeletonRows rows={9} />
        ) : orders.length === 0 ? (
          <Empty
            title={search.trim() ? 'No orders match' : 'Queue is clear'}
            body={
              search.trim()
                ? 'Search covers customer name, Roblox username and order reference.'
                : 'New BudgetWise checkouts arrive here automatically.'
            }
          />
        ) : (
          orders.map((order, index) => (
            <QueueRow
              key={order.logicalKey}
              order={order}
              nowMs={nowMs}
              filter={filter}
              current={order.logicalKey === currentKey}
              selected={selectedKeys.has(order.logicalKey)}
              selecting={selecting}
              busy={busyKey === order.logicalKey}
              flash={flashes[order.logicalKey]}
              onOpen={() => onOpen(order)}
              onToggleSelect={shiftKey => onToggleSelect(order, index, shiftKey)}
            />
          ))
        )}

        {capped && orders.length > 0 && (
          <p className="px-3 py-3 text-[11.5px] leading-relaxed text-[var(--text-3)]">
            Showing the most recent orders &mdash; the raw fetch is capped. Older history remains in
            the database.
          </p>
        )}
      </div>
    </div>
  )
}
