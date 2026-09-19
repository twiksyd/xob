'use client'

import { useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import { formatPHPCompact } from '@/lib/utils/pricing'
import { ticketName, ticketRef, type FinalizeCandidate } from '@/lib/ops/queue'
import { Button, Overlay, Spinner } from '../ui'
import { cn } from '@/lib/utils'

/* ── Finalize ───────────────────────────────────────────────────────────────
   Catches up orders already delivered in Roblox but not yet recorded here.
   Every step still goes through the same transition_order / complete RPCs a
   manual click would use — this only sequences them, one order at a time,
   because two selected orders can draw on the same account and serialising
   keeps the progress list truthful. */

export type FinalizeState = 'waiting' | 'processing' | 'done' | 'failed'

export interface FinalizeProgressRow {
  logicalKey: string
  name: string
  state: FinalizeState
  error: string | null
}

const BLOCKED_COPY: Record<string, string> = {
  needs_account: 'Needs an account',
  already_completed: 'Already completed',
  invalid_status: 'Cannot finalize',
  other_blocker: 'Blocked',
}

export function FinalizeDialog({
  candidates,
  phase,
  progress,
  busy,
  onConfirm,
  onClose,
}: {
  candidates: FinalizeCandidate[]
  phase: 'preview' | 'processing' | 'done'
  progress: FinalizeProgressRow[]
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ready = candidates.filter(c => c.kind === 'ready')
  const blocked = candidates.filter(c => c.kind !== 'ready')
  const readyValue = ready.reduce((sum, c) => sum + c.lo.totalSellingPrice, 0)
  const failedCount = progress.filter(p => p.state === 'failed').length
  const doneCount = progress.filter(p => p.state === 'done').length

  return (
    <Overlay
      open
      onClose={onClose}
      title={phase === 'done' ? 'Finalize complete' : 'Finalize selected orders'}
      subtitle={
        phase === 'preview' ? (
          <span className="num">
            {ready.length} will be completed · {formatPHPCompact(readyValue)}
          </span>
        ) : (
          <span className="num">
            {doneCount} completed{failedCount > 0 ? ` · ${failedCount} failed` : ''}
          </span>
        )
      }
      footer={
        phase === 'preview' ? (
          <>
            <Button intent="quiet" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button intent="positive" size="lg" busy={busy} disabled={ready.length === 0} onClick={onConfirm}>
              Complete {ready.length} order{ready.length !== 1 ? 's' : ''}
            </Button>
          </>
        ) : (
          <Button intent="neutral" size="lg" disabled={busy} onClick={onClose}>
            {busy ? 'Working…' : 'Close'}
          </Button>
        )
      }
    >
      {phase === 'preview' ? (
        <>
          {ready.length > 0 && (
            <section>
              <h3 className="ops-label mb-1.5">Will be completed</h3>
              <ul className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                {ready.map(c => (
                  <li key={c.lo.logicalKey} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text)]">
                      {ticketName(c.lo)}
                    </span>
                    <span className="num shrink-0 text-[11px] text-[var(--text-3)]">
                      {c.steps.join(' → ')}
                    </span>
                    <span className="num w-16 shrink-0 text-right text-[12px] font-semibold text-[var(--text)]">
                      {formatPHPCompact(c.lo.totalSellingPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {blocked.length > 0 && (
            <section className="mt-4">
              <h3 className="ops-label mb-1.5">Skipped</h3>
              <ul className="space-y-1.5">
                {blocked.map(c => (
                  <li
                    key={c.lo.logicalKey}
                    className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--line)] px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-[var(--text-2)]">
                        {ticketName(c.lo)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[var(--text-3)]">{c.reason}</span>
                    </span>
                    <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--text-3)]">
                      {BLOCKED_COPY[c.kind] ?? 'Skipped'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ready.length === 0 && blocked.length === 0 && (
            <p className="py-6 text-center text-[12.5px] text-[var(--text-3)]">Nothing selected.</p>
          )}
        </>
      ) : (
        <ul className="divide-y divide-[var(--line-soft)]">
          {progress.map(row => (
            <li key={row.logicalKey} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                {row.state === 'processing' && <Spinner className="size-3.5 text-[var(--accent)]" />}
                {row.state === 'done' && <Check className="size-3.5 text-[var(--ok)]" aria-hidden />}
                {row.state === 'failed' && <AlertCircle className="size-3.5 text-[var(--bad)]" aria-hidden />}
                {row.state === 'waiting' && (
                  <span className="size-1.5 rounded-full bg-[var(--line-strong)]" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-[12.5px]',
                    row.state === 'failed' ? 'text-[var(--bad)]' : 'text-[var(--text)]',
                  )}
                >
                  {row.name}
                </span>
                {row.error && (
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--bad)]">
                    {row.error}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  )
}

/* ── Remove from queue ──────────────────────────────────────────────────────
   cancel_logical_order records who removed the order and why, and never
   hard-deletes — the reason is part of the audit trail, so it is required. */

const REASONS = [
  { value: 'duplicate_order', label: 'Duplicate order' },
  { value: 'customer_changed_order', label: 'Customer changed the order' },
  { value: 'customer_cancelled', label: 'Customer cancelled' },
  { value: 'other', label: 'Other' },
] as const

export function RemoveDialog({
  order,
  busy,
  onConfirm,
  onClose,
}: {
  order: LogicalOrder
  busy: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<string>('duplicate_order')

  return (
    <Overlay
      open
      onClose={onClose}
      title="Remove from queue"
      subtitle={
        <span className="num">
          {ticketName(order)} · {ticketRef(order)}
        </span>
      }
      width="sm"
      footer={
        <>
          <Button intent="quiet" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button intent="danger" size="lg" busy={busy} onClick={() => onConfirm(reason)}>
            Remove
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--text-2)]">
        This cancels every row of the order and releases its reserved Robux. The order stays in the
        database with a record of why it was removed.
      </p>
      <div className="space-y-1">
        {REASONS.map(r => (
          <label
            key={r.value}
            className={cn(
              'flex h-10 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border px-2.5 transition-colors',
              reason === r.value
                ? 'border-[var(--accent-line)] bg-[var(--accent-wash)]'
                : 'border-[var(--line)] hover:bg-[var(--surface-hi)]',
            )}
          >
            <input
              type="radio"
              name="remove-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="sr-only"
            />
            <span
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full border',
                reason === r.value ? 'border-[var(--accent)]' : 'border-[var(--line-strong)]',
              )}
            >
              {reason === r.value && <span className="size-2 rounded-full bg-[var(--accent)]" />}
            </span>
            <span className="text-[12.5px] text-[var(--text)]">{r.label}</span>
          </label>
        ))}
      </div>
    </Overlay>
  )
}
