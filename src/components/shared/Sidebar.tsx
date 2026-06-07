'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt, LogOut, Box, Wallet, TrendingUp, Archive,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/accounts',     label: 'Accounts',     icon: Users           },
  { href: '/inventory',    label: 'Inventory',    icon: Package         },
  { href: '/orders',       label: 'Orders',       icon: ShoppingCart    },
  { href: '/transactions', label: 'Transactions', icon: Receipt         },
  { href: '/wallet',         label: 'Wallet',         icon: Wallet     },
  { href: '/overall-sales',    label: 'Overall Sales',  icon: TrendingUp },
  { href: '/seller-inventory', label: 'Seller Accts',  icon: Archive    },
]

const LS_COLLAPSED = 'xob_sidebar_collapsed'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_COLLAPSED)
      if (saved === '1') setCollapsed(true)
    } catch {}
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(LS_COLLAPSED, next ? '1' : '0') } catch {}
      return next
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="relative flex flex-col h-screen flex-shrink-0 z-10 transition-[width] duration-200 ease-out"
      style={{
        width: collapsed ? '76px' : '220px',
        background: 'linear-gradient(180deg, rgba(8,5,28,0.97) 0%, rgba(13,8,42,0.96) 60%, rgba(10,6,34,0.96) 100%)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderRight: '1px solid rgba(139,92,246,0.16)',
        boxShadow: '6px 0 48px rgba(6,4,20,0.32), inset -1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Top ambient glow */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 70% at 50% -15%, rgba(139,92,246,0.22), transparent)' }}
      />
      {/* Bottom ambient glow — warm counter-point */}
      <div
        className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 115%, rgba(232,121,249,0.10), transparent)' }}
      />

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-4 top-[28px] w-8 h-8 rounded-full flex items-center justify-center z-30 transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, #e879f9 100%)',
          border: '1px solid rgba(255,255,255,0.35)',
          color: 'white',
          boxShadow: '0 0 0 4px rgba(8,5,28,0.9), 0 4px 16px rgba(167,139,250,0.55), 0 0 20px rgba(34,211,238,0.35)',
        }}
      >
        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
      </button>

      {/* Logo */}
      <div
        className={cn('relative flex items-center gap-3 px-5 py-[22px]', collapsed && 'justify-center px-0')}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, #e879f9 100%)',
            boxShadow: '0 0 16px rgba(34,211,238,0.35), 0 0 32px rgba(167,139,250,0.14), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <Box className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-[14px] font-black tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
              XOB
            </p>
            <p className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Seller
            </p>
          </div>
        )}
      </div>

      {/* Nav section label */}
      {!collapsed && (
        <p
          className="relative px-5 pt-5 pb-2"
          style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.20)' }}
        >
          Navigation
        </p>
      )}

      {/* Nav items */}
      <nav className={cn('relative flex-1 px-3 space-y-0.5 overflow-y-auto', collapsed && 'pt-5')}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-150',
                collapsed && 'justify-center px-0',
                active
                  ? 'nav-active-dark text-white/95'
                  : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'
              )}
            >
              <Icon
                className="w-[14px] h-[14px] flex-shrink-0 transition-colors"
                style={active ? { color: '#22d3ee', filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.7))' } : {}}
              />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div
        className="relative mx-5 my-2"
        style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}
      />

      {/* Sign Out */}
      <div className="relative px-3 pb-5">
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-150 text-white/28 hover:text-red-400/80 hover:bg-red-500/[0.06]',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
