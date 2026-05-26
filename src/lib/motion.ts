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

export const springToggle: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 320,
}
