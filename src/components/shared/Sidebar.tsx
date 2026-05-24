'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt,
  LogOut, Box, ChevronLeft, ChevronRight, BarChart2, Settings,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/accounts',     label: 'Accounts',     icon: Users           },
  { href: '/inventory',    label: 'Inventory',    icon: Package         },
  { href: '/orders',       label: 'Orders',       icon: ShoppingCart    },
  { href: '/transactions', label: 'Transactions', icon: Receipt         },
  { href: '/analytics',    label: 'Analytics',    icon: BarChart2       },
  { href: '/settings',     label: 'Settings',     icon: Settings        },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen transition-all duration-300 overflow-hidden',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 35%, #4c1d95 65%, #7c3aed 100%)',
        borderRight: '1px solid rgba(139, 92, 246, 0.25)',
        boxShadow: '4px 0 32px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Circuit texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(167, 139, 250, 0.20) 1px, transparent 1px),
            linear-gradient(rgba(139, 92, 246, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 40px 40px',
        }}
      />

      {/* Top ambient glow */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(167,139,250,0.18), transparent)',
        }}
      />

      {/* Logo */}
      <div className={cn(
        'relative flex items-center gap-3 border-b',
        collapsed ? 'justify-center px-0 py-4' : 'px-4 py-4'
      )}
        style={{ borderColor: 'rgba(139, 92, 246, 0.25)' }}
      >
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #ec4899 100%)',
            boxShadow: '0 0 24px rgba(167,139,250,0.50), 0 2px 8px rgba(0,0,0,0.30)',
          }}
        >
          <Box className="w-4.5 h-4.5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-black tracking-tight leading-none text-white">
              XOB
            </p>
            <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: 'rgba(196,181,253,0.70)' }}>
              Seller Platform
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="relative flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 py-2 rounded-xl transition-all duration-150 relative group',
                collapsed ? 'justify-center px-0' : 'px-3',
              )}
              style={active ? {
                background: 'rgba(236, 72, 153, 0.22)',
                boxShadow: '0 0 16px rgba(236,72,153,0.18), inset 0 1px 0 rgba(255,255,255,0.10)',
              } : {}}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                )}
                style={active ? {
                  background: 'rgba(236,72,153,0.30)',
                  color: '#f9a8d4',
                  boxShadow: '0 0 12px rgba(236,72,153,0.40)',
                } : {
                  color: 'rgba(196, 181, 253, 0.70)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              {!collapsed && (
                <span
                  className="text-[11px] font-bold tracking-widest uppercase"
                  style={active ? { color: '#f9a8d4' } : { color: 'rgba(196, 181, 253, 0.70)' }}
                >
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="relative mx-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.35), transparent)' }} />

      {/* Sign Out */}
      <div className="relative px-2 pb-3 pt-2">
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 py-2 rounded-xl transition-all group',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
          style={{ color: 'rgba(196, 181, 253, 0.55)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(196, 181, 253, 0.55)')}
        >
          <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          {!collapsed && <span className="text-[11px] font-bold tracking-widest uppercase">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10"
        style={{
          background: '#4c1d95',
          border: '1px solid rgba(167,139,250,0.40)',
          color: 'rgba(196,181,253,0.80)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
        }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
