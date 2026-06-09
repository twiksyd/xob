'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']
const COLORS  = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9']

type Phase = 'typing' | 'visible' | 'fading' | 'hidden'

export default function TwicksHero() {
  const [phase, setPhase] = useState<Phase>('typing')
  const [count, setCount] = useState(0)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      t = count < LETTERS.length
        ? setTimeout(() => setCount(c => c + 1), 75)
        : setTimeout(() => setPhase('visible'), 100)
    } else if (phase === 'visible') {
      t = setTimeout(() => setPhase('fading'), 2000)
    } else if (phase === 'fading') {
      t = setTimeout(() => setPhase('hidden'), 320)
    } else {
      t = setTimeout(() => { setCount(0); setPhase('typing') }, 200)
    }
    return () => clearTimeout(t)
  }, [phase, count])

  const isOut   = phase === 'fading' || phase === 'hidden'
  const isFloat = phase === 'visible' || phase === 'fading'

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
          filter: 'blur(55px)', top: '-80px', left: '-10%',
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
          filter: 'blur(50px)', bottom: '-55px', right: '-8%',
        }}
        animate={{ x: [0, -30, 18, -24, 0], y: [0, -15, 10, -25, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 88% 88% at 50% 50%, transparent 36%, rgba(2,1,8,0.78) 100%)',
      }} />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">

        {/* Letter row */}
        <div className="flex items-end" style={{ gap: '0.01em' }}>
          {LETTERS.map((letter, i) => {
            const color = COLORS[i]
            const shown = !isOut && i < count

            return (
              <motion.span
                key={i}
                /*
                  Entry:  spring pop with natural overshoot (stiffness 550, damping 14 → ~20% overshoot)
                  Exit:   quick keyframe — scale blooms 1→1.22→0, tiny stagger per letter
                */
                animate={{
                  scale:   isOut ? [1, 1.22, 0] : shown ? 1 : 0,
                  opacity: isOut ? [1, 1, 0]     : shown ? 1 : 0,
                  y:       shown && !isOut ? 0 : !isOut ? -18 : 0,
                }}
                transition={{
                  scale: isOut
                    ? { duration: 0.26, times: [0, 0.32, 1], ease: [0.55, 0, 1, 1], delay: i * 0.030 }
                    : { type: 'spring', stiffness: 550, damping: 14 },
                  opacity: isOut
                    ? { duration: 0.26, times: [0, 0.60, 1], delay: i * 0.030 }
                    : { duration: 0.10 },
                  y: { type: 'spring', stiffness: 420, damping: 18 },
                }}
                style={{
                  fontSize: 'clamp(52px, 8.5vw, 100px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  display: 'inline-block',
                  background: `linear-gradient(160deg, ${color} 0%, ${color}bb 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 22px ${color}65) drop-shadow(0 0 7px ${color}44)`,
                }}
              >
                {/*
                  Inner span handles the continuous wave float via CSS animation.
                  Negative animation-delay offsets each letter into a different
                  phase of the cycle — creates a rolling left-to-right wave.
                */}
                <span
                  className={isFloat ? 'hero-letter-float' : ''}
                  style={{
                    display: 'inline-block',
                    animationDuration: '1.25s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: isFloat ? `${i * -0.185}s` : '0s',
                  }}
                >
                  {letter}
                </span>
              </motion.span>
            )
          })}

          {/* Blinking gradient cursor — visible only while typing */}
          {phase === 'typing' && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.45, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              style={{
                display: 'inline-block',
                width: '4px',
                height: '0.70em',
                background: 'linear-gradient(180deg, #22d3ee, #a78bfa)',
                borderRadius: '2px',
                marginLeft: '6px',
                marginBottom: '6px',
                verticalAlign: 'bottom',
              }}
            />
          )}
        </div>

        {/* Accent line — scaleX grows with each letter typed, collapses on exit */}
        <motion.div
          animate={{
            scaleX:  isOut ? 0 : count / LETTERS.length,
            opacity: isOut ? 0 : count > 0 ? 1 : 0,
          }}
          transition={{ duration: isOut ? 0.22 : 0.14, ease: isOut ? 'easeIn' : 'easeOut' }}
          style={{
            height: '1.5px',
            width: '300px',
            maxWidth: '75%',
            background: 'linear-gradient(90deg, #22d3ee, #818cf8 50%, #e879f9)',
            transformOrigin: 'left center',
            borderRadius: '1px',
            boxShadow: '0 0 10px 3px rgba(139,92,246,0.28)',
          }}
        />

        {/* Tagline — fades in only when all letters are settled */}
        <motion.p
          animate={{ opacity: phase === 'visible' ? 1 : 0, y: phase === 'visible' ? 0 : 5 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          style={{
            fontSize: '8.5px', fontWeight: 600, letterSpacing: '0.32em',
            textTransform: 'uppercase', color: 'rgba(139,92,246,0.42)',
            fontFamily: 'var(--font-sans)', marginTop: '-4px',
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
