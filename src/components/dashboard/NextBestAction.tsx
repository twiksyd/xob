'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, ChevronDown, Sparkles, ArrowUpRight, Loader2 } from 'lucide-react'
import { Recommendation } from '@/lib/recommendations'
import { fadeUpVariants } from '@/lib/motion'

interface NextBestActionProps {
  recommendations: Recommendation[]
  loading?: boolean
}

function ActionButton({ action }: { action: Recommendation['action'] }) {
  const [busy, setBusy] = useState(false)

  if (action.run) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try { await action.run!() } finally { setBusy(false) }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
          color: 'white',
          boxShadow: '0 4px 20px rgba(34,211,238,0.35)',
        }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {busy ? 'Working…' : action.label}
      </button>
    )
  }

  return (
    <a
      href={action.href ?? '#'}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
      style={{
        background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
        color: 'white',
        boxShadow: '0 4px 20px rgba(34,211,238,0.35)',
      }}
    >
      {action.label} <ArrowUpRight className="w-3.5 h-3.5" />
    </a>
  )
}

function SecondaryRow({ rec }: { rec: Recommendation }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-1">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold truncate" style={{ color: 'oklch(0.16 0.028 270)' }}>{rec.headline}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>{rec.reasoning}</p>
      </div>
      {rec.action.run ? (
        <ActionButtonSmall action={rec.action} />
      ) : (
        <a
          href={rec.action.href ?? '#'}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border-border"
          style={{ background: 'rgba(167,139,250,0.08)', color: 'oklch(0.45 0.090 280)', border: '1px solid rgba(167,139,250,0.20)' }}
        >
          {rec.action.label} <ArrowUpRight className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

function ActionButtonSmall({ action }: { action: Recommendation['action'] }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try { await action.run!() } finally { setBusy(false) }
      }}
      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-60"
      style={{ background: 'rgba(34,211,238,0.10)', color: 'oklch(0.42 0.13 200)', border: '1px solid rgba(34,211,238,0.22)' }}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      {busy ? 'Working…' : action.label}
    </button>
  )
}

export default function NextBestAction({ recommendations, loading }: NextBestActionProps) {
  const [expanded, setExpanded] = useState(false)
  const [top, ...rest] = recommendations

  if (loading) {
    return (
      <div className="glass-elevated rounded-2xl p-6 flex items-center gap-3" style={{ minHeight: 140 }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#22d3ee' }} />
        <p className="text-[13px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Scanning your operation for the highest-value thing to do next…</p>
      </div>
    )
  }

  if (!top) {
    return (
      <div
        className="glass-elevated rounded-2xl p-6 flex items-center gap-4"
        style={{ boxShadow: '0 4px 28px rgba(52,211,153,0.10)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <Sparkles className="w-5 h-5" style={{ color: '#34d399' }} />
        </div>
        <div>
          <p className="text-[15px] font-extrabold" style={{ color: 'oklch(0.10 0.030 272)' }}>All clear — nothing needs your attention right now</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>No stalled orders, no accounts running low, no stuck reservations. Good time to focus on growth — restocking ahead of demand or reviewing your top accounts.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="glass-elevated rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 8px 40px rgba(139,92,246,0.14), 0 2px 12px rgba(15,13,42,0.06)' }}
    >
      {/* Hero recommendation */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.20), rgba(167,139,250,0.18))',
              border: '1px solid rgba(34,211,238,0.30)',
              boxShadow: '0 0 20px rgba(34,211,238,0.22)',
            }}
          >
            <Target className="w-5 h-5" style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.7))' }} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="label-caps mb-1.5" style={{ color: 'oklch(0.50 0.18 200)' }}>Next Best Action</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={top.id}
                variants={fadeUpVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-[16px] font-extrabold leading-snug"
                style={{ color: 'oklch(0.10 0.030 272)' }}
              >
                {top.headline}
              </motion.p>
            </AnimatePresence>

            <div className="mt-3 space-y-2">
              <p className="text-[12px] leading-relaxed">
                <span className="font-bold" style={{ color: 'oklch(0.45 0.090 280)' }}>Why: </span>
                <span style={{ color: 'oklch(0.42 0.014 265)' }}>{top.reasoning}</span>
              </p>
              <p className="text-[12px] leading-relaxed">
                <span className="font-bold" style={{ color: '#0d9488' }}>Impact: </span>
                <span style={{ color: 'oklch(0.42 0.014 265)' }}>{top.impact}</span>
              </p>
              <p className="text-[12px] leading-relaxed">
                <span className="font-bold" style={{ color: '#dc2626' }}>If you do nothing: </span>
                <span style={{ color: 'oklch(0.42 0.014 265)' }}>{top.ifNothing}</span>
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 self-center">
            <ActionButton action={top.action} />
          </div>
        </div>
      </div>

      {/* Collapsible "other things" drawer */}
      {rest.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(15,13,42,0.06)' }}>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-6 py-3 transition-colors hover:bg-[rgba(139,92,246,0.03)]"
          >
            <span className="text-[11px] font-bold" style={{ color: 'oklch(0.50 0.012 265)' }}>
              + {rest.length} other thing{rest.length !== 1 ? 's' : ''} worth a look
            </span>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown className="w-4 h-4" style={{ color: 'oklch(0.55 0.010 265)' }} />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="px-6 pb-3 divide-y" style={{ borderTop: '1px solid rgba(15,13,42,0.04)' }}>
                  {rest.map(rec => <SecondaryRow key={rec.id} rec={rec} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
