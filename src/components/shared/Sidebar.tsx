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
  { href: '/',             label: 'Dashboard',    icon: LayoutDashboard, color: 'text-violet-400',  bg: 'bg-violet-500/15'  },
  { href: '/accounts',    label: 'Accounts',     icon: Users,           color: 'text-blue-400',    bg: 'bg-blue-500/15'    },
  { href: '/inventory',   label: 'Inventory',    icon: Package,         color: 'text-amber-400',   bg: 'bg-amber-500/15'   },
  { href: '/orders',      label: 'Orders',       icon: ShoppingCart,    color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  { href: '/transactions',label: 'Transactions', icon: Receipt,         color: 'text-pink-400',    bg: 'bg-pink-500/15'    },
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
        'border-r border-sidebar-border',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{ background: 'oklch(0.045 0.012 258)', boxShadow: '2px 0 24px oklch(0.00 0.000 0 / 0.40)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 border-b border-sidebar-border',
        collapsed ? 'justify-center px-0 py-4' : 'px-4 py-4'
      )}>
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, oklch(0.74 0.22 150), oklch(0.65 0.20 165))',
            boxShadow: '0 2px 12px oklch(0.74 0.22 150 / 0.45)',
          }}
        >
          <Gamepad2 className="w-4.5 h-4.5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-black tracking-tight text-foreground leading-none">XOB</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium tracking-wide uppercase">Seller</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
        {navItems.map(({ href, label, icon: Icon, color, bg }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative',
                collapsed ? 'justify-center px-0' : 'px-3',
                active ? 'nav-active' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <span className={cn(
                'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                active ? cn(bg, color) : 'text-sidebar-foreground'
              )}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              {!collapsed && (
                <span className={cn('text-[13px]', active && 'font-semibold')}>{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 border-t border-sidebar-border pt-2 space-y-0.5">
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400',
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
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-all z-10"
        style={{
          background: 'oklch(0.14 0.020 262)',
          border: '1px solid oklch(0.22 0.024 262)',
          boxShadow: '0 2px 8px oklch(0.00 0.000 0 / 0.4)',
        }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
