'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, AlertCircle, Users } from 'lucide-react'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { RobloxAccount } from '@/lib/types/database'
import { formatRobux } from '@/lib/utils/pricing'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import StatusBadge from '@/components/shared/StatusBadge'

interface BWAccountAssignDialogProps {
  order: LogicalOrder
  accounts: RobloxAccount[]
  onClose: () => void
  onSave: (assignments: Record<string, string | null>) => Promise<void>
}

export default function BWAccountAssignDialog({
  order, accounts, onClose, onSave,
}: BWAccountAssignDialogProps) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {}
    for (const item of order.items) {
      init[item.id] = item.robloxAccountId ?? null
    }
    return init
  })
  const [saving, setSaving] = useState(false)

  function setItem(itemId: string, accountId: string | null) {
    setAssignments(prev => ({ ...prev, [itemId]: accountId }))
  }

  function applyToAll(accountId: string | null) {
    const next: Record<string, string | null> = {}
    for (const item of order.items) next[item.id] = accountId
    setAssignments(next)
  }

  async function handleSave() {
    setSaving(true)
    try { await onSave(assignments) } catch { setSaving(false) }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'rgba(4,4,12,0.82)', backdropFilter: 'blur(18px)' }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg flex flex-col rounded-3xl overflow-hidden"
        initial={{ scale: 0.94, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'oklch(0.080 0.012 265)',
          border: '1px solid rgba(34,211,238,0.20)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              BudgetWise Order
            </p>
            <h2 className="font-black text-[17px]" style={{ color: 'rgba(255,255,255,0.90)' }}>
              Assign Accounts
            </h2>
            <p className="font-mono text-[12px] mt-0.5" style={{ color: '#22d3ee' }}>
              {order.orderNumber}
              {order.buyerName ? ` · ${order.buyerName}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors ml-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Apply-to-all shortcut (multi-item orders only) */}
          {order.items.length > 1 && (
            <div className="rounded-2xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22d3ee' }} />
              <p className="text-[11px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.50)' }}>
                Apply one account to all items
              </p>
              <select
                className="text-[11px] rounded-lg px-2 py-1.5 font-semibold outline-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}
                value=""
                onChange={e => { if (e.target.value) applyToAll(e.target.value) }}
              >
                <option value="" disabled>Select…</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.username} ({formatRobux(getAvailableRobux(acc))} R$)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Per-item rows */}
          {order.items.map(item => {
            const currentAccId = assignments[item.id] ?? null
            const currentAcc = accounts.find(a => a.id === currentAccId) ?? null
            const available = currentAcc ? getAvailableRobux(currentAcc) : 0
            const canFulfill = !currentAcc || available >= item.robuxAmount

            return (
              <div key={item.id} className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.030)', border: '1px solid rgba(255,255,255,0.065)' }}>

                {/* Item header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {item.gamepassName}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {item.gameName ? `${item.gameName} · ` : ''}
                      {item.robuxAmount.toLocaleString()} R$
                    </p>
                  </div>
                  {currentAcc && canFulfill && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Check className="w-3 h-3" style={{ color: '#34d399' }} />
                      <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>Assigned</span>
                    </div>
                  )}
                  {currentAcc && !canFulfill && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} />
                      <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>Low stock</span>
                    </div>
                  )}
                </div>

                {/* Account selector */}
                <select
                  className="w-full text-[12px] rounded-xl px-3 py-2 font-semibold outline-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.80)' }}
                  value={currentAccId ?? ''}
                  onChange={e => setItem(item.id, e.target.value || null)}
                >
                  <option value="">No account assigned</option>
                  {accounts.map(acc => {
                    const avail = getAvailableRobux(acc)
                    const ok = avail >= item.robuxAmount
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.username} — {formatRobux(avail)} R${ok ? '' : ' ⚠'}
                      </option>
                    )
                  })}
                </select>

                {/* Account preview */}
                <AnimatePresence>
                  {currentAcc && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.18 }}
                      className="rounded-xl flex items-center justify-between gap-2 px-3 py-2"
                      style={{
                        background: canFulfill ? 'rgba(52,211,153,0.05)' : 'rgba(245,158,11,0.05)',
                        border: `1px solid ${canFulfill ? 'rgba(52,211,153,0.14)' : 'rgba(245,158,11,0.20)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.80)' }}>
                          {currentAcc.username}
                        </span>
                        <StatusBadge status={currentAcc.status} />
                        {isDepleted(currentAcc) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.20)' }}>
                            Depleted
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.32)' }}>Available</p>
                        <p className="text-[13px] font-black tabular-nums"
                          style={{ color: canFulfill ? 'rgba(255,255,255,0.88)' : '#f59e0b' }}>
                          {formatRobux(available)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12px] font-bold transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(56,189,248,0.10))',
              border: '1px solid rgba(34,211,238,0.28)',
              color: '#22d3ee',
            }}>
            {saving ? 'Saving…' : 'Save Assignments'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
