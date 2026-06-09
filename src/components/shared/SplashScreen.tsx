'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

const LETTER_COLORS = [
  { from: '#22d3ee', mid: '#38bdf8', to: '#818cf8' },
  { from: '#818cf8', mid: '#a78bfa', to: '#a78bfa' },
  { from: '#a78bfa', mid: '#b07ef7', to: '#c084fc' },
  { from: '#c084fc', mid: '#d87bef', to: '#e879f9' },
  { from: '#e879f9', mid: '#f472b6', to: '#fb7185' },
  { from: '#fb7185', mid: '#fda4af', to: '#fde68a' },
]

export default function SplashScreen() {
  const [phase, setPhase] = useState<'enter' | 'scan' | 'exit' | 'done'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('scan'), 820)
    const t2 = setTimeout(() => setPhase('exit'), 2300)
    const t3 = setTimeout(() => setPhase('done'), 3100)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'done') return null

  const exiting = phase === 'exit'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.65 : 0.18, ease: exiting ? [0.55, 0, 1, 1] : 'easeOut' }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: 'rgba(4, 2, 12, 1)' }}
      aria-hidden
    >
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div style={{
          position: 'absolute', width: '820px', height: '820px',
          top: '-280px', left: '-220px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 58%)',
          animation: 'orb-drift-1 28s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: '700px', height: '700px',
          bottom: '-240px', right: '-200px',
          background: 'radial-gradient(circle, rgba(232,121,249,0.22) 0%, transparent 58%)',
          animation: 'orb-drift-2 34s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px',
          top: '-200px', left: '50%', transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(34,211,238,0.14) 0%, transparent 60%)',
          animation: 'orb-drift-3 22s ease-in-out infinite',
        }} />
      </div>

      {/* Noise grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.028,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Main content */}
      <motion.div
        animate={exiting ? { y: -32, scale: 0.94 } : { y: 0, scale: 1 }}
        transition={{ duration: exiting ? 0.65 : 0.20, ease: [0.55, 0, 1, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* TWICKS word mark */}
        <div className="relative flex items-baseline" style={{ gap: '0.015em' }}>
          {LETTERS.map((letter, i) => {
            const c = LETTER_COLORS[i]
            return (
              <motion.span
                key={i}
                initial={{ y: 56, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.72,
                  delay: 0.08 + i * 0.088,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  fontSize: 'clamp(68px, 12vw, 124px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.015em',
                  display: 'inline-block',
                  background: `linear-gradient(160deg, ${c.from} 0%, ${c.mid} 50%, ${c.to} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 22px ${c.from}60) drop-shadow(0 0 6px ${c.to}40)`,
                }}
              >
                {letter}
              </motion.span>
            )
          })}

          {/* Scanner line */}
          {phase === 'scan' && (
            <motion.div
              initial={{ left: '-3%', opacity: 0 }}
              animate={{ left: '103%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.52, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '-6px', bottom: '-6px',
                width: '2px',
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.65) 22%, rgba(255,255,255,0.98) 50%, rgba(34,211,238,0.65) 78%, transparent 100%)',
                boxShadow: '0 0 22px 10px rgba(34,211,238,0.60), 0 0 60px 24px rgba(139,92,246,0.20)',
              }}
            />
          )}
        </div>

        {/* Accent rule */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.60, delay: 0.66, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '1.5px',
            width: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.7) 15%, #818cf8 38%, #e879f9 52%, #818cf8 68%, rgba(34,211,238,0.7) 85%, transparent 100%)',
            transformOrigin: 'left center',
            marginTop: '14px',
            boxShadow: '0 0 12px 4px rgba(139,92,246,0.35)',
          }}
        />

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.96, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mt-5"
        >
          <span style={{
            fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.34em',
            textTransform: 'uppercase', color: 'rgba(139,92,246,0.38)',
            fontFamily: 'var(--font-sans)',
          }}>
            XOB PLATFORM
          </span>
          <span style={{
            width: '1px', height: '9px',
            background: 'rgba(139,92,246,0.22)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(139,92,246,0.22)',
            fontFamily: 'var(--font-sans)',
          }}>
            ROBLOX SELLER DASHBOARD
          </span>
        </motion.div>

        {/* Built by Twicks */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38, delay: 1.22 }}
          style={{
            fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(139,92,246,0.14)',
            marginTop: '28px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Built by Twicks
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
