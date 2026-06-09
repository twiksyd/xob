'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

const LETTER_COLORS = [
  { from: '#ffffff', mid: '#f8faff', to: '#e8ecff' },
  { from: '#f0f4ff', mid: '#ffffff', to: '#f5f7ff' },
  { from: '#ffffff', mid: '#f2f2f2', to: '#e8ecff' },
  { from: '#f5f7ff', mid: '#ffffff', to: '#f0f0f0' },
  { from: '#ffffff', mid: '#f8f8f8', to: '#f0f4ff' },
  { from: '#eef0ff', mid: '#ffffff', to: '#f5f7ff' },
]

function Background() {
  return (
    <>
      {/* Base */}
      <div className="absolute inset-0" style={{ background: 'oklch(0.04 0.025 272)' }} />

      {/* Grid layer 1 — 45° drifting right-down */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0px, transparent 28px, rgba(139,92,246,0.055) 28px, rgba(139,92,246,0.055) 30px)',
        }}
        animate={{ backgroundPosition: ['0px 0px', '60px 60px'] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      />

      {/* Grid layer 2 — 135° drifting counter */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0px, transparent 46px, rgba(34,211,238,0.038) 46px, rgba(34,211,238,0.038) 48px)',
        }}
        animate={{ backgroundPosition: ['0px 0px', '-96px 96px'] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
      />

      {/* Orb 1 — large purple, top-left */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '70vw', height: '70vw',
          background: 'radial-gradient(circle, rgba(139,92,246,0.58) 0%, transparent 65%)',
          filter: 'blur(90px)',
          top: '-25vh', left: '-20vw',
        }}
        animate={{
          x: [0, 110, -55, 85, 0],
          y: [0, 65, -35, 105, 0],
          scale: [1, 1.14, 0.93, 1.07, 1],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 2 — cyan, bottom-right */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(34,211,238,0.42) 0%, transparent 65%)',
          filter: 'blur(100px)',
          bottom: '-20vh', right: '-15vw',
        }}
        animate={{
          x: [0, -85, 45, -65, 0],
          y: [0, -65, 35, -95, 0],
          scale: [1, 1.09, 0.96, 1.11, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 3 — pink/magenta, top-right */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(232,121,249,0.38) 0%, transparent 65%)',
          filter: 'blur(80px)',
          top: '-15vh', right: '-10vw',
        }}
        animate={{
          x: [0, -65, 35, -45, 0],
          y: [0, 85, -25, 65, 0],
          scale: [1, 0.89, 1.16, 0.94, 1],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 4 — deep indigo, center-bottom */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '55vw', height: '55vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 65%)',
          filter: 'blur(110px)',
          bottom: '-10vh', left: '25vw',
        }}
        animate={{
          x: [0, 65, -35, 55, 0],
          y: [0, -45, 25, -65, 0],
          scale: [1, 1.06, 0.91, 1.09, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Noise grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 35%, rgba(2,1,8,0.78) 100%)',
        }}
      />
    </>
  )
}

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
      style={{ background: 'oklch(0.04 0.025 272)' }}
      aria-hidden
    >
      <Background />

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
                  filter: `drop-shadow(0 0 22px rgba(255,255,255,0.38)) drop-shadow(0 0 6px rgba(255,255,255,0.22))`,
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
                background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.70) 22%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.70) 78%, transparent 100%)',
                boxShadow: '0 0 22px 10px rgba(255,255,255,0.50), 0 0 60px 24px rgba(255,255,255,0.15)',
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
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 15%, rgba(255,255,255,0.9) 38%, rgba(255,255,255,1) 52%, rgba(255,255,255,0.9) 68%, rgba(255,255,255,0.4) 85%, transparent 100%)',
            transformOrigin: 'left center',
            marginTop: '14px',
            boxShadow: '0 0 12px 4px rgba(255,255,255,0.20)',
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
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)',
            fontFamily: 'var(--font-sans)',
          }}>
            XOB PLATFORM
          </span>
          <span style={{
            width: '1px', height: '9px',
            background: 'rgba(255,255,255,0.18)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
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
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.14)',
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
