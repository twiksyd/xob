'use client'

import { motion } from 'framer-motion'

export default function TwicksHero() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: '200px',
        background: '#080502',
        border: '1px solid rgba(212,160,23,0.14)',
        boxShadow: 'inset 0 1px 0 rgba(212,160,23,0.07), 0 0 80px rgba(200,140,10,0.05)',
      }}
    >
      {/* Warm amber spotlight centered behind the text */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 65% 110% at 50% 55%, rgba(200,138,8,0.13) 0%, transparent 68%)',
        }}
      />

      {/* Single breathing gold orb — slow, dignified */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '55%', height: '180px',
          background: 'radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 65%)',
          filter: 'blur(42px)',
          top: '-10px', left: '50%', marginLeft: '-27.5%',
        }}
        animate={{ scale: [1, 1.10, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Edge vignette — keep corners dark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 40%, rgba(4,2,1,0.80) 100%)',
        }}
      />

      {/* Noise grain — very faint, adds texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.018,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: '10px' }}>

        {/* TWICKS — slow gold shimmer + breathing glow */}
        <span
          className="hero-gold-text"
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

        {/* Thin gold divider */}
        <div style={{
          width: '72px', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.55) 40%, rgba(255,215,0,0.70) 50%, rgba(212,160,23,0.55) 60%, transparent)',
        }} />

        {/* Tagline */}
        <p style={{
          fontSize: '8.5px', fontWeight: 600, letterSpacing: '0.34em',
          textTransform: 'uppercase', color: 'rgba(212,160,23,0.32)',
          fontFamily: 'var(--font-sans)',
          marginTop: '-2px',
        }}>
          Roblox Seller Platform
        </p>
      </div>

      {/* Bottom gold edge */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.28) 25%, rgba(255,215,0,0.48) 50%, rgba(212,160,23,0.28) 75%, transparent)',
      }} />

      {/* Top specular rim */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.07) 30%, rgba(255,215,0,0.14) 50%, rgba(255,215,0,0.07) 70%, transparent)',
      }} />
    </div>
  )
}
