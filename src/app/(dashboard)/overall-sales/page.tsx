'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useCallback } from 'react'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { format, isToday, isYesterday } from 'date-fns'
import { RefreshCw, AlertOctagon, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Fake data pools ─────────────────────────────────────────────────────────

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
  { name: '2x Speed',        game: 'Blade Ball',         price: 149, cost: 118 },
  { name: 'VIP Pass',        game: 'Blox Fruits',        price: 299, cost: 192 },
  { name: 'Auto Farm',       game: 'Anime Defenders',    price: 399, cost: 288 },
  { name: 'Infinite Jump',   game: 'Pet Simulator X',    price: 199, cost: 144 },
  { name: 'Lucky Boost',     game: 'Toilet Tower Def.',  price: 99,  cost: 72  },
  { name: 'Double Drop',     game: 'Anime Defenders',    price: 249, cost: 180 },
  { name: 'Premium Club',    game: 'Blade Ball',         price: 349, cost: 240 },
  { name: 'Speed Boost',     game: 'Pet Simulator X',    price: 149, cost: 108 },
  { name: 'Pro Bundle',      game: 'Blox Fruits',        price: 499, cost: 360 },
  { name: 'Night Pass',      game: 'Toilet Tower Def.',  price: 179, cost: 129 },
  { name: 'Ranking Skip',    game: 'Blade Ball',         price: 219, cost: 158 },
  { name: 'XP Multiplier',   game: 'Anime Defenders',    price: 329, cost: 237 },
]

const ACCTS   = ['XobSeller01', 'XobSeller02', 'XobSeller03', 'XobSeller04']
const METHODS = ['GCash', 'GCash', 'GCash', 'GCash', 'Maya', 'Bank'] as const

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

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const nowMs = now.getTime()

  return Array.from({ length: 26 }, (_, i) => {
    const gp    = pick(GP_POOL, r)
    const qty   = r() < 0.78 ? 1 : r() < 0.55 ? 2 : 3
    const roll  = r()
    const status: FakeSale['status'] = roll < 0.68
      ? 'completed' : roll < 0.84 ? 'paid' : roll < 0.94 ? 'pending' : 'refunded'

    // 55% today, 45% yesterday; random realistic time within that window
    const isCurrentDay = r() < 0.55
    const winStart = isCurrentDay ? todayStart : yesterdayStart
    const winEnd   = isCurrentDay ? nowMs      : todayStart - 1
    const at = new Date(winStart + Math.floor(r() * (winEnd - winStart)))

    return {
      id: `${seed}-${i}`,
      buyer:    pick(BUYERS, r),
      gamepass: gp.name,
      game:     gp.game,
      qty,
      account:  pick(ACCTS, r),
      price:    gp.price * qty,
      profit:   Math.round((gp.price - gp.cost) * qty * 100) / 100,
      method:   pick(METHODS, r),
      status,
      at,
    }
  }).sort((a, b) => b.at.getTime() - a.at.getTime())
}

function dateLabel(d: Date) {
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM dd')
}

// ─── Component ───────────────────────────────────────────────────────────────

const STATUS_CHIPS = ['all', 'completed', 'paid', 'pending', 'refunded'] as const

