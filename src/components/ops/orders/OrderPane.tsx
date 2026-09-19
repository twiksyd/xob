'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { RobloxAccount } from '@/lib/types/database'
import { formatPHPCompact } from '@/lib/utils/pricing'
import { getAvailableRobux } from '@/lib/utils/accounts'
import {
  completionBlocker,
  groupLinesByGame,
  isReadyToComplete,
  isUnassigned,
  itemLines,
  queueState,
  relativeAge,
  requiredRobux,
  ticketName,
  ticketRef,
} from '@/lib/ops/queue'
import { Button, Pill } from '../ui'
import { Avatar } from '../accounts/parts'
import { queueStateMeta } from './QueuePane'
import { cn } from '@/lib/utils'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          },
          () => {},
        )
      }}
      className="group flex min-w-0 items-center gap-1.5 text-left"
      aria-label={`Copy ${label}`}
    >
      <span className="truncate text-[13.5px] font-medium text-[var(--text)]">{value}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-[var(--ok)]" aria-hidden />
      ) : (
        <Copy
          className="size-3.5 shrink-0 text-[var(--text-3)] opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      )}
    </button>
  )
}

/* The unselected desktop state. The workspace structure stays intact — this
   fills the stage rather than letting the queue expand across the screen — and
   it teaches the shortcuts that make the queue fast. */
function StageEmpty({
  waiting,
  needsAccount,
  onBack,
}: {
  waiting: number
  needsAccount: number
  onBack: () => void
}) {
  const keys: Array<[string, string]> = [
    ['J / K', 'move through the queue'],
    ['A', 'assign the active account'],
    ['P', 'mark paid'],
    ['C', 'complete'],
    ['N', 'new order'],
  ]

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[380px]">
        <p className="text-[17px] font-semibold text-[var(--text-2)]">
          Select an order to start processing
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-3)]">
          {waiting === 0
            ? 'The queue is clear. New BudgetWise checkouts arrive here automatically.'
            : needsAccount > 0
              ? `${waiting} waiting, ${needsAccount} still need an account. The top of the queue is always the one to do next.`
              : `${waiting} waiting. The top of the queue is always the one to do next.`}
        </p>

        <dl className="mt-6 space-y-2 border-t border-[var(--line)] pt-4">
          {keys.map(([key, what]) => (
            <div key={key} className="flex items-center gap-3">
              <dt className="num w-16 shrink-0 text-[11.5px] font-semibold text-[var(--text-2)]">
                {key}
              </dt>
              <dd className="text-[12.5px] text-[var(--text-3)]">{what}</dd>
            </div>
          ))}
        </dl>

        <Button intent="neutral" size="lg" className="mt-6 lg:hidden" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to queue
        </Button>
      </div>
    </div>
  )
}

