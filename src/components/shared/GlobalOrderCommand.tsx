'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export default function GlobalOrderCommand() {
  const pathname = usePathname()
  // Orders already has its own entry point; the Dashboard now has the
  // CTA built into its hero composition instead of a floating duplicate.
  if (pathname === '/orders' || pathname === '/') return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed z-40 right-5 sm:right-7 bottom-[max(20px,env(safe-area-inset-bottom))] sm:bottom-[max(28px,env(safe-area-inset-bottom))]"
    >
      <Link href="/orders?create=1" aria-label="Create a new order — the primary action of this platform">
        <motion.div
          whileHover={{ y: -3, scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          animate={{
            boxShadow: [
              '0 0 22px rgba(34,211,238,0.32), 0 8px 28px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)',
              '0 0 36px rgba(34,211,238,0.50), 0 8px 28px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)',
              '0 0 22px rgba(34,211,238,0.32), 0 8px 28px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)',
            ],
          }}
          transition={{ boxShadow: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }, default: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
          className="flex items-center gap-2.5 pl-3 pr-5 rounded-full cursor-pointer select-none"
          style={{
            height: '52px',
            background: 'linear-gradient(135deg, rgba(34,211,238,0.20), rgba(167,139,250,0.13))',
            border: '1px solid rgba(34,211,238,0.40)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', boxShadow: '0 0 16px rgba(34,211,238,0.60)' }}
          >
            <Zap style={{ width: 15, height: 15, color: 'oklch(0.040 0.008 265)' }} fill="oklch(0.040 0.008 265)" />
          </div>
          <span
            className="text-[13.5px] font-extrabold tracking-wide whitespace-nowrap"
            style={{ color: 'rgba(255,255,255,0.94)' }}
          >
            New Order
          </span>
        </motion.div>
      </Link>
    </motion.div>
  )
}