export default function OverallSalesPage() {
  const [seed,         setSeed]         = useState(() => Date.now())
  const [refreshing,   setRefreshing]   = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [showStats,    setShowStats]    = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)

  const sales = useMemo(() => generateSales(seed), [seed])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => { setSeed(Date.now()); setRefreshing(false) }, 420)
  }, [])

  const filtered = useMemo(() => sales.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q || s.buyer.toLowerCase().includes(q)
      || s.gamepass.toLowerCase().includes(q) || s.game.toLowerCase().includes(q)
    return matchStatus && matchSearch
  }), [sales, filterStatus, search])

  const completed     = sales.filter(s => s.status === 'completed')
  const totalRevenue  = completed.reduce((s, o) => s + o.price, 0)
  const totalProfit   = completed.reduce((s, o) => s + o.profit, 0)
  const statusCounts  = sales.reduce<Record<string, number>>((m, s) => {
    m[s.status] = (m[s.status] ?? 0) + 1; return m
  }, {})

  const blurVal = 'blur(7px)'
  const blurTransition = 'filter 0.22s ease'

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

        {/* ── Sold Out Banner ───────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.13) 0%, rgba(244,63,94,0.07) 100%)',
            border: '1px solid rgba(244,63,94,0.38)',
            boxShadow: '0 0 36px rgba(244,63,94,0.14), 0 4px 20px rgba(244,63,94,0.08), inset 0 1px 0 rgba(244,63,94,0.18)',
          }}
        >
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Pulsing dot */}
              <div className="relative flex-shrink-0 w-3 h-3">
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: 'rgba(244,63,94,0.55)' }}
                />
                <span
                  className="relative block w-3 h-3 rounded-full"
                  style={{ background: '#f43f5e', boxShadow: '0 0 10px rgba(244,63,94,0.9), 0 0 24px rgba(244,63,94,0.55)' }}
                />
              </div>

              <div>
                <p
                  className="text-[13px] font-black tracking-[0.20em] uppercase leading-tight"
                  style={{ color: '#f43f5e', letterSpacing: '0.18em' }}
                >
                  Sold Out
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'oklch(0.50 0.010 265)' }}>
                  Inventory depleted — restock required to resume sales.
                </p>
              </div>
            </div>

            <span
              className="flex-shrink-0 text-[10px] font-black tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-lg"
              style={{
                background: 'rgba(244,63,94,0.16)',
                border: '1px solid rgba(244,63,94,0.30)',
                color: '#f43f5e',
                boxShadow: '0 0 12px rgba(244,63,94,0.12)',
              }}
            >
              Action Required
            </span>
          </div>
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div>
          {/* Eye toggle row */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowStats(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={{ color: 'oklch(0.55 0.010 265)', background: 'rgba(139,92,246,0.06)' }}
            >
              {showStats
                ? <EyeOff className="w-3 h-3" />
                : <Eye className="w-3 h-3" />}
              {showStats ? 'Hide stats' : 'Show stats'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            {[
              {
                label: 'Completed Revenue',
                value: `₱${totalRevenue.toFixed(2)}`,
                color: 'oklch(0.10 0.030 272)',
                accent: '#a78bfa',
              },
              {
                label: 'Total Profit',
                value: `₱${totalProfit.toFixed(2)}`,
                color: '#22d3ee',
                accent: '#22d3ee',
              },
              {
                label: 'Total Orders',
                value: String(sales.length),
                color: '#f59e0b',
                accent: '#f59e0b',
              },
            ].map(({ label, value, color, accent }) => (
              <div
                key={label}
                className="summary-card"
                style={{
                  background: `rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, ${accent}42, rgba(34,211,238,0.18)) border-box`,
                  border: '1px solid transparent',
                }}
              >
                <p className="label-caps mb-1">{label}</p>
                <p
                  className="stat-value"
                  style={{
                    color,
                    filter: showStats ? 'none' : blurVal,
                    transition: blurTransition,
                    userSelect: showStats ? 'auto' : 'none',
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter row + Refresh ───────────────────────────────────────── */}
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

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: '62vh' }}>
            <table
              className="w-full data-table"
              style={{ opacity: refreshing ? 0.35 : 1, transition: 'opacity 0.2s ease' }}
            >
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
                  <th className="text-left">
                    <div className="flex items-center gap-1.5">
                      Account
                      <button
                        onClick={() => setShowAccounts(v => !v)}
                        className="rounded p-0.5 transition-colors"
                        style={{ color: showAccounts ? '#22d3ee' : 'oklch(0.60 0.010 265)' }}
                        title={showAccounts ? 'Hide accounts' : 'Reveal accounts'}
                      >
                        {showAccounts
                          ? <EyeOff className="w-3 h-3" />
                          : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </th>
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
                      <div className="text-[11px] font-medium" style={{ color: 'oklch(0.45 0.012 270)' }}>
                        {dateLabel(sale.at)}
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
                    <td>
                      <span
                        className="text-[12px] font-medium"
                        style={{
                          color: 'oklch(0.55 0.010 265)',
                          filter: showAccounts ? 'none' : blurVal,
                          transition: blurTransition,
                          userSelect: showAccounts ? 'auto' : 'none',
                        }}
                      >
                        {sale.account}
                      </span>
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
