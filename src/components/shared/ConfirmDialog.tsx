'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve })
  }, [])

  function settle(result: boolean) {
    resolveRef.current?.(result)
    resolveRef.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {options && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="absolute inset-0 glass-modal-overlay"
              onClick={() => settle(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative w-full max-w-[400px] glass-modal p-6"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
                style={options.danger
                  ? { background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.26)' }
                  : { background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.26)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: options.danger ? '#f87171' : '#22d3ee' }} />
              </div>

              <p className="text-[15px] font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {options.title}
              </p>
              <p className="text-[12.5px] leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.50)' }}>
                {options.description}
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="px-4 h-9 rounded-full text-[12px] font-bold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
                >
                  {options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className="px-4 h-9 rounded-full text-[12px] font-bold transition-all"
                  style={options.danger
                    ? { background: 'linear-gradient(135deg, #f43f5e, #e879f9)', color: 'white', boxShadow: '0 0 20px rgba(244,63,94,0.30)' }
                    : { background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', color: 'oklch(0.040 0.008 265)', boxShadow: '0 0 20px rgba(34,211,238,0.28)' }}
                >
                  {options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
