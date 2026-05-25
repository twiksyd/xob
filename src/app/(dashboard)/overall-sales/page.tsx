'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useCallback, useEffect } from 'react'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { format, isToday, isYesterday } from 'date-fns'
import { RefreshCw, AlertOctagon, Eye, EyeOff, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Static pools (buyers / accounts / methods stay fake) ────────────────────

const BUYERS = [
  'Miguel Santos', 'Jasmine Cruz', 'Rhea Dela Cruz', 'Paolo Reyes',
  'Maria Tan', 'Carlo Bautista', 'Ana Garcia', 'Jose Ramos',
  'Sofia Lim', 'Luis Mendoza', 'Kristine Aquino', 'Marco Villanueva',
  'Bianca Torres', 'Jerome Flores', 'Camille Hernandez', 'Ryan De Jesus',
  'Elaine Pascual', 'Vince Ocampo', 'Nina Castillo', 'Andrei Morales',
  'Patricia Salazar', 'Jaime Gutierrez', 'Diane Domingo', 'Roland Perez',
  'Janine Rivera', 'Chad Williams', 'Alex Chen', 'Sam Park',
]

const ACCTS   = ['XobSeller01', 'XobSeller02', 'XobSeller03', 'XobSeller04']
const METHODS = ['GCash', 'GCash', 'GCash', 'GCash', 'Maya', 'Bank'] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type PoolGP = { name: string; game: string; price: number; profit: number }

type FakeSale = {
  id: string; buyer: string; gamepass: string; game: string
  qty: number; account: string; price: number; profit: number
  method: string; status: 'completed' | 'paid' | 'pending' | 'refunded'; at: Date
}

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function mkRng(seed: number) {
  let s = seed | 0
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296 }
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]
}

// ─── Generator — weighted by game, only the 4 priority games ─────────────────

function generateSales(seed: number, pool: PoolGP[]): FakeSale[] {
  if (pool.length === 0) return []
  const r = mkRng(seed)

  // Match helper — case-insensitive substring
  const has = (game: string, ...terms: string[]) =>
    terms.some(t => game.toLowerCase().includes(t.toLowerCase()))

  const buckets = [
    { pool: pool.filter(g => has(g.game, 'drag') || has(g.name, 'drag drive')),              weight: 60 },
    { pool: pool.filter(g => has(g.game, 'wizard', 'alchemy') || has(g.name, 'wizard')),     weight: 20 },
    { pool: pool.filter(g => has(g.game, 'evade') || has(g.name, 'evade')),                  weight: 10 },
    { pool: pool.filter(g => has(g.game, 'anime vanguard') || has(g.name, 'anime vanguard')),weight: 10 },
  ].filter(b => b.pool.length > 0)

  // Fall back to full pool only if none of the 4 games are in inventory
  const active      = buckets.length > 0 ? buckets : [{ pool, weight: 1 }]
  const totalWeight = active.reduce((s, b) => s + b.weight, 0)

  function pickGP(): PoolGP {
    let roll = r() * totalWeight
    for (const b of active) { roll -= b.weight; if (roll <= 0) return pick(b.pool, r) }
    return pick(active[active.length - 1].pool, r)
  }

  const now            = new Date()
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const nowMs          = now.getTime()
  const count          = 18 + Math.floor(r() * 17)   // 18–34 per refresh

  function gamePriority(game: string) {
    const g = game.toLowerCase()
    if (g.includes('drag'))           return 0
    if (g.includes('wizard') || g.includes('alchemy')) return 1
    if (g.includes('evade'))          return 2
    if (g.includes('anime vanguard')) return 3
    return 4
  }

  return Array.from({ length: count }, (_, i) => {
    const gp  = pickGP()
    const qty = r() < 0.78 ? 1 : r() < 0.55 ? 2 : 3
    const roll = r()
    const status: FakeSale['status'] = roll < 0.68 ? 'completed'
      : roll < 0.84 ? 'paid' : roll < 0.94 ? 'pending' : 'refunded'
    const isCurrentDay = r() < 0.55
    const winStart = isCurrentDay ? todayStart : yesterdayStart
    const winEnd   = isCurrentDay ? nowMs      : todayStart - 1
    return {
      id: `${seed}-${i}`,
      buyer:    pick(BUYERS, r),
      gamepass: gp.name,
      game:     gp.game,
      qty,
      account:  pick(ACCTS, r),
      price:    Math.round(gp.price * qty * 100) / 100,
      profit:   Math.round(gp.profit * qty * 100) / 100,
      method:   pick(METHODS, r),
      status,
      at: new Date(winStart + Math.floor(r() * (winEnd - winStart))),
    }
  }).sort((a, b) =>
    gamePriority(a.game) - gamePriority(b.game) || b.at.getTime() - a.at.getTime()
  )
}

