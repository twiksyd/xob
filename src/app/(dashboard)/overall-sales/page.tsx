'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useCallback } from 'react'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { format } from 'date-fns'
import { RefreshCw, AlertOctagon, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Fake data pool ──────────────────────────────────────────────────────────

const BUYERS = [
  'Miguel Santos', 'Jasmine Cruz', 'Rhea Dela Cruz', 'Paolo Reyes',
  'Maria Tan', 'Carlo Bautista', 'Ana Garcia', 'Jose Ramos',
  'Sofia Lim', 'Luis Mendoza', 'Kristine Aquino', 'Marco Villanueva',
  'Bianca Torres', 'Jerome Flores', 'Camille Hernandez', 'Ryan De Jesus',
  'Elaine Pascual', 'Vince Ocampo', 'Nina Castillo', 'Andrei Morales',
  'Patricia Salazar', 'Jaime Gutierrez', 'Diane Domingo', 'Roland Perez',
  'Janine Rivera', 'Chad Williams', 'Alex Chen', 'Sam Park',
]

const GP_POOL = [
  { name: '2x Speed',        game: 'Blade Ball',         price: 149, cost: 118, robux: 400  },
  { name: 'VIP Pass',        game: 'Blox Fruits',        price: 299, cost: 192, robux: 800  },
  { name: 'Auto Farm',       game: 'Anime Defenders',    price: 399, cost: 288, robux: 1200 },
  { name: 'Infinite Jump',   game: 'Pet Simulator X',    price: 199, cost: 144, robux: 600  },
  { name: 'Lucky Boost',     game: 'Toilet Tower Def.',  price: 99,  cost: 72,  robux: 300  },
  { name: 'Double Drop',     game: 'Anime Defenders',    price: 249, cost: 180, robux: 750  },
  { name: 'Premium Club',    game: 'Blade Ball',         price: 349, cost: 240, robux: 1000 },
  { name: 'Speed Boost',     game: 'Pet Simulator X',    price: 149, cost: 108, robux: 450  },
  { name: 'Pro Bundle',      game: 'Blox Fruits',        price: 499, cost: 360, robux: 1500 },
  { name: 'Night Pass',      game: 'Toilet Tower Def.',  price: 179, cost: 129, robux: 538  },
  { name: 'Ranking Skip',    game: 'Blade Ball',         price: 219, cost: 158, robux: 657  },
  { name: 'XP Multiplier',   game: 'Anime Defenders',    price: 329, cost: 237, robux: 987  },
]

const ACCTS  = ['XobSeller01', 'XobSeller02', 'XobSeller03', 'XobSeller04']
const METHODS = ['GCash', 'GCash', 'GCash', 'Maya', 'Bank', 'Cash'] as const

type FakeSale = {
  id: string
  buyer: string
  gamepass: string
  game: string
  qty: number
  account: string
  price: number
  profit: number
  method: string
  status: 'completed' | 'paid' | 'pending' | 'refunded'
  at: Date
}

// Linear congruential PRNG — fast & seedable
function mkRng(seed: number) {
  let s = seed | 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0
    return (s >>> 0) / 4294967296
  }
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]
}

function generateSales(seed: number): FakeSale[] {
  const r = mkRng(seed)
  const now = Date.now()
  return Array.from({ length: 26 }, (_, i) => {
    const gp  = pick(GP_POOL, r)
    const qty = r() < 0.78 ? 1 : r() < 0.55 ? 2 : 3
    const roll = r()
    const status: FakeSale['status'] = roll < 0.68
      ? 'completed' : roll < 0.84 ? 'paid' : roll < 0.94 ? 'pending' : 'refunded'
    const msAgo = Math.floor(r() * 30 * 86400000) + Math.floor(r() * 3600000)
    return {
      id: `${seed}-${i}`,
      buyer: pick(BUYERS, r),
      gamepass: gp.name,
      game: gp.game,
      qty,
      account: pick(ACCTS, r),
      price: gp.price * qty,
      profit: Math.round((gp.price - gp.cost) * qty * 100) / 100,
      method: pick(METHODS, r),
      status,
      at: new Date(now - msAgo),
    }
  }).sort((a, b) => b.at.getTime() - a.at.getTime())
}

// ─── Component ───────────────────────────────────────────────────────────────

const STATUS_CHIPS = ['all', 'completed', 'paid', 'pending', 'refunded'] as const

