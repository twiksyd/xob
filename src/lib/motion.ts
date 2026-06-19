import type { Variants, Transition } from 'framer-motion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (duration: number, delay = 0): any => ({
  duration,
  delay,
  ease: [0.16, 1, 0.3, 1],
})

export const pageVariants: Variants = {
  initial:  { opacity: 0, y: 10 },
  animate:  { opacity: 1, y: 0, transition: t(0.28) },
}

export const fadeUpVariants: Variants = {
  initial:  { opacity: 0, y: 6 },
  animate:  { opacity: 1, y: 0, transition: t(0.22) },
  exit:     { opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
}

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } as Transition },
}

export const staggerItem: Variants = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0, transition: t(0.22) },
}

// Slower, more perceptible stagger for small grids of stat/summary cards (3-5 items) —
// staggerContainer's 0.04s interval reads as nearly simultaneous at that count.
export const cardStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } as Transition },
}

export const cardStaggerItem: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: t(0.45) },
}

export const springToggle: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 320,
}

// ── Phase 5 additions ──────────────────────────────────────────────────────────

// Scroll-driven section reveal — use with whileInView="animate" initial="initial"
export const scrollFadeUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: t(0.44) },
}

// Staggered scroll reveal container — pair with scrollFadeUp items
export const scrollStaggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } as Transition },
}

// Subtle scale lift on hover — spread as motion props
export const hoverLift = {
  whileHover: { y: -2, scale: 1.008, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
  whileTap:   { scale: 0.98, transition: { duration: 0.10 } },
} as const

// Micro scale on hover for interactive elements (buttons, chips)
export const hoverScale = {
  whileHover: { scale: 1.03, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
  whileTap:   { scale: 0.96, transition: { duration: 0.10 } },
} as const

// Continuous ambient float for decorative orbs / background elements
export const ambientFloat: Variants = {
  animate: {
    y: [0, -12, 0],
    transition: {
      duration: 7,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// Slow drift float (offset for second orb) — different phase so orbs don't sync
export const ambientDrift: Variants = {
  animate: {
    y: [0, 10, 0],
    x: [0, -6, 0],
    transition: {
      duration: 9,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}
