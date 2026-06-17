'use client'

import { motion } from 'framer-motion'
import { ambientFloat, ambientDrift } from '@/lib/motion'

export default function AmbientOrbs() {
  return (
    <div className="ambient-orbs" aria-hidden>
      <motion.div className="ambient-orb ambient-orb-1" variants={ambientFloat} animate="animate" />
      <motion.div className="ambient-orb ambient-orb-2" variants={ambientDrift} animate="animate" />
      <motion.div className="ambient-orb ambient-orb-3" variants={ambientFloat} animate="animate"
        style={{ animationDelay: '2s' }}
        initial={{ y: -6 }}
      />
      <motion.div className="ambient-orb ambient-orb-4" variants={ambientDrift} animate="animate"
        initial={{ y: 5, x: 3 }}
      />
    </div>
  )
}
