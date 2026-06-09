'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { SavingsGoal } from '@/lib/types/database'
import { PiggyBank, CheckCircle2, Lock, Edit2, X, Check } from 'lucide-react'

interface SavingsWidgetProps {
  compact?: boolean
  /** Optional goal.id -> "projected to complete around <date>" text, computed by the caller from recent allocation pace */
  forecasts?: Record<string, string>
}

const COLOR_ACTIVE    = '#34d399'
const COLOR_COMPLETED = '#22d3ee'
const COLOR_LOCKED    = 'oklch(0.62 0.010 265)'

function GoalBar({ goal, compact, forecast }: { goal: SavingsGoal; compact: boolean; forecast?: string }) {
  const pct       = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  const isActive    = goal.status === 'active'
  const isCompleted = goal.status === 'completed'
  const isLocked    = goal.status === 'locked'

  const accentColor = isCompleted ? COLOR_COMPLETED : isActive ? COLOR_ACTIVE : COLOR_LOCKED

  return (
    <div
      className={compact ? 'space-y-1.5' : 'space-y-2.5'}
      style={isLocked ? { opacity: 0.65 } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCompleted && (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: COLOR_COMPLETED }} />
          )}
          {isActive && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: COLOR_ACTIVE, boxShadow: `0 0 6px ${COLOR_ACTIVE}70` }}
            />
          )}
          {isLocked && (
            <Lock className="w-3 h-3 flex-shrink-0" style={{ color: COLOR_LOCKED }} />
          )}
          <p
            className={`font-bold truncate ${compact ? 'text-[11px]' : 'text-[13px]'}`}
            style={{ color: isLocked ? 'oklch(0.55 0.010 265)' : 'oklch(0.10 0.030 272)' }}
          >
            {goal.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!compact && (
            <span className="text-[10px] font-semibold" style={{ color: 'oklch(0.58 0.010 265)' }}>
              {goal.allocation_pct}% per order
            </span>
          )}
          {isCompleted ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,211,238,0.10)', color: '#0e7490', border: '1px solid rgba(34,211,238,0.22)' }}
            >
              ✓ Done
            </span>
          ) : isLocked ? (
            <span className="text-[10px] font-semibold" style={{ color: COLOR_LOCKED }}>
              Locked
            </span>
          ) : (
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: accentColor }}
            >
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-baseline justify-between gap-2">
        <p className={`font-bold tabular-nums ${compact ? 'text-[12px]' : 'text-[15px]'}`} style={{ color: isLocked ? 'oklch(0.55 0.010 265)' : 'oklch(0.10 0.030 272)' }}>
          ₱{Number(goal.current_amount).toFixed(2)}
          <span className={`font-normal ml-1 ${compact ? 'text-[10px]' : 'text-[12px]'}`} style={{ color: 'oklch(0.58 0.010 265)' }}>
            / ₱{Number(goal.target_amount).toFixed(0)}
          </span>
        </p>
        {!compact && !isCompleted && !isLocked && (
          <p className="text-[11px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
            ₱{remaining.toFixed(2)} remaining
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div
        className={`rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}
        style={{ background: 'rgba(15,13,42,0.07)' }}
      >
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: isCompleted
              ? 'linear-gradient(90deg, #22d3ee, #a78bfa)'
              : isActive
              ? `linear-gradient(90deg, ${COLOR_ACTIVE}, #22d3ee)`
              : 'rgba(15,13,42,0.12)',
            boxShadow: isCompleted
              ? '0 0 8px rgba(34,211,238,0.50)'
              : isActive
              ? `0 0 8px ${COLOR_ACTIVE}60`
              : 'none',
          }}
        />
      </div>

      {/* Locked hint */}
      {!compact && isLocked && (
        <p className="text-[10px]" style={{ color: 'oklch(0.62 0.010 265)' }}>
          Activates after Primary goal completes
        </p>
      )}

      {/* Forecast — "if you keep going at this pace, here's when this finishes" */}
      {isActive && forecast && (
        <p className="text-[10px] font-medium" style={{ color: 'oklch(0.50 0.18 200)' }}>
          📈 {forecast}
        </p>
      )}
    </div>
  )
}

