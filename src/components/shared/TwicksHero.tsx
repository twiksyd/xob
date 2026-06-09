'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LETTERS = ['T', 'W', 'I', 'C', 'K', 'S']

/*
  Variable stagger — the gaps create the suspense.
  Long pause on T, then W arrives, then I/C in quicker succession,
  K builds the climax, S is the resolution.
*/
const REVEAL_AT = [0, 700, 1060, 1480, 1900, 2360]
const LAST_REVEAL = REVEAL_AT[REVEAL_AT.length - 1]

type Phase = 'dark' | 'building' | 'holding' | 'dissolving'

export default function TwicksHero() {
  const [phase, setPhase]               = useState<Phase>('dark')
  const [revealedCount, setRevealedCount] = useState(0)
  const [bloom, setBloom]               = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    if (phase === 'dark') {
      timers.push(setTimeout(() => setPhase('building'), 480))

    } else if (phase === 'building') {
      REVEAL_AT.forEach((ms, i) => {
        timers.push(setTimeout(() => setRevealedCount(i + 1), ms))
      })
      // Give last letter time to fully settle before holding
      timers.push(setTimeout(() => setPhase('holding'), LAST_REVEAL + 520))

    } else if (phase === 'holding') {
      setBloom(true)
      timers.push(setTimeout(() => setBloom(false), 900))
      timers.push(setTimeout(() => setPhase('dissolving'), 2400))

    } else {
      // dissolving — let fade run then reset
      timers.push(setTimeout(() => {
        setRevealedCount(0)
        setPhase('dark')
      }, 720))
    }

    return () => timers.forEach(clearTimeout)
  }, [phase])

  const ambientIntensity = revealedCount / LETTERS.length
  const isDissolving     = phase === 'dissolving'
  const isDark           = phase === 'dark'

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: '200px',
        background: '#040405',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Ambient overhead glow — intensifies as each letter appears */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 95% at 50% 35%, rgba(255,255,255,0.06) 0%, transparent 70%)',
          opacity: ambientIntensity,
          transition: 'opacity 0.45s ease-out',
        }}
      />

      {/* Floor glow — builds from below */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 40% at 50% 100%, rgba(255,255,255,0.025) 0%, transparent 70%)',
          opacity: ambientIntensity * 0.7,
          transition: 'opacity 0.45s ease-out',
        }}
      />

      {/* Bloom burst — fires the moment the last letter settles */}
      <AnimatePresence>
        {bloom && (
          <motion.div
            key="bloom"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 2.2, 3.8], opacity: [0, 0.50, 0] }}
            exit={{}}
            transition={{ duration: 0.88, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              top: '50%', left: '50%',
              width: '640px', height: '200px',
              marginLeft: '-320px', marginTop: '-100px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.32) 0%, rgba(220,220,255,0.12) 50%, transparent 70%)',
              filter: 'blur(22px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: '16px' }}
        animate={{ opacity: isDissolving || isDark ? 0 : 1 }}
        transition={{ duration: isDissolving ? 0.65 : 0.01, ease: [0.55, 0, 1, 1] }}
      >

        {/* Letter row — each in an overflow:hidden slot so it rises from below */}
        <div className="flex items-end" style={{ gap: '0.01em' }}>
          {LETTERS.map((letter, i) => {
            const revealed = i < revealedCount
            return (
              <div
                key={i}
                style={{
                  overflow: 'hidden',
                  display: 'inline-block',
                  /* height clips the rising letter until it reaches its position */
                  paddingBottom: '0.06em',
                }}
              >
                <motion.span
                  animate={{ y: revealed ? '0%' : '115%' }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 26,
                  }}
                  style={{
                    fontSize: 'clamp(48px, 8vw, 96px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '0.14em',
                    display: 'block',
                    background: 'linear-gradient(180deg, #ffffff 0%, #c8c8c8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.14))',
                  }}
                >
                  {letter}
                </motion.span>
              </div>
            )
          })}
        </div>

        {/* Accent line — draws from centre once holding */}
        <motion.div
          animate={{
            scaleX: phase === 'holding' || isDissolving ? 1 : 0,
            opacity: phase === 'holding' || isDissolving ? 1 : 0,
          }}
          transition={{ duration: 0.75, ease: [0.25, 0.10, 0.25, 1] }}
          style={{
            height: '1px',
            width: '150px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28) 30%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.28) 70%, transparent)',
            transformOrigin: 'center center',
            borderRadius: '1px',
          }}
        />

        {/* Tagline — whisper, only when fully assembled */}
        <motion.p
          animate={{ opacity: phase === 'holding' ? 1 : 0, y: phase === 'holding' ? 0 : 4 }}
          transition={{ duration: 0.5, delay: phase === 'holding' ? 0.2 : 0 }}
          style={{
            fontSize: '8.5px', fontWeight: 500, letterSpacing: '0.40em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)',
            fontFamily: 'var(--font-sans)', marginTop: '-6px',
          }}
        >
          Roblox Seller Platform
        </motion.p>
      </motion.div>

      {/* Bottom hair-line */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.08) 65%, transparent 95%)',
      }} />
    </div>
  )
}
