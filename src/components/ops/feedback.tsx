'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button, Dot, type Tone } from './ui'
import { cn } from '@/lib/utils'

/* Toast and Confirm keep the same hook signatures as the legacy providers
   (`useToast().success/error/info`, `await useConfirm()({...})`) so the order
   and account logic ported from the old pages runs unchanged. */

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const TOAST_TONE: Record<ToastKind, Tone> = {
  success: 'ok',
  error: 'bad',
  info: 'accent',
}

// Errors stay up long enough to actually be read — a failed Robux assignment
// names the account and the shortfall, which is not a two-second message.
const TOAST_MS: Record<ToastKind, number> = { success: 2600, error: 7000, info: 3600 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<number[]>([])

  useEffect(
    () => () => {
      timersRef.current.forEach(t => window.clearTimeout(t))
    },
    [],
  )

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current
      setToasts(prev => [...prev.slice(-3), { id, kind, message }])
      timersRef.current.push(window.setTimeout(() => dismiss(id), TOAST_MS[kind]))
    },
    [dismiss],
  )

  // `push` is stable, so the api object is too — consumers can safely put
  // `toast` in a dependency list without re-running on every toast.
  const api = useMemo<ToastApi>(
    () => ({
      success: m => push('success', m),
      error: m => push('error', m),
      info: m => push('info', m),
    }),
    [push],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-3',
          // Clears the mobile tab bar; sits just under the top bar on desktop.
          'bottom-[calc(var(--tabbar-h)+12px+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-[calc(var(--topbar-h)+12px)]',
        )}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className="ops-enter pointer-events-auto flex w-full max-w-[420px] items-start gap-2.5 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--raised)] px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
          >
            <Dot tone={TOAST_TONE[t.kind]} className="mt-[7px]" />
            <p className="flex-1 text-[12.5px] leading-snug text-[var(--text)]">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-1 p-1 text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within the ops ToastProvider')
  return ctx
}

/* ── Confirm ──────────────────────────────────────────────────────────────── */

interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmCtx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(opts => {
    setOptions(opts)
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setOptions(null)
  }, [])

  useEffect(() => {
    if (!options) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') settle(false)
      if (e.key === 'Enter') settle(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [options, settle])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <div className="ops-scrim absolute inset-0 bg-black/70" onClick={() => settle(false)} aria-hidden />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={options.title}
            className="ops-sheet relative w-full rounded-t-[18px] border border-[var(--line-strong)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:ops-enter sm:max-w-[420px] sm:rounded-[var(--radius-lg)] sm:pb-5"
          >
            <h2 className="text-[15px] font-semibold text-[var(--text)]">{options.title}</h2>
            <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--text-2)]">
              {options.description}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button intent="quiet" size="lg" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                intent={options.danger ? 'danger' : 'primary'}
                size="lg"
                onClick={() => settle(true)}
                autoFocus
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used within the ops ConfirmProvider')
  return ctx
}