export default function SavingsWidget({ compact = false, forecasts }: SavingsWidgetProps) {
  const [goals, setGoals]         = useState<SavingsGoal[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState('')
  const [editPct, setEditPct]     = useState('')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const loadGoals = useCallback(async () => {
    const { data } = await supabase.from('savings_goals').select('*').order('priority')
    if (!data || data.length === 0) {
      await supabase.rpc('initialize_savings_goals')
      const { data: fresh } = await supabase.from('savings_goals').select('*').order('priority')
      setGoals((fresh as SavingsGoal[]) ?? [])
    } else {
      setGoals(data as SavingsGoal[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadGoals() }, [loadGoals])

  async function saveEdit(goalId: string) {
    const target = parseFloat(editTarget)
    const pct    = parseFloat(editPct)
    if (isNaN(target) || target <= 0 || isNaN(pct) || pct <= 0 || pct > 100) return
    await supabase.from('savings_goals').update({
      target_amount:  target,
      allocation_pct: pct,
      updated_at:     new Date().toISOString(),
    }).eq('id', goalId)
    setEditingId(null)
    loadGoals()
  }

  if (loading) {
    return (
      <div className={compact ? 'p-3' : 'p-5'}>
        <div className="space-y-2">
          <div className="h-3 rounded-full animate-pulse" style={{ background: 'rgba(15,13,42,0.06)', width: '60%' }} />
          <div className="h-2 rounded-full animate-pulse" style={{ background: 'rgba(15,13,42,0.04)' }} />
        </div>
      </div>
    )
  }

  if (goals.length === 0) return null

  const allDone = goals.every(g => g.status === 'completed')
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0)

  if (compact) {
    return (
      <div className="glass-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <PiggyBank className="w-3.5 h-3.5" style={{ color: '#34d399', filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.5))' }} />
            <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Savings Goals</p>
          </div>
          {allDone && (
            <span className="text-[10px] font-bold" style={{ color: '#0e7490' }}>All done ✓</span>
          )}
        </div>
        <div className="space-y-3">
          {goals.map(goal => (
            <GoalBar key={goal.id} goal={goal} compact={true} forecast={forecasts?.[goal.id]} />
          ))}
        </div>
        <div
          className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(15,13,42,0.055)' }}
        >
          <p className="text-[10px]" style={{ color: 'oklch(0.58 0.010 265)' }}>Total saved</p>
          <p className="text-[12px] font-bold tabular-nums" style={{ color: '#34d399' }}>
            ₱{totalSaved.toFixed(2)} / ₱{totalTarget.toFixed(0)}
          </p>
        </div>
      </div>
    )
  }

  // Full mode
  return (
    <div className="glass-elevated overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(52,211,153,0.028) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(15,13,42,0.055)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)' }}
          >
            <PiggyBank className="w-4 h-4" style={{ color: '#34d399' }} />
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>
              Savings Goals
            </p>
            <p className="text-[10px]" style={{ color: 'oklch(0.58 0.010 265)' }}>
              Auto-allocated from order profit
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: '#34d399' }}>
            ₱{totalSaved.toFixed(2)}
          </p>
          <p className="text-[10px]" style={{ color: 'oklch(0.60 0.010 265)' }}>
            of ₱{totalTarget.toFixed(0)} target
          </p>
        </div>
      </div>

      {/* Goals */}
      <div className="px-5 py-4 space-y-5">
        {goals.map(goal => (
          <div key={goal.id}>
            {editingId === goal.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold flex-1" style={{ color: 'oklch(0.18 0.025 270)' }}>
                    {goal.name}
                  </p>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold" style={{ color: 'oklch(0.52 0.016 265)' }}>Target (₱)</label>
                    <input
                      type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)}
                      className="w-full bg-input h-8 px-2.5 rounded-lg text-[12px] border border-border outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold" style={{ color: 'oklch(0.52 0.016 265)' }}>Allocation %</label>
                    <input
                      type="number" value={editPct} onChange={e => setEditPct(e.target.value)}
                      className="w-full bg-input h-8 px-2.5 rounded-lg text-[12px] border border-border outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <button
                  onClick={() => saveEdit(goal.id)}
                  className="btn-primary h-8 px-4 text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
            ) : (
              <div className="relative group">
                <GoalBar goal={goal} compact={false} forecast={forecasts?.[goal.id]} />
                <button
                  onClick={() => {
                    setEditingId(goal.id)
                    setEditTarget(String(goal.target_amount))
                    setEditPct(String(goal.allocation_pct))
                  }}
                  className="absolute top-0 right-0 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}

            {goal.priority < goals.length && (
              <div
                className="mt-5 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(15,13,42,0.06) 20%, rgba(15,13,42,0.06) 80%, transparent)' }}
              />
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ background: 'rgba(34,211,238,0.04)', borderTop: '1px solid rgba(34,211,238,0.12)' }}
        >
          <CheckCircle2 className="w-4 h-4" style={{ color: COLOR_COMPLETED }} />
          <p className="text-[12px] font-semibold" style={{ color: '#0e7490' }}>
            All savings goals completed — great work!
          </p>
        </div>
      )}
    </div>
  )
}
