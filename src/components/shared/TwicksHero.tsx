'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

// Cyan → indigo → purple → pink across the word
const LETTER_COLORS = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9']

type Phase = 'typing' | 'visible' | 'fading' | 'hidden'

export default function TwicksHero() {
  const [phase, setPhase]             = useState<Phase>('typing')
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>

    if (phase === 'typing') {
      if (visibleCount < LETTERS.length) {
        t = setTimeout(() => setVisibleCount(c => c + 1), 108)
      } else {
        t = setTimeout(() => setPhase('visible'), 160)
      }
    } else if (phase === 'visible') {
      t = setTimeout(() => setPhase('fading'), 2200)
    } else if (phase === 'fading') {
      t = setTimeout(() => setPhase('hidden'), 500)
    } else {
      t = setTimeout(() => { setVisibleCount(0); setPhase('typing') }, 280)
    }

    return () => clearTimeout(t)
  }, [phase, visibleCount])

  const isOut = phase === 'fading' || phase === 'hidden'

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: '200px',
        background: 'oklch(0.055 0.030 272)',
        border: '1px solid rgba(139,92,246,0.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Purple orb — left */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '50%', height: '260px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.48) 0%, transparent 65%)',
          filter: 'blur(55px)',
          top: '-80px', left: '-10%',
        }}
        animate={{ x: [0, 40, -20, 30, 0], y: [0, 18, -8, 22, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Cyan orb — right */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '42%', height: '220px',
          background: 'radial-gradient(circle, rgba(34,211,238,0.36) 0%, transparent 65%)',
          filter: 'blur(50px)',
          bottom: '-55px', right: '-8%',
        }}
        animate={{ x: [0, -30, 18, -24, 0], y: [0, -15, 10, -25, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 88% 88% at 50% 50%, transparent 36%, rgba(2,1,8,0.78) 100%)',
        }}
      />

      {/* Noise grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.020,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">

        {/* Letter row */}
        <div className="flex items-baseline" style={{ gap: '0.01em' }}>
          {LETTERS.map((letter, i) => {
            const color = LETTER_COLORS[i]
            const shown = !isOut && i < visibleCount
            return (
              <motion.span
                key={i}
                animate={{
                  opacity: shown ? 1 : 0,
                  y: isOut ? -12 : shown ? 0 : 14,
                }}
                transition={{
                  opacity: { duration: isOut ? 0.38 : 0.14, ease: isOut ? 'easeIn' : 'easeOut' },
                  y:       { duration: isOut ? 0.38 : 0.20, ease: isOut ? 'easeIn' : [0.16, 1, 0.3, 1] },
                }}
                style={{
                  fontSize: 'clamp(52px, 8.5vw, 100px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  display: 'inline-block',
                  background: `linear-gradient(160deg, ${color} 0%, ${color}cc 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 20px ${color}60) drop-shadow(0 0 6px ${color}40)`,
                }}
              >
                {letter}
              </motion.span>
            )
          })}

          {/* Blinking cursor while typing */}
          {phase === 'typing' && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.48, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              style={{
                display: 'inline-block',
                width: '3px',
                height: '0.72em',
                background: 'linear-gradient(180deg, #22d3ee, #a78bfa)',
                borderRadius: '2px',
                marginLeft: '6px',
                verticalAlign: 'middle',
                marginBottom: '4px',
              }}
            />
          )}
        </div>

        {/* Accent line — grows as letters type, shrinks on fade */}
        <motion.div
          animate={{
            scaleX: isOut ? 0 : visibleCount / LETTERS.length,
            opacity: isOut ? 0 : 1,
          }}
          transition={{ duration: isOut ? 0.35 : 0.14, ease: isOut ? 'easeIn' : 'easeOut' }}
          style={{
            height: '1.5px',
            width: '320px',
            maxWidth: '80%',
            background: 'linear-gradient(90deg, #22d3ee, #818cf8 50%, #e879f9)',
            transformOrigin: 'left center',
            borderRadius: '1px',
            boxShadow: '0 0 10px 3px rgba(139,92,246,0.30)',
          }}
        />

        {/* Tagline — fades in when fully typed */}
        <motion.p
          animate={{ opacity: phase === 'visible' ? 1 : 0, y: phase === 'visible' ? 0 : 4 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            fontSize: '8.5px', fontWeight: 600, letterSpacing: '0.32em',
            textTransform: 'uppercase', color: 'rgba(139,92,246,0.42)',
            fontFamily: 'var(--font-sans)',
            marginTop: '-4px',
          }}
        >
          Roblox Seller Platform
        </motion.p>
      </div>

      {/* Bottom glow edge */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.40) 25%, rgba(34,211,238,0.50) 50%, rgba(139,92,246,0.40) 75%, transparent)',
      }} />

      {/* Top specular rim */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.08) 70%, transparent)',
      }} />
    </div>
  )
}
