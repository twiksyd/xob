'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

/*
  Neon-red metallic gradient — each letter gets its own slice of the
  red spectrum so the word reads as one unified glowing word mark.
*/
const LETTER_COLORS = [
  { from: '#ff0033', mid: '#ff2244', to: '#cc0011' },   // T — hot red
  { from: '#ff1122', mid: '#ff0033', to: '#ff4455' },   // W — neon red
  { from: '#ff4455', mid: '#ff2233', to: '#ff0022' },   // I — crimson
  { from: '#ff0022', mid: '#ff3344', to: '#ffaaaa' },   // C — specular highlight
  { from: '#ffaaaa', mid: '#ff4455', to: '#ff1133' },   // K — metallic
  { from: '#ff1133', mid: '#ff0033', to: '#cc0011' },   // S — deep red
]

/*
  Moving diagonal beam lines — approximates the neon-red metallic VJ loop.
  ─────────────────────────────────────────────────────────────────────────
  TO USE YOUR OWN GIF:
  1. Save the GIF as  /public/splash-bg.gif
  2. Replace the entire <Background /> component below with:
       <img
         src="/splash-bg.gif"
         className="absolute inset-0 w-full h-full object-cover opacity-55"
         alt=""
         aria-hidden
       />
  ─────────────────────────────────────────────────────────────────────────
*/


export default function SplashScreen() {
  const [phase, setPhase] = useState<'enter' | 'scan' | 'exit' | 'done'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('scan'), 820)
    const t2 = setTimeout(() => setPhase('exit'), 2400)
    const t3 = setTimeout(() => setPhase('done'), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'done') return null

  const exiting = phase === 'exit'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.70 : 0.22, ease: exiting ? [0.55, 0, 1, 1] : 'easeOut' }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: '#050000' }}
      aria-hidden
    >
      <img
        src="/splash-bg.gif"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.92 }}
        alt=""
        aria-hidden
      />
      {/* Vignette — dark edges keep the text readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(2,0,0,0.72) 100%)',
        }}
      />

      {/* ── Main content — sits above the background ─────────────── */}
      <motion.div
        animate={exiting ? { y: -36, scale: 0.93 } : { y: 0, scale: 1 }}
        transition={{ duration: exiting ? 0.65 : 0.20, ease: [0.55, 0, 1, 1] }}
        className="relative z-10 flex flex-col items-center"
      >

        {/* ── TWICKS word mark ─────────────────────────────────── */}
        <div className="relative flex items-baseline" style={{ gap: '0.015em' }}>
          {LETTERS.map((letter, i) => {
            const c = LETTER_COLORS[i]
            return (
              <motion.span
                key={i}
                initial={{ y: 60, opacity: 0 }}
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
                  filter: `drop-shadow(0 0 28px ${c.from}80) drop-shadow(0 0 10px ${c.from}55)`,
                }}
              >
                {letter}
              </motion.span>
            )
          })}

          {/* ── Red scanner line — sweeps across after letters settle ── */}
          {phase === 'scan' && (
            <motion.div
              initial={{ left: '-4%', opacity: 0 }}
              animate={{ left: '104%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.52, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '-6px', bottom: '-6px',
                width: '2px',
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent 0%, rgba(220,0,25,0.65) 22%, rgba(255,180,180,0.98) 50%, rgba(220,0,25,0.65) 78%, transparent 100%)',
                boxShadow: '0 0 22px 10px rgba(220,0,25,0.60), 0 0 60px 24px rgba(180,0,15,0.20)',
              }}
            />
          )}
        </div>

        {/* ── Red accent rule ───────────────────────────────────── */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.60, delay: 0.68, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '1.5px',
            width: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(180,0,16,0.7) 15%, #ff0033 38%, #ff4455 52%, #ff0033 68%, rgba(180,0,16,0.7) 85%, transparent 100%)',
            transformOrigin: 'left center',
            marginTop: '14px',
            boxShadow: '0 0 12px 4px rgba(220,0,25,0.35)',
          }}
        />

        {/* ── Subtitle ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.98, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mt-5"
        >
          <span style={{
            fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.34em',
            textTransform: 'uppercase', color: 'rgba(255,80,80,0.38)',
            fontFamily: 'var(--font-sans)',
          }}>
            XOB PLATFORM
          </span>

          <span style={{
            width: '1px', height: '9px',
            background: 'rgba(255,60,60,0.22)',
            display: 'inline-block', flexShrink: 0,
          }} />

          <span style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(255,60,60,0.22)',
            fontFamily: 'var(--font-sans)',
          }}>
            ROBLOX SELLER DASHBOARD
          </span>
        </motion.div>

        {/* ── Built-by credit ───────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38, delay: 1.24 }}
          style={{
            fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(255,60,60,0.14)',
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
