'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Variants } from 'framer-motion'
import { scrollStaggerContainer } from '@/lib/motion'

interface SectionRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  stagger?: boolean
}

export default function SectionReveal({ children, className, delay = 0, stagger = false }: SectionRevealProps) {
  const solo: Variants = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.44, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  }

  return (
    <motion.div
      className={className}
      variants={stagger ? scrollStaggerContainer : solo}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  )
}
