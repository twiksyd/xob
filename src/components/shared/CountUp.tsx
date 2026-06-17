'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import type { CSSProperties } from 'react'

interface CountUpProps {
  value: number
  format?: (v: number) => string
  duration?: number
  className?: string
  style?: CSSProperties
}

export default function CountUp({ value, format, duration = 1.8, className, style }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)
  const startRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!isInView) return
    startRef.current = undefined
    const step = (ts: number) => {
      if (startRef.current === undefined) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(eased * value)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isInView, value, duration])

  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString())

  return (
    <span ref={ref} className={className} style={style}>
      {fmt(display)}
    </span>
  )
}
