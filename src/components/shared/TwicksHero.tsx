'use client'

import { motion } from 'framer-motion'

export default function TwicksHero() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: '200px',
        background: '#050506',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Overhead light — single faint white spot, no color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 90% at 50% 35%, rgba(255,255,255,0.048) 0%, transparent 70%)',
        }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: '14px' }}>

        {/*
          TWICKS — single-unit reveal.
          blur-to-sharp + upward drift: the word coalesces from nothing,
          as if materialising. Stays put forever after.
        */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.5, ease: [0.25, 0.10, 0.25, 1] }}
          className="twicks-glow"
        >
          <span
            style={{
              fontSize: 'clamp(48px, 8vw, 96px)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '0.14em',
              display: 'block',
              /* Top-lit overhead gradient — like light on a raised metal surface */
              background: 'linear-gradient(180deg, #ffffff 0%, #cccccc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            TWICKS
          </span>
        </motion.div>

        {/* Accent line — grows from the centre outward after text settles */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1.0, delay: 0.9, ease: [0.25, 0.10, 0.25, 1] }}
          style={{
            height: '1px',
            width: '160px',
            background: 'rgba(255,255,255,0.18)',
            transformOrigin: 'center center',
            borderRadius: '1px',
          }}
        />

        {/* Tagline — whisper-quiet, very wide tracking */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 1.2 }}
          style={{
            fontSize: '8.5px',
            fontWeight: 500,
            letterSpacing: '0.40em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.18)',
            fontFamily: 'var(--font-sans)',
            marginTop: '-6px',
          }}
        >
          Roblox Seller Platform
        </motion.p>
      </div>

      {/* Hair-line bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.09) 35%, rgba(255,255,255,0.09) 65%, transparent 95%)',
        }}
      />
    </div>
  )
}
