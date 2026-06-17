'use client'

import { motion } from 'framer-motion'
import { fadeUpVariants, staggerContainer, staggerItem } from '@/lib/motion'
import { ReactNode } from 'react'

interface PageHeroProps {
  badge?: string
  title: string
  subtitle?: string
  gradient?: string
  children?: ReactNode
}

export default function PageHero({ badge, title, subtitle, gradient, children }: PageHeroProps) {
  const grad = gradient ?? 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, rgba(255,255,255,0.80) 100%)'

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="px-4 sm:px-6 pt-8 pb-6 max-w-[1340px] mx-auto"
    >
      {badge && (
        <motion.div variants={staggerItem} className="mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: 'rgba(34,211,238,0.08)',
              border: '1px solid rgba(34,211,238,0.20)',
              color: '#22d3ee',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }}
            />
            {badge}
          </span>
        </motion.div>
      )}

      <motion.h1
        variants={staggerItem}
        className="hero-headline"
        style={{ backgroundImage: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
      >
        {title}
      </motion.h1>

      {subtitle && (
        <motion.p variants={staggerItem} className="hero-subtext mt-3">
          {subtitle}
        </motion.p>
      )}

      {children && (
        <motion.div variants={fadeUpVariants} className="mt-5">
          {children}
        </motion.div>
      )}

      {/* Accent separator */}
      <motion.div
        variants={staggerItem}
        className="mt-6"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, rgba(34,211,238,0.30) 0%, rgba(167,139,250,0.20) 50%, transparent 100%)',
        }}
      />
    </motion.div>
  )
}
