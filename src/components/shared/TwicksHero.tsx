'use client'

import { motion } from 'framer-motion'

export default function TwicksHero() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: '200px' }}>

      {/* Base */}
      <div className="absolute inset-0" style={{ background: 'oklch(0.055 0.030 272)' }} />

      {/* Scrolling grid — lines drift upward */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent 0px, transparent 39px, rgba(139,92,246,0.08) 39px, rgba(139,92,246,0.08) 40px)',
            'repeating-linear-gradient(90deg, transparent 0px, transparent 79px, rgba(139,92,246,0.05) 79px, rgba(139,92,246,0.05) 80px)',
          ].join(', '),
          backgroundSize: '80px 40px',
        }}
        animate={{ backgroundPosition: ['0px 0px', '0px -40px'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Purple orb — left */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '48%', height: '280px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.52) 0%, transparent 65%)',
          filter: 'blur(55px)',
          top: '-80px', left: '-8%',
        }}
        animate={{ x: [0, 45, -20, 35, 0], y: [0, 20, -10, 25, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Cyan orb — right */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '42%', height: '260px',
          background: 'radial-gradient(circle, rgba(34,211,238,0.40) 0%, transparent 65%)',
          filter: 'blur(52px)',
          bottom: '-60px', right: '-6%',
        }}
        animate={{ x: [0, -35, 22, -28, 0], y: [0, -18, 12, -28, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Pink orb — top center */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '32%', height: '180px',
          background: 'radial-gradient(circle, rgba(232,121,249,0.28) 0%, transparent 65%)',
          filter: 'blur(48px)',
          top: '-30px', right: '22%',
        }}
        animate={{ x: [0, -28, 18, -22, 0], y: [0, 28, -8, 18, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(2,1,8,0.72) 100%)',
        }}
      />

      {/* Periodic scanner line — auto-sweeps every ~7s */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: 0, bottom: 0, width: '2px',
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.65) 28%, rgba(255,255,255,0.96) 50%, rgba(255,255,255,0.65) 72%, transparent)',
          boxShadow: '0 0 18px 8px rgba(200,200,255,0.40)',
        }}
        animate={{ left: ['-2%', '102%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.82, repeat: Infinity, repeatDelay: 6.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">

        {/* TWICKS — continuously shimmering metallic */}
        <span
          className="hero-shimmer-text"
          style={{
            fontSize: 'clamp(52px, 8.5vw, 100px)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            display: 'block',
          }}
        >
          TWICKS
        </span>

        {/* Tagline */}
        <p style={{
          fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.30em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)',
          fontFamily: 'var(--font-sans)',
        }}>
          Your Roblox Seller Platform
        </p>
      </div>

      {/* Bottom glow edge */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.45) 25%, rgba(34,211,238,0.55) 50%, rgba(139,92,246,0.45) 75%, transparent 100%)',
        }}
      />

      {/* Top specular edge */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.10) 70%, transparent 100%)',
        }}
      />
    </div>
  )
}
