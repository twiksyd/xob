'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import StatusBadge from '@/components/shared/StatusBadge'
import CountUp from '@/components/shared/CountUp'
import { createClient } from '@/lib/supabase/client'
import { format, isToday, isYesterday } from 'date-fns'
import { RefreshCw, Eye, EyeOff, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { useUrlState } from '@/hooks/useUrlState'
import { formatPHP } from '@/lib/utils/pricing'
import { getGameNameStyle } from '@/lib/utils/games'

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 flex-shrink-0"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

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

type PoolGP = { name: string; game: string; price: number; profit: number; isDiscounted: boolean }

type FakeSale = {
  id: string; buyer: string; gamepass: string; game: string; isDiscounted: boolean
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
      isDiscounted: gp.isDiscounted,
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
  return <p className="stat-value" style={{ color }}>{formatPHP(amount)}</p>
}

// ─── Component ───────────────────────────────────────────────────────────────

const STATUS_CHIPS = ['all', 'completed', 'paid', 'pending', 'refunded'] as const
const BLUR   = 'blur(7px)'
const BLUR_T = 'filter 0.22s ease'

function OverallSalesPageContent() {
  const [pool,         setPool]         = useState<PoolGP[]>([])
  const [gpLoading,    setGpLoading]    = useState(true)
  const [seed,         setSeed]         = useState(() => Date.now())
  const [refreshing,   setRefreshing]   = useState(false)
  const [filterStatus, setFilterStatus] = useUrlState<typeof STATUS_CHIPS[number]>('status', 'all', STATUS_CHIPS)
  const [search,       setSearch]       = useState('')
  const [showAccounts, setShowAccounts] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  // Fetch real gamepasses from inventory on mount (all, not just active — this is a simulation)
  useEffect(() => {
    supabase
      .from('gamepasses')
      .select('name, your_price, profit, games(name, is_discounted)')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPool(
            (data as any[]).map(gp => ({
              name:   gp.name,
              game:   (gp.games as any)?.name ?? '',
              price:  gp.your_price,
              profit: gp.profit,
              isDiscounted: (gp.games as any)?.is_discounted ?? false,
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
    setTimeout(() => {
      setSeed(Date.now())
      setRefreshing(false)
      toast.success('Sales feed refreshed.')
    }, 420)
  }, [toast])

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
        searchPlaceholder="Search buyer, gamepass…"
        searchValue={search}
        onSearchChange={setSearch}
      />
      <PageHero
        badge="Analytics"
        title="Sales Analytics"
        subtitle="Aggregated performance across all games, gamepasses, and time windows."
        gradient="linear-gradient(135deg, #e879f9 0%, #a78bfa 50%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">

        {/* ── 01 · Performance Overview ── */}
        <SectionLabel index="01" label="Performance Overview" />

        {/* ── Sold Out Banner ──────────────────────────────────────────── */}
        <motion.div
          className="rounded-xl overflow-hidden flex-shrink-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,94,0.13) 0%, rgba(244,63,94,0.07) 100%)',
            border: '1px solid rgba(244,63,94,0.38)',
            boxShadow: '0 0 36px rgba(244,63,94,0.14), 0 4px 20px rgba(244,63,94,0.08), inset 0 1px 0 rgba(244,63,94,0.18)',
          }}
        >
          <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0 w-3 h-3">
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(244,63,94,0.20)' }} />
                <span className="relative block w-3 h-3 rounded-full" style={{ background: '#f43f5e', boxShadow: '0 0 8px rgba(244,63,94,0.20)' }} />
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
        </motion.div>

        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 flex-shrink-0"
          variants={cardStagger}
          initial="initial"
          animate="animate"
        >
          <motion.div
            variants={cardStaggerItem}
            className="summary-card"
            style={{
              background: 'rgba(255,255,255,0.052) padding-box, linear-gradient(135deg, #a78bfa66, rgba(34,211,238,0.26) 50%, rgba(232,121,249,0.18)) border-box',
              border: '1px solid transparent',
              boxShadow: '0 0 28px rgba(167,139,250,0.18)',
            }}
          >
            <p className="label-caps mb-1">Completed Revenue</p>
            <RevenueValue amount={totalRevenue} color="rgba(255,255,255,0.92)" />
          </motion.div>
          <motion.div variants={cardStaggerItem} className="summary-card" style={{ background: 'rgba(255,255,255,0.038) padding-box, linear-gradient(135deg, #22d3ee42, rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }}>
            <p className="label-caps mb-1">Total Profit</p>
            <p className="stat-value" style={{ color: '#22d3ee', filter: BLUR, userSelect: 'none' }}>{formatPHP(totalProfit)}</p>
          </motion.div>
          <motion.div variants={cardStaggerItem} className="summary-card" style={{ background: 'rgba(255,255,255,0.038) padding-box, linear-gradient(135deg, #f59e0b42, rgba(34,211,238,0.18)) border-box', border: '1px solid transparent' }}>
            <p className="label-caps mb-1">Total Orders</p>
            <CountUp value={sales.length} format={(v) => `${Math.round(v)}`} duration={1.0} className="stat-value block" style={{ color: '#f59e0b' }} />
          </motion.div>
        </motion.div>

        {/* ── 02 · Sales Feed ── */}
        <SectionLabel index="02" label="Sales Feed" />

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
              background: 'rgba(255,255,255,0.050) padding-box, linear-gradient(135deg, rgba(34,211,238,0.28), rgba(167,139,250,0.20)) border-box',
              border: '1px solid transparent', color: '#22d3ee', boxShadow: '0 2px 8px rgba(34,211,238,0.08)',
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh Feed
          </button>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <motion.div
          className="glass-card overflow-hidden flex flex-col flex-1 min-h-0"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >

          {/* Loading inventory */}
          {gpLoading ? (
            <div className="flex-1 flex items-center justify-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>Loading inventory…</p>
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
                          style={{ color: showAccounts ? '#22d3ee' : 'rgba(255,255,255,0.50)' }}
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
                        <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{dateLabel(sale.at)}</div>
                        <div className="text-[10px]" style={{ color: 'oklch(0.65 0.010 265)' }}>{format(sale.at, 'HH:mm')}</div>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)', filter: BLUR, transition: BLUR_T, userSelect: 'none' }}>
                          {sale.buyer}
                        </p>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{sale.gamepass}</p>
                        <p className="text-[11px]" style={getGameNameStyle(sale.isDiscounted)}>{sale.game}</p>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold tabular-nums"
                          style={{ background: sale.qty > 1 ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.065)', color: sale.qty > 1 ? '#22d3ee' : 'rgba(255,255,255,0.44)' }}
                        >
                          {sale.qty}
                        </span>
                      </td>
                      <td>
                        <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.44)', filter: showAccounts ? 'none' : BLUR, transition: BLUR_T, userSelect: showAccounts ? 'auto' : 'none' }}>
                          {sale.account}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>{formatPHP(sale.price)}</span>
                      </td>
                      <td className="text-right">
                        <span
                          className={cn('text-[13px] font-bold', sale.status === 'refunded' ? 'text-red-400' : 'text-emerald-600')}
                          style={{ filter: BLUR, transition: BLUR_T, userSelect: 'none', display: 'inline-block' }}
                        >
                          {sale.status === 'refunded' ? '-' : '+'}{formatPHP(sale.profit)}
                        </span>
                      </td>
                      <td className="text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>{sale.method}</td>
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
        </motion.div>

      </div>
    </div>
  )
}

// useUrlState() calls useSearchParams() internally — requires a Suspense
// boundary or the build's prerender pass fails even on a force-dynamic page.
export default function OverallSalesPage() {
  return (
    <Suspense fallback={null}>
      <OverallSalesPageContent />
    </Suspense>
  )
}
