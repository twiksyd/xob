'use client'

import { useEffect, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

type Phase = 'dark' | 'building' | 'holding' | 'dissolving'

const BUILD_S = 3.4

/*
  Heartbeat pattern — opacity spikes and drops like an EKG while blur
  gradually clears. Three beats of increasing strength, then full resolution.

  beat 1: flash to 24%, nearly vanishes  ("blurry → none → blurry")
  beat 2: flash to 46%, drops back        (building)
  beat 3: flash to 74%, small dip         (almost there)
  final:  resolves to 100%, sharp          (full reveal)
*/
const TIMES   = [0,    0.09, 0.18, 0.30, 0.42, 0.55, 0.66, 0.78, 0.90, 1.00]
const OPACITY = [0,    0.24, 0.02, 0.46, 0.06, 0.74, 0.15, 0.88, 0.97, 1.00]
const BLURS   = [30,   17,   26,   12,   21,    5,   14,    2,    0.5,  0   ] // px
const SCALES  = [0.97, 1.00, 0.97, 1.01, 0.97, 1.02, 0.98, 1.01, 1.00, 1.00]

export default function TwicksHero() {
  const [phase, setPhase] = useState<Phase>('dark')
  const controls = useAnimationControls()

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    if (phase === 'dark') {
      controls.set({ opacity: 0, filter: 'blur(30px)', scale: 0.97 })
      timers.push(setTimeout(() => setPhase('building'), 450))

    } else if (phase === 'building') {
      controls.start({
        opacity: OPACITY,
        filter: BLURS.map(b => `blur(${b}px)`),
        scale: SCALES,
        transition: { duration: BUILD_S, times: TIMES, ease: 'linear' },
      })
      timers.push(setTimeout(() => setPhase('holding'), BUILD_S * 1000 + 100))

    } else if (phase === 'holding') {
      timers.push(setTimeout(() => setPhase('dissolving'), 2200))

    } else {
      // dissolving — blur grows back as it fades
      controls.start({
        opacity: [1, 0.50, 0],
        filter: ['blur(0px)', 'blur(7px)', 'blur(24px)'],
        scale: [1.00, 0.99, 0.97],
        transition: { duration: 0.80, times: [0, 0.45, 1], ease: [0.55, 0, 1, 1] },
      })
      timers.push(setTimeout(() => setPhase('dark'), 820))
    }

    return () => timers.forEach(clearTimeout)
  }, [phase, controls])

  const isHolding = phase === 'holding'

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: '200px', background: '#040405', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Overhead spotlight */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 55% 90% at 50% 35%, rgba(255,255,255,0.048) 0%, transparent 70%)',
      }} />

      {/* Whole-unit heartbeat animation */}
      <motion.div
        animate={controls}
        initial={{ opacity: 0, filter: 'blur(30px)', scale: 0.97 }}
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: '16px' }}
      >
        {/* TWICKS word */}
        <div className={isHolding ? 'twicks-glow' : ''}>
          <span style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 900,
            letterSpacing: '0.14em',
            background: 'linear-gradient(180deg, #ffffff 0%, #c8c8c8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'block',
          }}>
            TWICKS
          </span>
        </div>

        {/* Accent line — draws from centre on hold */}
        <motion.div
          animate={{ scaleX: isHolding ? 1 : 0, opacity: isHolding ? 1 : 0 }}
          transition={{ duration: 0.70, ease: [0.25, 0.10, 0.25, 1] }}
          style={{
            height: '1px', width: '150px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28) 30%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.28) 70%, transparent)',
            transformOrigin: 'center center',
          }}
        />

        {/* Tagline — whispers in on hold */}
        <motion.p
          animate={{ opacity: isHolding ? 1 : 0, y: isHolding ? 0 : 4 }}
          transition={{ duration: 0.50, delay: isHolding ? 0.20 : 0 }}
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
