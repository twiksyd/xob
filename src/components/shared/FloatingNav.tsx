'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box, LayoutDashboard, Users, Package, ShoppingCart, Receipt,
  Wallet, ShieldCheck, TrendingUp, Archive, LogOut, Menu, X,
} from 'lucide-react'

const navItems = [
  { href: '/',                  label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/accounts',          label: 'Accounts',     icon: Users           },
  { href: '/inventory',         label: 'Inventory',    icon: Package         },
  { href: '/orders',            label: 'Orders',       icon: ShoppingCart    },
  { href: '/transactions',      label: 'Transactions', icon: Receipt         },
  { href: '/wallet',            label: 'Wallet',       icon: Wallet          },
  { href: '/integrity',         label: 'Integrity',    icon: ShieldCheck     },
  { href: '/overall-sales',     label: 'Overall Sales',icon: TrendingUp      },
  { href: '/seller-inventory',  label: 'Seller Accts', icon: Archive         },
]

export default function FloatingNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Floating top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-3 sm:px-4">
        <nav
          className="w-full max-w-[1340px] h-14 flex items-center px-3 sm:px-4 gap-1"
          style={{
            background: scrolled ? 'rgba(7, 5, 18, 0.90)' : 'rgba(7, 5, 18, 0.72)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.088)',
            borderRadius: '18px',
            boxShadow: scrolled
              ? 'inset 0 1px 0 rgba(255,255,255,0.060), 0 4px 28px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.50)'
              : 'inset 0 1px 0 rgba(255,255,255,0.040), 0 2px 12px rgba(0,0,0,0.44)',
            transition: 'background 0.28s ease, box-shadow 0.28s ease',
          }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 mr-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)',
                boxShadow: '0 0 14px rgba(34,211,238,0.28), inset 0 1px 0 rgba(255,255,255,0.22)',
              }}
            >
              <Box className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-[14px] font-black tracking-tight hidden sm:block"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              XOB
            </span>
          </Link>

          {/* Separator */}
          <div
            className="hidden lg:block h-5 w-px mr-2 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />

          {/* Desktop nav items */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tracking-wide transition-all duration-150 whitespace-nowrap flex-shrink-0"
                  style={{
                    color: active ? '#22d3ee' : 'rgba(255,255,255,0.40)',
                    background: active ? 'rgba(34,211,238,0.08)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(34,211,238,0.20)' : 'transparent'}`,
                    textShadow: active ? '0 0 12px rgba(34,211,238,0.40)' : 'none',
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={active ? { filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.65))' } : {}}
                  />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {/* Sign out — desktop */}
            <button
              onClick={handleSignOut}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
              style={{ color: 'rgba(255,255,255,0.24)' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>

            {/* Hamburger — mobile/tablet */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all"
              style={{
                background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: 'rgba(255,255,255,0.70)',
                border: menuOpen ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent',
              }}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Menu panel */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.20, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-[74px] left-3 right-3 z-50 rounded-2xl overflow-hidden lg:hidden"
              style={{
                background: 'rgba(7, 5, 18, 0.97)',
                backdropFilter: 'blur(40px) saturate(170%)',
                WebkitBackdropFilter: 'blur(40px) saturate(170%)',
                border: '1px solid rgba(255,255,255,0.100)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.058), 0 8px 40px rgba(0,0,0,0.72)',
              }}
            >
              <div className="p-3 grid grid-cols-2 gap-1.5">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px] font-semibold transition-all"
                      style={{
                        color: active ? '#22d3ee' : 'rgba(255,255,255,0.52)',
                        background: active ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.028)',
                        border: `1px solid ${active ? 'rgba(34,211,238,0.20)' : 'rgba(255,255,255,0.060)'}`,
                      }}
                    >
                      <Icon
                        className="w-4 h-4 flex-shrink-0"
                        style={active ? { color: '#22d3ee', filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.65))' } : {}}
                      />
                      {label}
                    </Link>
                  )
                })}
              </div>

              {/* Sign out row */}
              <div className="px-3 pb-3">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px] font-semibold transition-all hover:bg-red-500/10"
                  style={{
                    color: 'rgba(248,113,113,0.65)',
                    background: 'rgba(248,113,113,0.048)',
                    border: '1px solid rgba(248,113,113,0.12)',
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