function Menu({
  order,
  onEdit,
  onItemAssign,
  onRemove,
  onRefund,
  onDelete,
}: {
  order: LogicalOrder
  onEdit: () => void
  onItemAssign: () => void
  onRemove: () => void
  onRefund: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const item =
    'flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium transition-colors'

  return (
    <div className="relative">
      <Button
        intent="quiet"
        size="lg"
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        aria-expanded={open}
        className="px-2.5"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="ops-enter absolute bottom-[calc(100%+6px)] right-0 z-20 w-56 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--raised)] p-1 shadow-[0_18px_44px_rgba(0,0,0,0.6)]">
            {order.source === 'budgetwise' ? (
              <button
                type="button"
                className={cn(item, 'text-[var(--text)] hover:bg-[var(--surface-hi)]')}
                onClick={() => {
                  setOpen(false)
                  onItemAssign()
                }}
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Assign items individually
              </button>
            ) : (
              <button
                type="button"
                className={cn(item, 'text-[var(--text)] hover:bg-[var(--surface-hi)]')}
                onClick={() => {
                  setOpen(false)
                  onEdit()
                }}
              >
                <Pencil className="size-4" aria-hidden />
                Edit order
              </button>
            )}
            <button
              type="button"
              className={cn(
                item,
                'text-[var(--text-2)] hover:bg-[var(--surface-hi)] hover:text-[var(--text)]',
              )}
              onClick={() => {
                setOpen(false)
                onRefund()
              }}
            >
              <XCircle className="size-4" aria-hidden />
              Mark refunded
            </button>
            <div className="my-1 h-px bg-[var(--line)]" />
            <button
              type="button"
              className={cn(
                item,
                'text-[var(--text-2)] hover:bg-[var(--surface-hi)] hover:text-[var(--text)]',
              )}
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Remove from queue
            </button>
            <button
              type="button"
              className={cn(item, 'text-[var(--bad)] hover:bg-[var(--bad-wash)]')}
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete permanently
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function OrderPane({
  order,
  accounts,
  activeAccount,
  nowMs,
  busy,
  waiting,
  needsAccount,
  onBack,
  onAssignActive,
  onMarkPaid,
  onComplete,
  onEdit,
  onItemAssign,
  onRemove,
  onRefund,
  onDelete,
  onPickAccount,
}: {
  order: LogicalOrder | null
  accounts: RobloxAccount[]
  activeAccount: RobloxAccount | null
  nowMs: number
  busy: boolean
  waiting: number
  needsAccount: number
  onBack: () => void
  onAssignActive: () => void
  onMarkPaid: () => void
  onComplete: () => void
  onEdit: () => void
  onItemAssign: () => void
  onRemove: () => void
  onRefund: () => void
  onDelete: () => void
  onPickAccount: () => void
}) {
  if (!order) {
    return <StageEmpty waiting={waiting} needsAccount={needsAccount} onBack={onBack} />
  }

  const meta = queueStateMeta(queueState(order, nowMs))
  const byGame = groupLinesByGame(itemLines(order.items))
  const needs = requiredRobux(order)
  const ready = isReadyToComplete(order)
  const unassigned = isUnassigned(order)
  const blocker =
    !ready && order.status === 'paid' && !order.hasMixedStatus ? completionBlocker(order) : null

  // Which accounts this order is actually being fulfilled from. BudgetWise
  // items each carry their own; XOB orders carry one on the header row. The
  // live accounts list is preferred over the row's joined copy so balances are
  // current, but an assignment to an account that has since gone inactive
  // still resolves through the join rather than disappearing from the panel.
  const accountById = new Map(accounts.map(a => [a.id, a]))
  const assignedIds =
    order.source === 'budgetwise'
      ? order.items.map(i => i.robloxAccountId).filter((id): id is string => !!id)
      : order.robloxAccountId
        ? [order.robloxAccountId]
        : []

  const fulfilling = Array.from(new Set(assignedIds))
    .map(
      id =>
        accountById.get(id) ??
        order.items.find(i => i.robloxAccountId === id)?.account ??
        (order.account?.id === id ? order.account : null),
    )
    .filter((a): a is RobloxAccount => !!a)

  const activeCovers = activeAccount ? getAvailableRobux(activeAccount) >= needs : false
  const afterAssign = activeAccount ? getAvailableRobux(activeAccount) - needs : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Header ─────────────────────────────────────────────────────
          Ordered the way the operator reads it: who it is, then where it is
          delivered, then the paperwork. */}
      <header className="shrink-0 px-4 pb-3 pt-3.5 lg:px-6 lg:pt-4">
        <div className="flex items-start gap-3">
          <Button
            intent="quiet"
            size="md"
            onClick={onBack}
            aria-label="Back to queue"
            className="-ml-1 mt-0.5 px-2 lg:hidden"
          >
            <ArrowLeft className="size-4.5" aria-hidden />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 truncate text-[22px] font-semibold leading-[1.15] text-[var(--text)] lg:text-[26px]">
                {ticketName(order)}
              </h1>
              {/* Status leads as a solid chip, not a dot — it is the single
                  fact the operator needs first: what does this order need. */}
              <Pill tone={meta.tone} className="px-2 py-1 text-[11px]">
                {meta.label}
              </Pill>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-3)]">
              <Pill tone={order.source === 'budgetwise' ? 'blue' : 'neutral'}>
                {order.source === 'budgetwise' ? 'BudgetWise' : 'XOB'}
              </Pill>
              <span className="num">{ticketRef(order)}</span>
              <span aria-hidden className="text-[var(--line-strong)]">
                &middot;
              </span>
              <span className="num">{relativeAge(nowMs, order.createdAt)} old</span>
              <span aria-hidden className="text-[var(--line-strong)]">
                &middot;
              </span>
              <span className="capitalize">{order.paymentMethod}</span>
            </div>
          </div>

          {/* The delivery target sits in the header, not buried in the body:
              it is the second thing looked at and the one thing that gets
              copied into Roblox on every single order. */}
          {order.buyerRobloxUsername && (
            <div className="hidden shrink-0 items-center gap-2.5 rounded-[var(--radius)] bg-[var(--bg)] px-3 py-2 sm:flex">
              <span className="ops-label shrink-0">Deliver to</span>
              <CopyField label="Roblox username" value={order.buyerRobloxUsername} />
            </div>
          )}
        </div>

        {order.buyerRobloxUsername && (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-[var(--radius)] bg-[var(--bg)] px-3 py-2 sm:hidden">
            <span className="ops-label shrink-0">Deliver to</span>
            <CopyField label="Roblox username" value={order.buyerRobloxUsername} />
          </div>
        )}
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 lg:px-6">
        {/* Two columns from `lg`: the items the operator works through on the
            left, the money and the account it comes from on the right. The
            stage is the widest region on screen, so capping this at a single
            narrow column left most of it empty. */}
        {/* Capped: on a 1728px screen an uncapped items column puts the
            gamepass name and its price ~700px apart, which is unreadable. */}
        <div className="grid w-full max-w-[1020px] gap-x-7 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <div className="min-w-0 lg:col-start-1">
            {/* Items. Grouped by game so the operator works through one Roblox
                game at a time, which is how the tabs actually get opened. */}
            <section>
            <h2 className="ops-label mb-2">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </h2>
              {byGame.map(({ game, lines }) => (
              <div key={game} className="mb-4 last:mb-0">
                <p className="mb-1 text-[12px] font-semibold text-[var(--text-3)]">{game}</p>
                <ul className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
                  {lines.map(line => {
                    const assigned = line.accountIds.filter(Boolean).length
                    const partial = order.source === 'budgetwise' && assigned < line.qty
                    return (
                      <li key={line.key} className="flex items-center gap-3 py-2.5">
                        <span className="num w-8 shrink-0 text-[13px] font-semibold text-[var(--text-3)]">
                          {line.qty}&times;
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] leading-tight text-[var(--text)]">
                            {line.gamepassName}
                          </span>
                          {partial && (
                            <span className="num mt-1 block text-[12px] leading-tight text-[var(--accent)]">
                              {line.qty - assigned} of {line.qty} still need an account
                            </span>
                          )}
                        </span>
                        <span className="num shrink-0 text-right text-[13px] text-[var(--text-3)]">
                          {line.robux.toLocaleString()} R$
                        </span>
                        <span className="num w-20 shrink-0 text-right text-[14px] font-semibold text-[var(--text)]">
                          {formatPHPCompact(line.price)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            </section>
          </div>

          {/* Money and fulfillment. Figures separated by rules rather than
              boxed into cards — the numbers are the thing, not the containers.
              They ride beside the items once the stage is wide enough. */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            {/* Robux leads: it is the figure that decides which account can
                take this order. Profit is real but it never competes with
                fulfillment information for attention. */}
            {/* Label-left / figure-right rows rather than side-by-side
                columns: in a 280px rail the column labels wrapped. Robux
                leads at display size because it is the figure that decides
                which account can take this order; profit is real but stays
                subordinate to fulfillment information. */}
            <dl className="mt-5 border-y border-[var(--line)] py-2.5 lg:mt-0">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="ops-label">{unassigned ? 'Robux needed' : 'Robux'}</dt>
                <dd className="num text-[26px] font-semibold leading-none text-[var(--text)]">
                  {(unassigned && needs > 0 ? needs : order.totalRobux).toLocaleString()}
                  <span className="ml-1 text-[0.55em] opacity-55">R$</span>
                </dd>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                <dt className="ops-label">Customer pays</dt>
                <dd className="num text-[17px] font-semibold leading-none text-[var(--text)]">
                  {formatPHPCompact(order.totalSellingPrice)}
                </dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <dt className="ops-label">Profit</dt>
                <dd
                  className={cn(
                    'num text-[13px] font-semibold leading-none',
                    order.totalProfit >= 0 ? 'text-[var(--ok)]' : 'text-[var(--bad)]',
                  )}
                >
                  {formatPHPCompact(order.totalProfit)}
                </dd>
              </div>
            </dl>

            {/* Fulfillment */}
            <section className="mt-5">
              <h2 className="ops-label mb-2">Fulfilled from</h2>
            {fulfilling.length === 0 ? (
              <button
                type="button"
                onClick={onPickAccount}
                className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--accent-line)] bg-[var(--accent-wash)] px-3.5 py-3 text-left transition-colors hover:bg-[rgba(167,139,250,0.17)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-[var(--accent)]">
                    No account assigned yet
                  </span>
                  <span className="num mt-1 block text-[12.5px] text-[var(--text-3)]">
                    Needs {needs.toLocaleString()} R$
                  </span>
                </span>
              </button>
            ) : (
              <ul className="space-y-1.5">
                {fulfilling.map(account => (
                  <li
                    key={account.id}
                    className="flex items-center gap-3 rounded-[var(--radius)] bg-[var(--bg)] px-3 py-2.5"
                  >
                    <Avatar account={account} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-[var(--text)]">
                        {account.username}
                      </span>
                      {account.chrome_profile && (
                        <span className="block truncate text-[12px] text-[var(--text-3)]">
                          {account.chrome_profile}
                        </span>
                      )}
                    </span>
                    <span className="num shrink-0 text-[13px] text-[var(--text-2)]">
                      {getAvailableRobux(account).toLocaleString()} R$ left
                    </span>
                  </li>
                ))}
                {unassigned && (
                  <li className="num px-3 pt-1 text-[12.5px] text-[var(--accent)]">
                    {needs.toLocaleString()} R$ still unassigned
                  </li>
                )}
              </ul>
              )}
            </section>

            {order.notes && (
              <section className="mt-5">
                <h2 className="ops-label mb-2">Notes</h2>
                <p className="whitespace-pre-line rounded-[var(--radius)] bg-[var(--bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--text-2)]">
                  {order.notes}
                </p>
              </section>
            )}

            {blocker && (
              <p className="mt-5 rounded-[var(--radius)] bg-[var(--accent-wash)] px-3.5 py-2.5 text-[12.5px] text-[var(--accent)]">
                {blocker}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3 lg:px-7">
        <div className="w-full max-w-[760px] 2xl:max-w-none">
          {unassigned && activeAccount && (
            <p className="num mb-2 text-[12.5px] text-[var(--text-3)]">
              {activeAccount.username}: {getAvailableRobux(activeAccount).toLocaleString()} R$ available
              {needs > 0 && (
                <>
                  {' → '}
                  <span className={activeCovers ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
                    {afterAssign.toLocaleString()} R$ after this order
                  </span>
                </>
              )}
            </p>
          )}

          <div className="flex items-center gap-2">
            {unassigned && (
              <Button
                intent="primary"
                size="lg"
                busy={busy}
                disabled={!activeAccount || !activeCovers}
                onClick={onAssignActive}
                className="min-w-0 flex-1 sm:max-w-[280px] sm:flex-none sm:px-6"
                title={
                  !activeAccount
                    ? 'Choose a fulfillment account first'
                    : !activeCovers
                      ? `${activeAccount.username} does not have ${needs.toLocaleString()} R$ available`
                      : undefined
                }
              >
                <span className="truncate">
                  {activeAccount ? `Use ${activeAccount.username}` : 'Choose an account'}
                </span>
              </Button>
            )}

            {order.status === 'pending' && !order.hasMixedStatus && (
              <Button
                intent={unassigned ? 'neutral' : 'primary'}
                size="lg"
                busy={busy}
                onClick={onMarkPaid}
                className="flex-1 sm:max-w-[200px] sm:flex-none sm:px-6"
              >
                Mark paid
              </Button>
            )}

            {ready && (
              <Button
                intent="positive"
                size="lg"
                busy={busy}
                onClick={onComplete}
                className="flex-1 sm:max-w-[220px] sm:flex-none sm:px-6"
              >
                Complete order
              </Button>
            )}

            {!unassigned && order.status !== 'pending' && !ready && (
              <span className="text-[12.5px] text-[var(--text-3)]">No action available</span>
            )}

            <span className="ml-auto" />
            <Menu
              order={order}
              onEdit={onEdit}
              onItemAssign={onItemAssign}
              onRemove={onRemove}
              onRefund={onRefund}
              onDelete={onDelete}
            />
          </div>
        </div>
      </footer>
    </div>
  )
}
