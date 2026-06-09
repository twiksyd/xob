'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

// Chrome metallic — light source from upper-right, shadow on edges
const LETTER_COLORS = [
  { from: '#8888aa', mid: '#ffffff', to: '#b8b8d0' },
  { from: '#c0c0d8', mid: '#ffffff', to: '#8080a8' },
  { from: '#ffffff', mid: '#c8c8e0', to: '#ffffff' },
  { from: '#9898b8', mid: '#ffffff', to: '#d0d0e8' },
  { from: '#ffffff', mid: '#b0b0cc', to: '#ffffff' },
  { from: '#b8b8d0', mid: '#ffffff', to: '#8888aa' },
]

function Background() {
  return (
    <>
      {/* Base */}
      <div className="absolute inset-0" style={{ background: 'oklch(0.04 0.025 272)' }} />

      {/* Rotating conic gradient — slow aurora color sweep */}
      <div
        className="absolute pointer-events-none overflow-hidden inset-0"
        style={{ zIndex: 0 }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%' }}>
          <motion.div
            style={{
              width: '200vmax', height: '200vmax',
              marginLeft: '-100vmax', marginTop: '-100vmax',
              background: 'conic-gradient(from 0deg at 50% 50%, rgba(139,92,246,0.10) 0deg, rgba(34,211,238,0.06) 90deg, rgba(232,121,249,0.09) 180deg, rgba(99,102,241,0.07) 270deg, rgba(139,92,246,0.10) 360deg)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Perspective floor grid — lines converge to horizon and scroll toward viewer */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0, left: '-30%', right: '-30%',
          height: '50%',
          transformOrigin: 'bottom center',
          transform: 'perspective(500px) rotateX(68deg)',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)',
        }}
      >
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: [
              'repeating-linear-gradient(0deg, transparent 0px, transparent 39px, rgba(139,92,246,0.18) 39px, rgba(139,92,246,0.18) 40px)',
              'repeating-linear-gradient(90deg, transparent 0px, transparent 39px, rgba(139,92,246,0.13) 39px, rgba(139,92,246,0.13) 40px)',
            ].join(', '),
            backgroundSize: '40px 40px',
          }}
          animate={{ backgroundPosition: ['0px 0px', '0px 80px'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Orb 1 — purple, top-left (5s — clearly moves during 3s splash) */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '65vw', height: '65vw',
          background: 'radial-gradient(circle, rgba(139,92,246,0.60) 0%, transparent 65%)',
          filter: 'blur(80px)',
          top: '-25vh', left: '-18vw',
        }}
        animate={{ x: [0, 110, -55, 85, 0], y: [0, 65, -35, 100, 0], scale: [1, 1.14, 0.93, 1.07, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 2 — cyan, bottom-right (7s) */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '58vw', height: '58vw',
          background: 'radial-gradient(circle, rgba(34,211,238,0.44) 0%, transparent 65%)',
          filter: 'blur(88px)',
          bottom: '-18vh', right: '-14vw',
        }}
        animate={{ x: [0, -85, 45, -65, 0], y: [0, -65, 35, -90, 0], scale: [1, 1.10, 0.96, 1.12, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 3 — pink, top-right (5.5s) */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '48vw', height: '48vw',
          background: 'radial-gradient(circle, rgba(232,121,249,0.40) 0%, transparent 65%)',
          filter: 'blur(72px)',
          top: '-14vh', right: '-8vw',
        }}
        animate={{ x: [0, -65, 35, -45, 0], y: [0, 85, -25, 65, 0], scale: [1, 0.88, 1.18, 0.94, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Orb 4 — indigo, center-bottom (8s) */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '52vw', height: '52vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.34) 0%, transparent 65%)',
          filter: 'blur(100px)',
          bottom: '-8vh', left: '22vw',
        }}
        animate={{ x: [0, 65, -35, 55, 0], y: [0, -45, 25, -65, 0], scale: [1, 1.06, 0.91, 1.09, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Noise grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.022,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 28%, rgba(2,1,8,0.84) 100%)',
        }}
      />
    </>
  )
}

export default function SplashScreen() {
  const [phase, setPhase] = useState<'enter' | 'scan' | 'exit' | 'done'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('scan'), 820)
    const t2 = setTimeout(() => setPhase('exit'), 2500)
    const t3 = setTimeout(() => setPhase('done'), 3300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'done') return null
  const exiting = phase === 'exit'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.70 : 0.20, ease: exiting ? [0.55, 0, 1, 1] : 'easeOut' }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: 'oklch(0.04 0.025 272)' }}
      aria-hidden
    >
      <Background />

      <motion.div
        animate={exiting ? { y: -36, scale: 0.93 } : { y: 0, scale: 1 }}
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
                initial={{
                  y: 56,
                  opacity: 0,
                  filter: 'drop-shadow(0 0 0px rgba(255,255,255,0)) drop-shadow(0 0 0px rgba(200,200,255,0))',
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                  filter: [
                    'drop-shadow(0 0 0px rgba(255,255,255,0)) drop-shadow(0 0 0px rgba(200,200,255,0))',
                    'drop-shadow(0 0 38px rgba(255,255,255,0.90)) drop-shadow(0 0 14px rgba(200,200,255,0.72))',
                    'drop-shadow(0 0 18px rgba(255,255,255,0.26)) drop-shadow(0 0 5px rgba(200,200,255,0.14))',
                  ],
                }}
                transition={{
                  delay: 0.08 + i * 0.088,
                  y: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.58, ease: 'easeOut' },
                  filter: { duration: 1.08, times: [0, 0.62, 1.0], ease: 'easeOut' },
                }}
                style={{
                  fontSize: 'clamp(68px, 12vw, 124px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.015em',
                  display: 'inline-block',
                  background: `linear-gradient(145deg, ${c.from} 0%, ${c.mid} 50%, ${c.to} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {letter}
              </motion.span>
            )
          })}

          {/* Sharp scanner line */}
          {phase === 'scan' && (
            <motion.div
              initial={{ left: '-3%', opacity: 0 }}
              animate={{ left: '103%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.50, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '-8px', bottom: '-8px',
                width: '2px',
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.70) 22%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.70) 78%, transparent 100%)',
                boxShadow: '0 0 22px 10px rgba(255,255,255,0.50), 0 0 60px 24px rgba(200,200,255,0.18)',
              }}
            />
          )}

          {/* Metallic glint sweep — wide soft highlight after scanner */}
          {phase === 'scan' && (
            <motion.div
              initial={{ left: '-45%', opacity: 0 }}
              animate={{ left: '145%', opacity: [0, 0.75, 0.75, 0] }}
              transition={{ duration: 0.72, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: '-14px', bottom: '-14px',
                width: '38%',
                pointerEvents: 'none',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.05) 75%, transparent 100%)',
                filter: 'blur(10px)',
              }}
            />
          )}

          {/* Radial bloom — fires when last letter lands (~1.28s) */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 2.4, 4.2], opacity: [0, 0.58, 0] }}
            transition={{ duration: 1.15, delay: 1.28, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '720px', height: '250px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.26) 0%, rgba(139,92,246,0.16) 42%, transparent 70%)',
              filter: 'blur(24px)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Accent rule */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.60, delay: 0.66, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '1.5px',
            width: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 15%, rgba(255,255,255,0.90) 38%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.90) 65%, rgba(255,255,255,0.35) 85%, transparent 100%)',
            transformOrigin: 'left center',
            marginTop: '14px',
            boxShadow: '0 0 12px 4px rgba(255,255,255,0.18)',
          }}
        />

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.98, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mt-5"
        >
          <span style={{
            fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.34em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)',
            fontFamily: 'var(--font-sans)',
          }}>XOB PLATFORM</span>
          <span style={{
            width: '1px', height: '9px',
            background: 'rgba(255,255,255,0.18)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
            fontFamily: 'var(--font-sans)',
          }}>ROBLOX SELLER DASHBOARD</span>
        </motion.div>

        {/* Built by Twicks */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38, delay: 1.24 }}
          style={{
            fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.14)',
            marginTop: '28px',
            fontFamily: 'var(--font-sans)',
          }}
        >Built by Twicks</motion.p>
      </motion.div>
    </motion.div>
  )
}
