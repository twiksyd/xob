'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Receipt, LogOut, Box, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/accounts',     label: 'Accounts',     icon: Users           },
  { href: '/inventory',    label: 'Inventory',    icon: Package         },
  { href: '/orders',       label: 'Orders',       icon: ShoppingCart    },
  { href: '/transactions', label: 'Transactions', icon: Receipt         },
  { href: '/wallet',       label: 'Wallet',       icon: Wallet          },
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
        background: 'linear-gradient(180deg, rgba(10,7,32,0.95) 0%, rgba(16,10,48,0.93) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight: '1px solid rgba(139,92,246,0.20)',
        boxShadow: '4px 0 40px rgba(8,6,28,0.25), inset -1px 0 0 rgba(139,92,246,0.08)',
      }}
    >
      {/* Subtle top ambient glow inside sidebar */}
      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.18), transparent)' }}
      />

      {/* Logo */}
      <div
        className="relative flex items-center gap-3 px-5 py-[22px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, #e879f9 100%)',
            boxShadow: '0 0 20px rgba(34,211,238,0.45), 0 0 40px rgba(167,139,250,0.20)',
          }}
        >
          <Box className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <p className="text-[14px] font-black tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            XOB
          </p>
          <p className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Seller
          </p>
        </div>
      </div>

      {/* Nav section label */}
      <p
        className="relative px-5 pt-5 pb-2"
        style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.20)' }}
      >
        Navigation
      </p>

      {/* Nav items */}
      <nav className="relative flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-150',
                active
                  ? 'nav-active-dark text-white/95'
                  : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'
              )}
            >
              <Icon
                className="w-[14px] h-[14px] flex-shrink-0 transition-colors"
                style={active ? { color: '#22d3ee', filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.7))' } : {}}
              />
              {label}
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-150 text-white/28 hover:text-red-400/80 hover:bg-red-500/[0.06]"
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