function dateLabel(d: Date) {
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM dd')
}

function RevenueValue({ amount, color }: { amount: number; color: string }) {
  const intPart = Math.floor(amount)
  const dec = `.${amount.toFixed(2).split('.')[1]}`
  if (intPart >= 1000) {
    const intStr = intPart.toLocaleString()
    let digits = 0; let splitAt = intStr.length
    for (let i = intStr.length - 1; i >= 0; i--) {
      if (/\d/.test(intStr[i])) { digits++; if (digits === 2) { splitAt = i; break } }
    }
    return (
      <p className="stat-value" style={{ color }}>
        ₱{intStr.slice(0, splitAt)}
        <span style={{ filter: 'blur(5px)', userSelect: 'none', display: 'inline-block' }}>
          {intStr.slice(splitAt)}
        </span>
        {dec}
      </p>
    )
  }
  return <p className="stat-value" style={{ color }}>₱{amount.toFixed(2)}</p>
}

// ─── Component ───────────────────────────────────────────────────────────────

const STATUS_CHIPS = ['all', 'completed', 'paid', 'pending', 'refunded'] as const
const BLUR   = 'blur(7px)'
const BLUR_T = 'filter 0.22s ease'

export default function OverallSalesPage() {
  const [pool,         setPool]         = useState<PoolGP[]>([])
  const [gpLoading,    setGpLoading]    = useState(true)
  const [seed,         setSeed]         = useState(() => Date.now())
  const [refreshing,   setRefreshing]   = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [showAccounts, setShowAccounts] = useState(false)
  const supabase = createClient()

  // Fetch real gamepasses from inventory on mount (all, not just active — this is a simulation)
  useEffect(() => {
    supabase
      .from('gamepasses')
      .select('name, your_price, profit, games(name)')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPool(
            (data as any[]).map(gp => ({
              name:   gp.name,
              game:   (gp.games as any)?.name ?? '',
              price:  gp.your_price,
              profit: gp.profit,
            }))
          )
        }
        setGpLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sales = useMemo(() => generateSales(seed, pool), [seed, pool])

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

  const completed    = sales.filter(s => s.status === 'completed')
  const totalRevenue = completed.reduce((s, o) => s + o.price, 0)
  const totalProfit  = completed.reduce((s, o) => s + o.profit, 0)
  const statusCounts = sales.reduce<Record<string, number>>(
    (m, s) => { m[s.status] = (m[s.status] ?? 0) + 1; return m }, {}
  )

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <TopBar
        title="Overall Sales"
        subtitle="Simulated marketplace activity feed"
        searchPlaceholder="Search buyer, gamepass…"
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">

        {/* ── Sold Out Banner ──────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.13) 0%, rgba(244,63,94,0.07) 100%)',
            border: '1px solid rgba(244,63,94,0.38)',
            boxShadow: '0 0 36px rgba(244,63,94,0.14), 0 4px 20px rgba(244,63,94,0.08), inset 0 1px 0 rgba(244,63,94,0.18)',
          }}
        >
          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0 w-3 h-3">
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(244,63,94,0.55)' }} />
                <span className="relative block w-3 h-3 rounded-full" style={{ background: '#f43f5e', boxShadow: '0 0 10px rgba(244,63,94,0.9), 0 0 24px rgba(244,63,94,0.55)' }} />
              </div>
              <div>
                <p className="text-[13px] font-black uppercase leading-tight" style={{ color: '#f43f5e', letterSpacing: '0.18em' }}>Sold Out</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'oklch(0.50 0.010 265)' }}>
                  Inventory depleted — restock required to resume sales.
                </p>
              </div>
            </div>
            <span
              className="flex-shrink-0 text-[10px] font-black tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(244,63,94,0.16)', border: '1px solid rgba(244,63,94,0.30)', color: '#f43f5e', boxShadow: '0 0 12px rgba(244,63,94,0.12)' }}
            >
              Action Required
            </span>
          </div>
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3.5 flex-shrink-0">
          <div className="summary-card" style={{ background: 'rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, #a78bfa42, rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }}>
            <p className="label-caps mb-1">Completed Revenue</p>
            <RevenueValue amount={totalRevenue} color="oklch(0.10 0.030 272)" />
          </div>
          <div className="summary-card" style={{ background: 'rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, #22d3ee42, rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }}>
            <p className="label-caps mb-1">Total Profit</p>
            <p className="stat-value" style={{ color: '#22d3ee', filter: BLUR, userSelect: 'none' }}>₱{totalProfit.toFixed(2)}</p>
          </div>
          <div className="summary-card" style={{ background: 'rgba(255,255,255,0.90) padding-box, linear-gradient(135deg, #f59e0b42, rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }}>
            <p className="label-caps mb-1">Total Orders</p>
            <p className="stat-value" style={{ color: '#f59e0b' }}>{sales.length}</p>
          </div>
        </div>

        {/* ── Filter row + Refresh ──────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map(s => {
              const count = s === 'all' ? sales.length : (statusCounts[s] ?? 0)
              return (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn('chip capitalize', filterStatus === s ? 'chip-active' : '')}>
                  {s === 'all' ? 'All' : s}
                  <span className="ml-1 opacity-50">({count})</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={refresh}
            disabled={refreshing || gpLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.85) padding-box, linear-gradient(135deg, rgba(34,211,238,0.28), rgba(167,139,250,0.20)) border-box',
              border: '1px solid transparent', color: '#22d3ee', boxShadow: '0 2px 8px rgba(34,211,238,0.08)',
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh Feed
          </button>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden flex flex-col flex-1 min-h-0">

          {/* Loading inventory */}
          {gpLoading ? (
            <div className="flex-1 flex items-center justify-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Loading inventory…</p>
            </div>
          ) : pool.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Package className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No active gamepasses in inventory.</p>
              <p className="text-xs text-muted-foreground">Add gamepasses on the Inventory page to populate the feed.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full data-table" style={{ opacity: refreshing ? 0.35 : 1, transition: 'opacity 0.2s ease' }}>
                <thead
                  className="sticky top-0 z-10"
                  style={{ background: 'rgba(250,248,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 1px 0 rgba(139,92,246,0.08)' }}
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
                          {showAccounts ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
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
                        <div className="text-[11px] font-medium" style={{ color: 'oklch(0.45 0.012 270)' }}>{dateLabel(sale.at)}</div>
                        <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>{format(sale.at, 'HH:mm')}</div>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)', filter: BLUR, transition: BLUR_T, userSelect: 'none' }}>
                          {sale.buyer}
                        </p>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.10 0.030 272)' }}>{sale.gamepass}</p>
                        <p className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{sale.game}</p>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold tabular-nums"
                          style={{ background: sale.qty > 1 ? 'rgba(34,211,238,0.10)' : 'rgba(15,13,42,0.04)', color: sale.qty > 1 ? '#22d3ee' : 'oklch(0.55 0.010 265)' }}
                        >
                          {sale.qty}
                        </span>
                      </td>
                      <td>
                        <span className="text-[12px] font-medium" style={{ color: 'oklch(0.55 0.010 265)', filter: showAccounts ? 'none' : BLUR, transition: BLUR_T, userSelect: showAccounts ? 'auto' : 'none' }}>
                          {sale.account}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>₱{sale.price.toFixed(2)}</span>
                      </td>
                      <td className="text-right">
                        <span
                          className={cn('text-[13px] font-bold', sale.status === 'refunded' ? 'text-red-400' : 'text-emerald-600')}
                          style={{ filter: BLUR, transition: BLUR_T, userSelect: 'none', display: 'inline-block' }}
                        >
                          {sale.status === 'refunded' ? '-' : '+'}₱{sale.profit.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{sale.method}</td>
                      <td className="text-center"><StatusBadge status={sale.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && sales.length > 0 && (
                <div className="p-10 text-center">
                  <p className="text-sm text-muted-foreground">No results match your filter.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
