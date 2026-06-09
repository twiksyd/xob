'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion, animate, useMotionValue, useTransform } from 'framer-motion'

const SWEEP_S = 2.6   // seconds to cross full width
const PAUSE_MS = 650  // pause before repeating

export default function TwicksHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const beamX        = useMotionValue(-120)

  // Narrow illuminated window follows the beam
  const maskImage = useTransform(beamX, (x) =>
    `linear-gradient(90deg,
      transparent ${x - 70}px,
      white       ${x - 16}px,
      white       ${x + 16}px,
      transparent ${x + 70}px)`
  )

  const runSweep = useCallback(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    beamX.set(-120)
    animate(beamX, w + 120, {
      duration: SWEEP_S,
      ease: 'linear',
      onComplete: () => setTimeout(runSweep, PAUSE_MS),
    })
  }, [beamX])

  useEffect(() => {
    const id = setTimeout(runSweep, 300)
    return () => clearTimeout(id)
  }, [runSweep])

  const textStyle: React.CSSProperties = {
    fontSize: 'clamp(48px, 8vw, 96px)',
    fontWeight: 900,
    letterSpacing: '0.14em',
    lineHeight: 1,
    display: 'block',
    userSelect: 'none',
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: '200px', background: '#040405', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Overhead spotlight */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 55% 90% at 50% 35%, rgba(255,255,255,0.04) 0%, transparent 70%)',
      }} />

      {/* Static white base text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
        <span style={{
          ...textStyle,
          background: 'linear-gradient(180deg, #ffffff 0%, #b0b0b0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          TWICKS
        </span>
      </div>

      {/* Red illumination layer — only visible inside the moving beam window */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <span style={{
          ...textStyle,
          color: '#ff2222',
          filter: [
            'drop-shadow(0 0 6px  rgba(255, 50, 50, 1.0))',
            'drop-shadow(0 0 18px rgba(255, 10, 10, 0.85))',
            'drop-shadow(0 0 45px rgba(255,  0,  0, 0.45))',
          ].join(' '),
        }}>
          TWICKS
        </span>
      </motion.div>

      {/* Beam — thin bright red cursor line */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: '14%', bottom: '14%',
          width: '2px',
          x: beamX,
          translateX: '-50%',
          borderRadius: '1px',
          background: [
            'linear-gradient(180deg,',
            '  transparent 0%,',
            '  rgba(255, 80, 80, 0.85) 12%,',
            '  rgba(255,255,255, 1.00) 50%,',
            '  rgba(255, 80, 80, 0.85) 88%,',
            '  transparent 100%)',
          ].join(' '),
          boxShadow: [
            '0 0  4px  2px rgba(255, 80, 80, 0.95)',
            '0 0 14px  6px rgba(255, 20, 20, 0.60)',
            '0 0 36px 16px rgba(255,  0,  0, 0.28)',
          ].join(', '),
        }}
      />

      {/* Tagline */}
      <div className="absolute bottom-[18px] left-0 right-0 flex flex-col items-center gap-[8px] pointer-events-none">
        <div style={{
          height: '1px', width: '140px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 30%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.18) 70%, transparent)',
        }} />
        <p style={{
          fontSize: '8px', fontWeight: 500, letterSpacing: '0.40em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.16)',
          fontFamily: 'var(--font-sans)',
        }}>
          Roblox Seller Platform
        </p>
      </div>

      {/* Bottom hair-line */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.08) 65%, transparent 95%)',
      }} />
    </div>
  )
}
