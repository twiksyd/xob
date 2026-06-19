'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; type: ToastType; message: string }

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE: Record<ToastType, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle2, color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.26)' },
  error:   { icon: XCircle,      color: '#f87171', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.26)' },
  info:    { icon: Info,         color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.26)' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), 3800)
  }, [dismiss])

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed left-1/2 z-50 flex flex-col items-center gap-2 px-4"
        style={{ top: '88px', transform: 'translateX(-50%)', width: 'min(420px, calc(100vw - 32px))' }}
      >
        <AnimatePresence>
          {toasts.map(({ id, type, message }) => {
            const tone = TONE[type]
            const Icon = tone.icon
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 w-full rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(10,8,24,0.92)',
                  border: `1px solid ${tone.border}`,
                  backdropFilter: 'blur(28px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
                  boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 24px ${tone.bg}`,
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: tone.color }} />
                <p className="text-[12.5px] font-semibold flex-1 leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(id)}
                  className="flex-shrink-0 opacity-50 hover:opacity-90 transition-opacity"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.70)' }} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
