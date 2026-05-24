'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt,
  LogOut, Gamepad2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard, activeColor: '#00d4ff', activeBg: 'rgba(0, 212, 255, 0.10)'  },
  { href: '/accounts',     label: 'Accounts',     icon: Users,           activeColor: '#3b82f6', activeBg: 'rgba(59, 130, 246, 0.10)'  },
  { href: '/inventory',    label: 'Inventory',    icon: Package,         activeColor: '#f59e0b', activeBg: 'rgba(245, 158, 11, 0.10)'  },
  { href: '/orders',       label: 'Orders',       icon: ShoppingCart,    activeColor: '#10b981', activeBg: 'rgba(16, 185, 129, 0.10)'  },
  { href: '/transactions', label: 'Transactions', icon: Receipt,         activeColor: '#ec4899', activeBg: 'rgba(236, 72, 153, 0.10)'  },
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
        'relative flex flex-col h-screen transition-all duration-300',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{
        background: 'oklch(0.974 0.010 258)',
        borderRight: '1px solid oklch(0.878 0.022 255)',
        boxShadow: '4px 0 32px rgba(0, 0, 0, 0.06), 2px 0 0 rgba(0, 212, 255, 0.06)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 border-b',
        collapsed ? 'justify-center px-0 py-4' : 'px-4 py-4'
      )}
        style={{ borderColor: 'oklch(0.878 0.022 255)' }}
      >
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 60%, #ff0066 100%)',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.50), 0 2px 8px rgba(139, 92, 246, 0.30)',
          }}
        >
          <Gamepad2 className="w-4.5 h-4.5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p
              className="text-sm font-black tracking-tight leading-none"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              XOB
            </p>
            <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: 'oklch(0.55 0.018 265)' }}>
              Seller Platform
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
        {navItems.map(({ href, label, icon: Icon, activeColor, activeBg }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group',
                collapsed ? 'justify-center px-0' : 'px-3',
              )}
              style={active ? {
                background: `linear-gradient(90deg, ${activeBg} 0%, ${activeBg.replace('0.10', '0.03')} 70%, transparent 100%)`,
                borderLeft: `2px solid ${activeColor}`,
                color: activeColor,
                filter: `drop-shadow(0 0 6px ${activeColor}60)`,
              } : {}}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  !active && 'text-sidebar-foreground group-hover:text-foreground'
                )}
                style={active ? {
                  background: activeBg,
                  color: activeColor,
                  boxShadow: `0 0 12px ${activeColor}40`,
                } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              {!collapsed && (
                <span className={cn('text-[13px]', active ? 'font-semibold' : 'text-sidebar-foreground group-hover:text-foreground')}>
                  {label}
                </span>
              )}
              {active && !collapsed && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: activeColor, boxShadow: `0 0 8px ${activeColor}` }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.20), transparent)' }} />

      {/* Bottom */}
      <div className="px-2 pb-3 pt-2">
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-sidebar-foreground hover:text-rose-500 hover:bg-rose-50',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          {!collapsed && <span className="text-[13px]">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10 text-slate-500 hover:text-slate-800"
        style={{
          background: 'white',
          border: '1px solid oklch(0.875 0.022 255)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10), 0 0 8px rgba(0,212,255,0.10)',
        }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
