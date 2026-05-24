'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt,
  LogOut, Box, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/accounts',     label: 'Accounts',     icon: Users           },
  { href: '/inventory',    label: 'Inventory',    icon: Package         },
  { href: '/orders',       label: 'Orders',       icon: ShoppingCart    },
  { href: '/transactions', label: 'Transactions', icon: Receipt         },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="relative flex flex-col h-screen w-[200px] flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, #fafbff 0%, #f5f3ff 100%)',
        borderRight: '1px solid rgba(139, 92, 246, 0.12)',
        boxShadow: '4px 0 24px rgba(139, 92, 246, 0.06)',
      }}
    >
      {/* Subtle circuit texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Logo */}
      <div
        className="relative flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: 'rgba(139, 92, 246, 0.10)' }}
      >
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #ff0066 100%)',
            boxShadow: '0 0 20px rgba(139,92,246,0.40)',
          }}
        >
          <Box className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black tracking-tight leading-none" style={{ color: '#1e1b4b' }}>
            XOB
          </p>
          <p className="text-[10px] font-bold tracking-widest uppercase mt-0.5" style={{ color: 'rgba(99,65,169,0.60)' }}>
            Seller
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 py-4 space-y-0.5 overflow-y-auto px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group',
              )}
              style={active ? {
                background: 'linear-gradient(90deg, rgba(236,72,153,0.12), rgba(167,139,250,0.08))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.80)',
              } : {}}
            >
              <span
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={active ? {
                  background: 'rgba(236,72,153,0.12)',
                  color: '#be185d',
                } : {
                  color: '#9ca3af',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span
                className="text-[11px] font-bold tracking-widest uppercase flex-1"
                style={active ? { color: '#be185d' } : { color: '#6b7280' }}
              >
                {label}
              </span>
              {active && (
                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#be185d' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="relative mx-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.20), transparent)' }} />

      {/* Sign Out */}
      <div className="relative px-3 pb-4 pt-2">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
          style={{ color: '#9ca3af' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
            <LogOut className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-bold tracking-widest uppercase">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
