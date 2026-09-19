'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, Users, Wallet, LogOut, ChevronDown, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* The entire product is three destinations. Legacy surfaces (dashboard,
   inventory, integrity, transactions, analytics, seller access) are still
   served at their own URLs but are deliberately absent from navigation. */
const NAV = [
  { href: '/', label: 'Orders', icon: ClipboardList },
  { href: '/accounts', label: 'Accounts', icon: Users },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/orders')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const current = NAV.find(n => isActive(pathname, n.href))

  return (
    // A fixed-height app frame rather than a scrolling document: the page never
    // scrolls, each pane does. That is what keeps the queue in place while the
    // work area scrolls, and what makes the action bar reliably reachable.
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      <header className="z-50 flex h-[var(--topbar-h)] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-3 lg:px-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-[var(--radius-sm)] py-1" aria-label="XOB home">
          <span
            className="grid size-7 place-items-center rounded-[7px] text-[13px] font-black text-[var(--accent-ink)]"
            style={{ background: 'linear-gradient(145deg,var(--accent-hi),var(--accent-deep))' }}
          >
            X
          </span>
          <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text)]">XOB</span>
        </Link>

        {/* Desktop navigation. Tabs read as destinations, with the active one
            carrying the accent rather than a heavy filled chip. */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-[13.5px] font-semibold transition-colors',
                  active
                    ? 'bg-[var(--accent-wash)] text-[var(--accent)]'
                    : 'text-[var(--text-3)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Phone: the bar names where you are, since the tabs are at the bottom. */}
        {current && (
          <span className="truncate text-[15px] font-semibold text-[var(--text)] lg:hidden">
            {current.label}
          </span>
        )}

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-2)]"
          >
            <UserRound className="size-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">Operator</span>
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="ops-enter absolute right-0 top-[calc(100%+6px)] z-20 w-48 overflow-hidden rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--raised)] p-1 shadow-[0_18px_44px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={signOut}
                  className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium text-[var(--bad)] transition-colors hover:bg-[var(--bad-wash)]"
                >
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>

      <nav
        aria-label="Primary"
        className="z-50 shrink-0 border-t border-[var(--line)] bg-[var(--bg)] lg:hidden"
      >
        <div className="flex h-[var(--tabbar-h)] items-stretch">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                )}
              >
                <Icon className="size-[19px]" aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </div>
  )
}