export default function OverallSalesPage() {
  const [seed, setSeed] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const sales = useMemo(() => generateSales(seed), [seed])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => { setSeed(Date.now()); setRefreshing(false) }, 420)
  }, [])

  const filtered = useMemo(() => sales.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q || s.buyer.toLowerCase().includes(q) || s.gamepass.toLowerCase().includes(q) || s.game.toLowerCase().includes(q)
    return matchStatus && matchSearch
  }), [sales, filterStatus, search])

  const completed = sales.filter(s => s.status === 'completed')
  const totalRevenue = completed.reduce((s, o) => s + o.price, 0)
  const totalProfit  = completed.reduce((s, o) => s + o.profit, 0)
  const statusCounts = sales.reduce<Record<string, number>>((m, s) => {
    m[s.status] = (m[s.status] ?? 0) + 1; return m
  }, {})

  return (
    <div>
      <TopBar
        title="Overall Sales"
        subtitle="Simulated marketplace activity feed"
        searchPlaceholder="Search buyer, gamepass…"
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="p-5 space-y-4">
        {/* Sold Out Banner */}
        <div
          className="rounded-xl px-5 py-3.5 flex items-center justify-between"
          style={{
            background: 'rgba(244,63,94,0.04)',
            border: '1px solid rgba(244,63,94,0.18)',
            boxShadow: '0 0 24px rgba(244,63,94,0.05), inset 0 1px 0 rgba(244,63,94,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-4 h-4 flex-shrink-0" style={{ color: '#f43f5e' }} />
            <div className="flex items-center gap-2.5">
              <span
                className="text-[11px] font-black tracking-[0.18em] uppercase"
                style={{ color: '#f43f5e' }}
              >
                Sold Out
              </span>
              <span className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                — Current inventory is depleted. Restock required to resume sales.
              </span>
            </div>
          </div>
          <span
            className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(244,63,94,0.10)', color: '#f43f5e' }}
          >
            Action Required
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            {
              label: 'Completed Revenue',
              value: `₱${totalRevenue.toFixed(2)}`,
              color: 'oklch(0.10 0.030 272)',
              accent: '#a78bfa',
              icon: DollarSign,
            },
            {
              label: 'Total Profit',
              value: `₱${totalProfit.toFixed(2)}`,
              color: '#22d3ee',
              accent: '#22d3ee',
              icon: TrendingUp,
            },
            {
              label: 'Total Orders',
              value: String(sales.length),
              color: '#f59e0b',
              accent: '#f59e0b',
              icon: ShoppingBag,
            },
          ].map(({ label, value, color, accent, icon: Icon }) => (
            <div
              key={label}
              className="summary-card"
              style={{
                background: `rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, ${accent}42, rgba(34,211,238,0.18)) border-box`,
                border: '1px solid transparent',
              }}
            >
              <p className="label-caps mb-1">{label}</p>
              <p className="stat-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter row + refresh */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map(s => {
              const count = s === 'all' ? sales.length : (statusCounts[s] ?? 0)
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn('chip capitalize', filterStatus === s ? 'chip-active' : '')}
                >
                  {s === 'all' ? 'All' : s}
                  <span className="ml-1 opacity-50">({count})</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.85) padding-box, linear-gradient(135deg, rgba(34,211,238,0.28), rgba(167,139,250,0.20)) border-box',
              border: '1px solid transparent',
              color: '#22d3ee',
              boxShadow: '0 2px 8px rgba(34,211,238,0.08)',
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh Feed
          </button>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div
            className="overflow-auto"
            style={{ maxHeight: '560px' }}
          >
            <table className="w-full data-table" style={{ opacity: refreshing ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>
              <thead
                className="sticky top-0 z-10"
                style={{
                  background: 'rgba(250,248,255,0.97)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 1px 0 rgba(139,92,246,0.08)',
                }}
              >
                <tr>
                  <th className="text-left">Date / Time</th>
                  <th className="text-left">Buyer</th>
                  <th className="text-left">Gamepass</th>
                  <th className="text-center">Qty</th>
                  <th className="text-left">Account</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Profit</th>
                  <th className="text-left">Method</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sale => (
                  <tr key={sale.id}>
                    <td className="whitespace-nowrap">
                      <div className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                        {format(sale.at, 'MMM dd, yyyy')}
                      </div>
                      <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>
                        {format(sale.at, 'HH:mm')}
                      </div>
                    </td>
                    <td>
                      <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                        {sale.buyer}
                      </p>
                    </td>
                    <td>
                      <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                        {sale.gamepass}
                      </p>
                      <p className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                        {sale.game}
                      </p>
                    </td>
                    <td className="text-center">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold tabular-nums"
                        style={{
                          background: sale.qty > 1 ? 'rgba(34,211,238,0.10)' : 'rgba(15,13,42,0.04)',
                          color: sale.qty > 1 ? '#22d3ee' : 'oklch(0.55 0.010 265)',
                        }}
                      >
                        {sale.qty}
                      </span>
                    </td>
                    <td className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                      {sale.account}
                    </td>
                    <td className="text-right">
                      <span className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>
                        ₱{sale.price}
                      </span>
                    </td>
                    <td className={cn(
                      'text-right text-[13px] font-bold',
                      sale.status === 'refunded' ? 'text-red-400' : 'text-emerald-600'
                    )}>
                      {sale.status === 'refunded' ? '-' : '+'}₱{sale.profit.toFixed(2)}
                    </td>
                    <td className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                      {sale.method}
                    </td>
                    <td className="text-center">
                      <StatusBadge status={sale.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">No results match your filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
