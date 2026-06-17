'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, formatDistanceToNow, addDays } from 'date-fns'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import NextBestAction from '@/components/dashboard/NextBestAction'
import FulfillmentReadiness from '@/components/dashboard/FulfillmentReadiness'
import MoneyFlowSummary from '@/components/dashboard/MoneyFlowSummary'
import CapitalPosition from '@/components/dashboard/CapitalPosition'
import CapitalSafety from '@/components/dashboard/CapitalSafety'
import CapitalEventsLedger from '@/components/dashboard/CapitalEventsLedger'
import { buildRecommendations } from '@/lib/recommendations'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  Package, ShoppingCart, Users, BarChart2, ArrowUpRight,
  CheckCircle2, Loader2, Trophy, Coins, ChevronDown, TrendingUp, Wallet,
} from 'lucide-react'
import SavingsWidget from '@/components/shared/SavingsWidget'
import CountUp from '@/components/shared/CountUp'
import { formatRobux, formatPHP } from '@/lib/utils/pricing'
import { getAvailableRobux, isDepleted } from '@/lib/utils/accounts'
import type { CSSProperties } from 'react'
import {
  OrderWithDetails, RobloxAccount, ReservationWithDetails, SavingsGoal,
} from '@/lib/types/database'

// ── Floating chip — positioned around hero headline ───────────────────────────

interface ChipProps {
  label: string
  value: string
  color: string
  icon: React.ElementType
  delay?: number
  style?: CSSProperties
}

function FloatingChip({ label, value, color, icon: Icon, delay = 0, style }: ChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        zIndex: 20,
        minWidth: 130,
        padding: '10px 14px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.038)',
        border: '1px solid rgba(255,255,255,0.082)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.055), 0 0 0 1px ${color}14`,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          style={{
            width: 20, height: 20, borderRadius: 6,
            background: `${color}1c`, border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Icon style={{ width: 10, height: 10, color }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)' }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1, tabularNums: true } as CSSProperties}>
        {value}
      </p>
    </motion.div>
  )
}

// ── Blurred section glow blob ─────────────────────────────────────────────────

