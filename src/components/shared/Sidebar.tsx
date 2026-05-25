'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt, LogOut, Box,
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
      className="relative flex flex-col h-screen w-[220px] flex-shrink-0 z-10"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(15,13,42,0.06)',
        boxShadow: '2px 0 20px rgba(15,13,42,0.04)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-[22px] border-b border-border/40">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, #e879f9 100%)',
            boxShadow: '0 0 16px rgba(34,211,238,0.30)',
          }}
        >
          <Box className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[13px] font-black tracking-tight" style={{ color: 'oklch(0.10 0.030 272)' }}>
            XOB
          </p>
          <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'oklch(0.50 0.014 265)' }}>
            Seller
          </p>
        </div>
      </div>

      {/* Label */}
      <p className="px-5 pt-5 pb-2 label-caps">Navigation</p>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150',
                active ? 'nav-active' : 'hover:bg-black/[0.028] text-muted-foreground hover:text-foreground'
              )}
              style={active ? { color: 'oklch(0.38 0.18 200)' } : {}}
            >
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={active ? { color: 'oklch(0.58 0.18 200)' } : {}}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-5 h-px bg-border/50 my-2" />

      {/* Sign Out */}
      <div className="px-3 pb-5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-50/60 transition-all duration-150"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
