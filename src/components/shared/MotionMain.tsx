'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { pageVariants } from '@/lib/motion'

export default function MotionMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  )
}