function Blob({ color, width, height, style }: { color: string; width: number; height: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        width, height,
        background: color,
        borderRadius: '50%',
        filter: `blur(${Math.round(Math.max(width, height) * 0.18)}px)`,
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}

// ── Section scaffolding ───────────────────────────────────────────────────────

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 mb-6"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.18)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

function SectionDivider() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
      <div className="h-px" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%, transparent 100%)',
      }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [gamepassCount, setGamepassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, accountsRes, gpRes, resRes, goalsRes, walletRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, selling_price, cost, profit, robux_amount, created_at, completed_at, buyer_name, roblox_account_id, gamepasses(name, games(name)), roblox_accounts(username)')
        .order('created_at', { ascending: false }),
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('gamepasses').select('id'),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active'),
      supabase.from('savings_goals').select('*').order('priority'),
      supabase.rpc('get_wallet_balance'),
    ])
    if (ordersRes.data) setOrders(ordersRes.data as unknown as OrderWithDetails[])
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (gpRes.data) setGamepassCount(gpRes.data.length)
    if (resRes.data) setReservations(resRes.data as unknown as ReservationWithDetails[])
    if (goalsRes.data) setSavingsGoals(goalsRes.data)
    if (walletRes.data != null) setWalletBalance(Number(walletRes.data))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders])
  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const activeInventoryAccounts = useMemo(() => accounts.filter(a => !isDepleted(a)), [accounts])

  const advanceOrder = useCallback(async (order: OrderWithDetails, nextStatus: 'paid' | 'completed') => {
    setAdvancingId(order.id)
    try {
      await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: nextStatus })
      await fetchData()
    } finally { setAdvancingId(null) }
  }, [supabase, fetchData])

  const recommendations = useMemo(() => buildRecommendations({
    orders, accounts: activeInventoryAccounts, reservations, onAdvanceOrder: advanceOrder,
  }), [orders, activeInventoryAccounts, reservations, advanceOrder])

  const outstandingOrders = useMemo(() =>
    orders
      .filter(o => o.status === 'pending' || o.status === 'paid')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders])

  const savingsForecasts = useMemo(() => {
    const out: Record<string, string> = {}
    const activeGoal = savingsGoals.find(g => g.status === 'active')
    if (!activeGoal) return out
    const fourteenDaysAgo = Date.now() - 14 * 24 * 3_600_000
    const recentProfit = orders
      .filter(o => o.status === 'completed' && o.completed_at && new Date(o.completed_at).getTime() >= fourteenDaysAgo)
      .reduce((s, o) => s + (o.profit ?? 0), 0)
    const dailyAllocation = (recentProfit / 14) * (activeGoal.allocation_pct / 100)
    const remaining = Math.max(0, activeGoal.target_amount - activeGoal.current_amount)
    if (dailyAllocation > 0.5) {
      const daysLeft = Math.ceil(remaining / dailyAllocation)
      const projected = addDays(new Date(), daysLeft)
      out[activeGoal.id] = daysLeft <= 1
        ? `At your current pace, this completes within a day.`
        : `At your current pace (~${formatPHP(dailyAllocation)}/day), this completes around ${format(projected, 'MMM d')} — ${daysLeft} days away.`
    } else {
      out[activeGoal.id] = `Not enough recent activity to project a date yet — keep selling.`
    }
    return out
  }, [savingsGoals, orders])

  const topAccounts = useMemo(() => {
    const byAccount = new Map<string, { username: string; revenue: number; cost: number; profit: number; count: number }>()
    for (const o of completedOrders) {
      if (!o.roblox_account_id) continue
      const username = o.roblox_accounts?.username ?? accounts.find(a => a.id === o.roblox_account_id)?.username ?? 'Unknown'
      const entry = byAccount.get(o.roblox_account_id) ?? { username, revenue: 0, cost: 0, profit: 0, count: 0 }
      entry.revenue += o.selling_price ?? 0
      entry.cost += o.cost ?? 0
      entry.profit += o.profit ?? 0
      entry.count += 1
      byAccount.set(o.roblox_account_id, entry)
    }
    return Array.from(byAccount.entries())
      .map(([id, v]) => ({ id, ...v, margin: v.cost > 0 ? (v.profit / v.cost) * 100 : (v.profit > 0 ? Infinity : 0) }))
      .filter(a => a.count > 0)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 3)
  }, [completedOrders, accounts])

  const activityFeed = useMemo(() => orders.slice(0, 8).map(o => ({
    id: o.id,
    icon: o.status === 'completed' ? CheckCircle2 : ShoppingCart,
    iconColor: o.status === 'completed' ? '#22d3ee' : '#38bdf8',
    iconBg: o.status === 'completed' ? 'rgba(34,211,238,0.10)' : 'rgba(56,189,248,0.10)',
    text: o.status === 'completed' ? `Order ${o.order_number ?? ''} completed` : `Order from ${o.buyer_name ?? '—'}`,
    time: formatDistanceToNow(new Date(o.created_at), { addSuffix: true }),
    amount: o.selling_price ? formatPHP(o.selling_price) : null,
  })), [orders])

  const revenueData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i - 6)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOrders = completedOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dateStr)
    return {
      day: format(date, 'EEE'),
      revenue: dayOrders.reduce((s, o) => s + (o.selling_price ?? 0), 0),
      profit: dayOrders.reduce((s, o) => s + (o.profit ?? 0), 0),
    }
  }), [completedOrders])

  const topGamesData = useMemo(() => {
    const counts: Record<string, number> = {}
    completedOrders.forEach(o => {
      const name = o.gamepasses?.games?.name ?? 'Unknown'
      counts[name] = (counts[name] ?? 0) + 1
    })
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, sales]) => ({ name, sales }))
  }, [completedOrders])

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1 })
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value, color: '#6b7280',
    }))
  }, [orders])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayProfit = useMemo(() =>
    completedOrders
      .filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === todayStr)
      .reduce((s, o) => s + (o.profit ?? 0), 0),
    [completedOrders, todayStr])

  const weekRevenue = useMemo(() => revenueData.reduce((s, d) => s + d.revenue, 0), [revenueData])

  const quickActions = [
    { label: 'Add Gamepass', sub: 'Create new',     icon: Package,      href: '/inventory',    color: '#e879f9' },
    { label: 'New Order',    sub: 'Create order',   icon: ShoppingCart, href: '/orders',       color: '#22d3ee' },
    { label: 'Accounts',     sub: 'View accounts',  icon: Users,        href: '/accounts',     color: '#38bdf8' },
    { label: 'Analytics',    sub: 'Detailed stats', icon: BarChart2,    href: '/transactions', color: '#a78bfa' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100svh - 5rem)' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="relative overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════════════
          § 01 · HERO
          Full-screen opening — floating chips orbiting the headline
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ minHeight: 'calc(100svh - 5rem)', padding: '5rem 1.5rem 7rem' }}
      >
        {/* Focal blob glow — deep purple, centered overhead */}
        <Blob
          color="rgba(139,92,246,0.18)"
          width={900} height={900}
          style={{ top: -400, left: '50%', transform: 'translateX(-50%)' }}
        />
        {/* Secondary cyan blob — lower right */}
        <Blob
          color="rgba(34,211,238,0.10)"
          width={500} height={500}
          style={{ bottom: -180, right: '-8%' }}
        />

        {/* ── Floating chips — xl only (need horizontal space) ── */}
        <FloatingChip
          label="Robux Inventory"
          value={formatRobux(totalRobux)}
          color="#22d3ee"
          icon={Coins}
          delay={0.65}
          style={{ top: '18%', left: '2%' }}
        />
        <div className="hidden xl:block">
          <FloatingChip
            label="Wallet Balance"
            value={formatPHP(walletBalance)}
            color="#34d399"
            icon={Wallet}
            delay={0.80}
            style={{ top: '38%', right: '2%' }}
          />
        </div>
        <div className="hidden xl:block">
          <FloatingChip
            label="Today's Profit"
            value={formatPHP(todayProfit)}
            color="#a78bfa"
            icon={TrendingUp}
            delay={0.92}
            style={{ bottom: '32%', left: '1%' }}
          />
        </div>
        <div className="hidden xl:block">
          <FloatingChip
            label="Outstanding"
            value={`${outstandingOrders.length} orders`}
            color="#f59e0b"
            icon={ShoppingCart}
            delay={1.05}
            style={{ bottom: '28%', right: '1.5%' }}
          />
        </div>

        {/* ── Main hero content ── */}
        <div className="relative z-10 max-w-3xl mx-auto w-full">

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-8"
          >
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase"
              style={{
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.22)',
                color: '#22d3ee',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
              Live Dashboard
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-black tracking-tight leading-[0.95] mb-6"
            style={{ fontSize: 'clamp(2.8rem, 7vw, 5.2rem)' }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Your Robux Business<br />
            <span style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, rgba(255,255,255,0.88) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              At a Glance
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="text-[16px] leading-relaxed max-w-lg mx-auto mb-14"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
          >
            Command center for your Roblox gamepass operation.<br />Scroll to explore every layer of your business.
          </motion.p>

          {/* Mobile KPIs — shown when floating chips are hidden */}
          <motion.div
            className="grid grid-cols-2 gap-3 xl:hidden"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42 }}
          >
            {([
              { label: 'Robux Inventory', value: totalRobux,            fmt: (v: number) => `${Math.round(v).toLocaleString()} R$`, color: '#22d3ee', icon: Coins },
              { label: 'Wallet Balance',  value: walletBalance,         fmt: (v: number) => `₱${v.toFixed(2)}`,                     color: '#34d399', icon: Wallet },
              { label: "Today's Profit",  value: todayProfit,           fmt: (v: number) => `₱${v.toFixed(2)}`,                     color: '#a78bfa', icon: TrendingUp },
              { label: 'Outstanding',     value: outstandingOrders.length, fmt: (v: number) => `${Math.round(v)} orders`,           color: '#f59e0b', icon: ShoppingCart },
            ] as const).map(({ label, value, fmt, color, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl p-4 text-left"
                style={{
                  background: 'rgba(255,255,255,0.032)',
                  border: `1px solid ${color}20`,
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon style={{ width: 12, height: 12, color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>{label}</span>
                </div>
                <CountUp value={value} format={fmt} duration={1.6}
                  className="text-lg font-black tabular-nums block" style={{ color }} />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          § 02 · INVENTORY INTELLIGENCE
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 sm:px-8 overflow-hidden"
        style={{ paddingTop: '8rem', paddingBottom: '8rem' }}
      >
        <Blob color="rgba(34,211,238,0.09)" width={600} height={600} style={{ top: '-100px', left: '-150px' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="02" label="Inventory Intelligence" />

          {/* Focal headline */}
          <motion.div
            className="mb-14 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {accounts.length > 0 ? (
              <>
                <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)' }}>
                  <CountUp
                    value={totalRobux}
                    format={(v) => Math.round(v).toLocaleString()}
                    duration={1.6}
                    style={{ color: '#22d3ee' }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.88)' }}> R$ across </span>
                  <span style={{ color: '#22d3ee' }}>{accounts.length} accounts</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  Stock distribution, reservation depth, and fulfillment capacity.
                </p>
              </>
            ) : (
              <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)', color: 'rgba(255,255,255,0.88)' }}>
                Your Inventory
              </h2>
            )}
          </motion.div>

          {/* Account cards — staggered */}
          {accounts.length > 0 && (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
            >
              {accounts.map((acc) => {
                const available = getAvailableRobux(acc)
                const depleted = isDepleted(acc)
                const utilPct = acc.current_robux > 0 && acc.reserved_robux > 0
                  ? Math.min(100, (acc.reserved_robux / acc.current_robux) * 100) : 0
                const accentColor = depleted ? '#f43f5e' : available < 2000 ? '#f59e0b' : '#22d3ee'

                return (
                  <motion.div
                    key={acc.id}
                    variants={staggerItem}
                    className="rounded-2xl p-4"
                    style={{
                      background: depleted ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.032)',
                      border: `1px solid ${depleted ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.065)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
                      <span className="text-[11px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{acc.username}</span>
                    </div>
                    <p className="text-[19px] font-black tabular-nums leading-none mb-1" style={{ color: accentColor }}>
                      {formatRobux(acc.current_robux)}
                    </p>
                    <p className="label-caps">{depleted ? 'Depleted' : `${formatRobux(available)} free`}</p>
                    {utilPct > 0 && (
                      <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: '#f59e0b' }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${utilPct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* Fulfillment readiness */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <FulfillmentReadiness orders={orders} accounts={activeInventoryAccounts} />
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          § 03 · SALES PERFORMANCE
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 sm:px-8 overflow-hidden"
        style={{ paddingTop: '8rem', paddingBottom: '8rem' }}
      >
        <Blob color="rgba(52,211,153,0.09)" width={650} height={650} style={{ top: '-80px', right: '-150px' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="03" label="Sales Performance" />

          <motion.div
            className="mb-14 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {weekRevenue > 0 ? (
              <>
                <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)' }}>
                  <CountUp value={weekRevenue} format={(v) => `₱${v.toFixed(2)}`} duration={1.6} style={{ color: '#34d399' }} />
                  <span style={{ color: 'rgba(255,255,255,0.88)' }}> earned this week</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  Weekly trends, best-selling games, and order pipeline breakdown.
                </p>
              </>
            ) : (
              <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)', color: 'rgba(255,255,255,0.88)' }}>
                Sales Performance
              </h2>
            )}
          </motion.div>

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div variants={staggerItem}>
              <RevenueChart data={revenueData} />
            </motion.div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <motion.div variants={staggerItem} className="lg:col-span-2">
                <TopGamesChart data={topGamesData} />
              </motion.div>
              <motion.div variants={staggerItem} className="lg:col-span-3">
                <OrderStatusChart data={statusData} />
              </motion.div>
            </div>

            {topAccounts.length > 0 && (
              <motion.div
                variants={staggerItem}
                className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.060)' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <Trophy className="w-4 h-4" style={{ color: '#fbbf24' }} />
                  <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Top Performing Accounts</p>
                  <span className="ml-auto label-caps">by margin</span>
                </div>
                <div className="space-y-2.5">
                  {topAccounts.map((acc, i) => (
                    <div key={acc.id} className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                        style={{ background: i === 0 ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.07)', color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}
                      >{i + 1}</span>
                      <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'rgba(255,255,255,0.76)' }}>{acc.username}</span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: '#34d399' }}>
                        {acc.margin === Infinity ? '∞%' : `${acc.margin.toFixed(0)}%`}
                      </span>
                      <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.38)' }}>{formatPHP(acc.profit)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          § 04 · CAPITAL & BUSINESS HEALTH
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 sm:px-8 overflow-hidden"
        style={{ paddingTop: '8rem', paddingBottom: '8rem' }}
      >
        <Blob color="rgba(245,158,11,0.08)" width={600} height={600} style={{ top: '0px', left: '-100px' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="04" label="Capital & Business Health" />

          <motion.div
            className="mb-14 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)', color: 'rgba(255,255,255,0.88)' }}>
              Where the money is<br />
              <span style={{
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>right now</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
              Capital position, purchasing capacity, savings progress, and acquisition history.
            </p>
          </motion.div>

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={staggerItem}><CapitalPosition accounts={accounts} walletBalance={walletBalance} /></motion.div>
              <motion.div variants={staggerItem}><CapitalSafety accounts={accounts} walletBalance={walletBalance} /></motion.div>
            </div>
            <motion.div variants={staggerItem}><SavingsWidget compact={false} forecasts={savingsForecasts} /></motion.div>
            <motion.div variants={staggerItem}><CapitalEventsLedger refreshKey={0} /></motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          § 05 · MONEY FLOW & ACTIVITY
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 sm:px-8 overflow-hidden"
        style={{ paddingTop: '8rem', paddingBottom: '8rem' }}
      >
        <Blob color="rgba(139,92,246,0.10)" width={550} height={550} style={{ bottom: '-80px', right: '-80px' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="05" label="Money Flow & Activity" />

          <motion.div
            className="mb-14 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)' }}>
              <CountUp value={totalProfit} format={(v) => `₱${v.toFixed(2)}`} duration={1.6} style={{ color: '#a78bfa' }} />
              <span style={{ color: 'rgba(255,255,255,0.88)' }}> total profit</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
              Where every peso came from, where it went, and what happened recently.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-5 gap-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div variants={staggerItem} className="lg:col-span-3">
              <MoneyFlowSummary orders={orders} savingsGoals={savingsGoals} />
            </motion.div>
            <motion.div
              variants={staggerItem}
              className="lg:col-span-2 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.060)' }}
            >
              <p className="text-[12px] font-bold mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>Recent Activity</p>
              {activityFeed.length === 0 ? (
                <p className="text-[12px] text-center py-6" style={{ color: 'rgba(255,255,255,0.30)' }}>No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activityFeed.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: item.iconBg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium leading-snug truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>{item.text}</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.time}</p>
                            {item.amount && <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.60)' }}>{item.amount}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════════════════════════
          § 06 · COMMAND CENTER
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="relative px-6 sm:px-8 overflow-hidden"
        style={{ paddingTop: '8rem', paddingBottom: '10rem' }}
      >
        <Blob color="rgba(34,211,238,0.07)" width={700} height={700} style={{ bottom: '-200px', left: '50%', transform: 'translateX(-50%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="06" label="Command Center" />

          <motion.div
            className="mb-14 max-w-2xl"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {outstandingOrders.length > 0 ? (
              <>
                <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)' }}>
                  <span style={{ color: '#f59e0b' }}>{outstandingOrders.length} order{outstandingOrders.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'rgba(255,255,255,0.88)' }}> waiting on you</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  The highest-value action, your active order queue, and quick navigation.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.6rem)' }}>
                  <span style={{ color: '#34d399' }}>All clear</span>
                  <span style={{ color: 'rgba(255,255,255,0.88)' }}> — nothing needs action</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px' }}>
                  Recommended actions, quick navigation, and your recent pipeline.
                </p>
              </>
            )}
          </motion.div>

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            {/* Next best action */}
            <motion.div variants={staggerItem}>
              <NextBestAction recommendations={recommendations} />
            </motion.div>

            {/* Outstanding orders queue */}
            <motion.div
              variants={staggerItem}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.026)', border: '1px solid rgba(255,255,255,0.058)' }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.058)' }}>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Outstanding Orders</p>
                  <p className="label-caps mt-0.5">
                    {outstandingOrders.length === 0 ? 'Nothing waiting' : `${outstandingOrders.length} need a push — oldest first`}
                  </p>
                </div>
                <a href="/orders" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#22d3ee' }}>
                  All Orders <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              {outstandingOrders.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2" style={{ color: '#34d399', opacity: 0.5 }} />
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Every order is moving.</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
                  {outstandingOrders.slice(0, 8).map((order) => {
                    const ageHours = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000
                    const ageColor = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'rgba(255,255,255,0.35)'
                    const nextStatus: 'paid' | 'completed' = order.status === 'pending' ? 'paid' : 'completed'
                    const isBusy = advancingId === order.id
                    return (
                      <motion.div
                        key={order.id}
                        variants={staggerItem}
                        className="flex items-center gap-4 px-5 py-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.042)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.30)' }}>{order.order_number ?? '—'}</span>
                            <StatusBadge status={order.status} />
                            <span className="text-[10px] font-bold" style={{ color: ageColor }}>
                              {ageHours < 48 ? `${Math.round(ageHours)}h` : `${Math.round(ageHours / 24)}d`}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{order.buyer_name ?? '—'}</p>
                          <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {order.gamepasses?.games?.name ?? '—'} · {formatRobux(order.robux_amount ?? 0)}
                          </p>
                        </div>
                        <p className="text-[13px] font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {order.selling_price ? formatPHP(order.selling_price) : '—'}
                        </p>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => advanceOrder(order, nextStatus)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-opacity"
                          style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.18)' }}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isBusy ? '…' : order.status === 'pending' ? 'Mark Paid' : 'Mark Done'}
                        </button>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </motion.div>

            {/* Quick nav grid */}
            <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(({ label, sub, icon: Icon, href, color }) => (
                <a
                  key={label}
                  href={href}
                  className="rounded-2xl p-4 flex flex-col items-center gap-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.026)', border: `1px solid ${color}1e` }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}16`, border: `1px solid ${color}28` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.78)' }}>{label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>{sub}</p>
                  </div>
                </a>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <div className="px-6 pb-16 text-center">
        <p style={{ color: 'rgba(255,255,255,0.16)', fontSize: 11 }}>
          {gamepassCount} gamepasses · {completedOrders.length} completed · {formatPHP(totalProfit)} lifetime profit
        </p>
      </div>

    </div>
  )
}
