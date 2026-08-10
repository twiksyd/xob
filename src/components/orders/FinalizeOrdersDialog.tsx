'use client'

import { motion } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Loader2, Circle, XCircle, ShieldCheck } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import { formatRobux } from '@/lib/utils/pricing'

// ── Public types ──────────────────────────────────────────────────────────────

export type FinalizeClassificationKind =
  | 'ready'
  | 'needs_account'
  | 'invalid_status'
  | 'already_completed'
  | 'other_blocker'

export interface FinalizeCandidate {
  lo: LogicalOrder
  kind: FinalizeClassificationKind
  reason: string | null
  // Empty for anything that isn't 'ready'. Reuses the exact transition_order
  // sequence Mark Paid / Complete Order already fire — never a direct jump.
  steps: Array<'paid' | 'completed'>
}

export type FinalizeRowState = 'waiting' | 'processing' | 'done' | 'failed'

export interface FinalizeProgressRow {
  logicalKey: string
  orderNumber: string | null
  buyerName: string | null
  state: FinalizeRowState
  error: string | null
}

interface FinalizeOrdersDialogProps {
  candidates: FinalizeCandidate[]
  phase: 'preview' | 'processing' | 'done'
  progress: FinalizeProgressRow[]
  finalizing: boolean
  onConfirm: () => void
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLOCK_META: Record<Exclude<FinalizeClassificationKind, 'ready'>, { label: string; color: string }> = {
  needs_account:     { label: 'Missing account',    color: '#f59e0b' },
  invalid_status:    { label: 'Invalid status',     color: '#f43f5e' },
  already_completed: { label: 'Already completed',  color: 'rgba(255,255,255,0.40)' },
  other_blocker:     { label: 'Blocked',             color: '#f59e0b' },
}

function ProgressIcon({ state }: { state: FinalizeRowState }) {
  if (state === 'done') return <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#34d399' }} />
  if (state === 'failed') return <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f43f5e' }} />
  if (state === 'processing') return <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: '#22d3ee' }} />
  return <Circle className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }} />
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function FinalizeOrdersDialog({
  candidates, phase, progress, finalizing, onConfirm, onClose,
}: FinalizeOrdersDialogProps) {
  const ready = candidates.filter(c => c.kind === 'ready')
  const blocked = candidates.filter(c => c.kind !== 'ready')
  const blockCounts = blocked.reduce<Partial<Record<FinalizeClassificationKind, number>>>((acc, c) => {
    acc[c.kind] = (acc[c.kind] ?? 0) + 1
    return acc
  }, {})
  const pendingChain = ready.filter(c => c.steps.includes('paid'))
  const paidOnlyChain = ready.filter(c => !c.steps.includes('paid'))
  const totalRequired = ready.reduce((sum, c) => sum + c.lo.totalRobux, 0)

  const doneCount = progress.filter(p => p.state === 'done').length
  const failedRows = progress.filter(p => p.state === 'failed')
  const processedCount = doneCount + failedRows.length

  const canClose = phase !== 'processing'

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'rgba(4,4,12,0.82)', backdropFilter: 'blur(18px)' }}
      onClick={canClose ? onClose : undefined}
    >
      <motion.div
        className="w-full max-w-lg flex flex-col rounded-3xl overflow-hidden"
        initial={{ scale: 0.94, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'oklch(0.080 0.012 265)',
          border: '1px solid rgba(52,211,153,0.20)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Bulk Finalize
            </p>
            <h2 className="font-black text-[17px]" style={{ color: 'rgba(255,255,255,0.90)' }}>
              {phase === 'preview' && `${candidates.length} order${candidates.length !== 1 ? 's' : ''} selected`}
              {phase === 'processing' && 'Finalizing orders…'}
              {phase === 'done' && (failedRows.length > 0 ? `${doneCount} completed, ${failedRows.length} need attention` : `${doneCount} order${doneCount !== 1 ? 's' : ''} completed`)}
            </h2>
            {phase === 'processing' && (
              <p className="text-[12px] mt-0.5" style={{ color: '#22d3ee' }}>{processedCount} / {ready.length} processed</p>
            )}
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center ml-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {phase === 'preview' && (
            <>
              {/* Classification breakdown */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl p-3" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.20)' }}>
                  <p className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.34)' }}>Ready</p>
                  <p className="text-[20px] font-black tabular-nums mt-1" style={{ color: '#34d399' }}>{ready.length}</p>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.16)' }}>
                  <p className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.34)' }}>Total required</p>
                  <p className="text-[20px] font-black tabular-nums mt-1" style={{ color: '#f59e0b' }}>{formatRobux(totalRequired)}</p>
                </div>
              </div>

              {(Object.keys(blockCounts) as FinalizeClassificationKind[]).length > 0 && (
                <div className="rounded-2xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {(Object.entries(blockCounts) as [Exclude<FinalizeClassificationKind, 'ready'>, number][]).map(([kind, count]) => (
                    <div key={kind} className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold" style={{ color: BLOCK_META[kind].color }}>{BLOCK_META[kind].label}</span>
                      <span className="text-[12px] font-black tabular-nums" style={{ color: BLOCK_META[kind].color }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transition chain explanation */}
              {ready.length > 0 && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.14)' }}>
                  {pendingChain.length > 0 && (
                    <p className="text-[11.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
                      <span className="font-black tabular-nums" style={{ color: '#22d3ee' }}>{pendingChain.length}</span> order{pendingChain.length !== 1 ? 's' : ''} will be: <span className="font-bold">Pending → Paid → Completed</span>
                    </p>
                  )}
                  {paidOnlyChain.length > 0 && (
                    <p className="text-[11.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
                      <span className="font-black tabular-nums" style={{ color: '#22d3ee' }}>{paidOnlyChain.length}</span> order{paidOnlyChain.length !== 1 ? 's' : ''} will be: <span className="font-bold">Paid → Completed</span>
                    </p>
                  )}
                  <p className="text-[10.5px] leading-relaxed pt-1" style={{ color: 'rgba(255,255,255,0.38)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    This updates assigned Roblox balances, reservations, transactions, wallet records, profit, and savings using the existing XOB completion logic.
                  </p>
                </div>
              )}

              {ready.length === 0 && (
                <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                  <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>
                    None of the selected orders are ready to finalize.
                  </p>
                </div>
              )}
            </>
          )}

          {(phase === 'processing' || phase === 'done') && (
            <div className="space-y-1.5">
              {progress.map(row => (
                <div
                  key={row.logicalKey}
                  className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                  style={{
                    background: row.state === 'failed' ? 'rgba(244,63,94,0.06)' : row.state === 'done' ? 'rgba(52,211,153,0.045)' : 'rgba(255,255,255,0.026)',
                    border: `1px solid ${row.state === 'failed' ? 'rgba(244,63,94,0.18)' : row.state === 'done' ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.065)'}`,
                  }}
                >
                  <ProgressIcon state={row.state} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-mono font-bold truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
                      {row.orderNumber ?? row.logicalKey}
                      {row.buyerName ? <span className="font-sans font-semibold" style={{ color: 'rgba(255,255,255,0.42)' }}> · {row.buyerName}</span> : null}
                    </p>
                    {row.state === 'failed' && row.error && (
                      <p className="text-[10.5px] mt-0.5" style={{ color: '#f43f5e' }}>Failed — {row.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {phase === 'preview' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={ready.length === 0 || finalizing}
                onClick={onConfirm}
                className="px-5 py-2 rounded-xl text-[12px] font-bold disabled:opacity-45 transition-all flex items-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(34,211,238,0.10))',
                  border: '1px solid rgba(52,211,153,0.32)',
                  color: '#34d399',
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Finalize {ready.length} Ready Order{ready.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {phase === 'processing' && (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.34)' }}>
              Processing sequentially — this stays safe even when orders share an account.
            </p>
          )}
          {phase === 'done' && (
            <>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.34)' }}>
                {blocked.length > 0 ? `${blocked.length} order${blocked.length !== 1 ? 's' : ''} stayed in the queue.` : 'Queue and balances refreshed.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)' }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
