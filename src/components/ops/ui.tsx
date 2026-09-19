'use client'

import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/* ── Button ────────────────────────────────────────────────────────────────
   Five intents, three sizes. Controls are 40px on touch and 32px from `md`
   up: the same component stays thumb-reachable on a phone and dense on a
   desktop without a second variant set. */

type ButtonIntent = 'primary' | 'neutral' | 'quiet' | 'positive' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const INTENT: Record<ButtonIntent, string> = {
  // The one intent that gets a lift off the surface: a plain, low drop
  // shadow (not a colored halo around the edge) so the operator's next
  // action reads as raised rather than merely tinted.
  primary:
    'bg-[var(--accent)] text-[#16091f] font-semibold shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_3px_10px_-4px_rgba(0,0,0,0.55)] hover:bg-[var(--accent-hi)] active:bg-[var(--accent-deep)] active:shadow-none',
  neutral:
    'bg-[var(--raised)] text-[var(--text)] border border-[var(--line-strong)] hover:bg-[#242434] hover:border-[#3d3d5c]',
  quiet:
    'bg-transparent text-[var(--text-2)] border border-transparent hover:bg-[var(--surface-hi)] hover:text-[var(--text)]',
  positive:
    'bg-[var(--ok-wash)] text-[var(--ok)] border border-[var(--ok-line)] hover:bg-[rgba(61,220,151,0.17)]',
  danger:
    'bg-[var(--bad-wash)] text-[var(--bad)] border border-[var(--bad-line)] hover:bg-[rgba(251,113,133,0.17)]',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 md:h-7 px-2.5 text-[12px] gap-1.5 rounded-[var(--radius-sm)]',
  md: 'h-10 md:h-8 px-3 text-[12.5px] gap-1.5 rounded-[var(--radius-sm)]',
  lg: 'h-11 px-4 text-[13.5px] gap-2 rounded-[var(--radius)]',
}

export interface OpsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent
  size?: ButtonSize
  busy?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, OpsButtonProps>(function Button(
  { intent = 'neutral', size = 'md', busy, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || busy}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-100 active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        INTENT[intent],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {busy && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        'ops-spin inline-block size-4 rounded-full border-2 border-current border-r-transparent opacity-70',
        className,
      )}
    />
  )
}

/* ── Text input ─────────────────────────────────────────────────────────── */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--bg-sunken)] px-3',
          'text-[13px] text-[var(--text)] outline-none transition-colors',
          'hover:border-[var(--line-strong)] focus:border-[var(--accent-line)]',
          'disabled:opacity-45',
          className,
        )}
        {...rest}
      />
    )
  },
)

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="ops-label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--text-3)]">{hint}</span>}
    </label>
  )
}

/* ── Segmented control ─────────────────────────────────────────────────────
   Used wherever a choice has 2–4 options and the options matter more than the
   chrome around them (income/expense, order source, account filter). */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string; count?: number }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        // Scrolls rather than squeezing: a squeezed option truncates its own
        // label, and a filter you cannot read is not a filter.
        'ops-scroll inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-sunken)] p-0.5',
        className,
      )}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3',
              'whitespace-nowrap text-[12.5px] font-semibold transition-colors',
              active
                ? 'bg-[var(--raised)] text-[var(--text)]'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  'num text-[11px] font-bold',
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Status dot + pill ─────────────────────────────────────────────────────
   Deliberately no yellow anywhere in the palette: lavender means "this needs
   you", emerald means "clear to go", coral means "something is wrong", and
   neutral grey means "nothing to do yet". */

export type Tone = 'accent' | 'ok' | 'bad' | 'blue' | 'amber' | 'pink' | 'neutral'

const TONE_FG: Record<Tone, string> = {
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  blue: 'var(--blue)',
  amber: 'var(--amber)',
  pink: 'var(--pink)',
  neutral: 'var(--text-3)',
}

const TONE_PILL: Record<Tone, string> = {
  accent: 'bg-[var(--accent-wash)] text-[var(--accent)]',
  ok: 'bg-[var(--ok-wash)] text-[var(--ok)]',
  bad: 'bg-[var(--bad-wash)] text-[var(--bad)]',
  blue: 'bg-[var(--blue-wash)] text-[var(--blue)]',
  amber: 'bg-[var(--amber-wash)] text-[var(--amber)]',
  pink: 'bg-[var(--pink-wash)] text-[var(--pink)]',
  neutral: 'bg-[var(--surface-hi)] text-[var(--text-2)]',
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-1.5 shrink-0 rounded-full', className)}
      style={{ background: TONE_FG[tone] }}
    />
  )
}

export function Pill({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em]',
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Overlay ────────────────────────────────────────────────────────────────
   Bottom sheet on phones, centred panel from `sm` up — one component so every
   dialog in the app behaves the same way on both. Rendered inline (not
   portalled) so it stays inside .ops-root and inherits the console's tokens. */

export function Overlay({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  const maxW = width === 'sm' ? 'sm:max-w-md' : width === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div
        className="ops-scrim absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'ops-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden outline-none',
          'rounded-t-[18px] border border-[var(--line-strong)] bg-[var(--surface)]',
          'sm:ops-enter sm:max-h-[86dvh] sm:rounded-[var(--radius-lg)]',
          maxW,
        )}
      >
        <header className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text)]">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 text-[12px] text-[var(--text-2)]">{subtitle}</div>
            )}
          </div>
          <Button intent="quiet" size="sm" onClick={onClose} aria-label="Close" className="px-2">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </header>

        <div className="ops-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--bg-sunken)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ── Empty / loading states ───────────────────────────────────────────────── */

export function Empty({
  title,
  body,
  action,
  className,
}: {
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <p className="text-[13.5px] font-semibold text-[var(--text-2)]">{title}</p>
      {body && <p className="mt-1.5 max-w-[34ch] text-[12.5px] leading-relaxed text-[var(--text-3)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-px', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3.5">
          <div className="size-2 rounded-full bg-[var(--line)]" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-2.5 rounded bg-[var(--line)]"
              style={{ width: `${44 + ((i * 13) % 34)}%`, opacity: 1 - i * 0.12 }}
            />
            <div
              className="h-2 rounded bg-[var(--line-soft)]"
              style={{ width: `${26 + ((i * 9) % 22)}%`, opacity: 1 - i * 0.12 }}
            />
          </div>
          <div className="h-2.5 w-12 rounded bg-[var(--line)]" style={{ opacity: 1 - i * 0.12 }} />
        </div>
      ))}
    </div>
  )
}
