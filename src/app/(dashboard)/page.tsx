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
import {
  OrderWithDetails, RobloxAccount, ReservationWithDetails, SavingsGoal,
} from '@/lib/types/database'

// ── Shared section components ─────────────────────────────────────────────────

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.p
      className="label-caps mb-5 flex items-center gap-3"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span style={{ color: 'rgba(255,255,255,0.22)' }}>§ {index}</span>
      <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
      <span>{label}</span>
    </motion.p>
  )
}

function SectionHeadline({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.h2
      className="hero-headline mb-5"
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.h2>
  )
}

function SectionSub({ children, delay = 0.1 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.p
      className="hero-subtext mb-12 lg:mb-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.p>
  )
}

function SectionDivider() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
      <div
        className="h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 25%, rgba(34,211,238,0.10) 50%, rgba(255,255,255,0.05) 75%, transparent 100%)',
        }}
      />
    </div>
  )
}

function Spotlight({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={style}
    />
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
    } finally {
      setAdvancingId(null)
    }
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
        : `At your current pace (~${formatPHP(dailyAllocation)}/day saved), this completes around ${format(projected, 'MMM d')} — about ${daysLeft} day${daysLeft === 1 ? '' : 's'} away.`
    } else {
      out[activeGoal.id] = `Not enough recent completed-order activity to project a completion date yet — keep selling and this will sharpen.`
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
    text: o.status === 'completed'
      ? `Order ${o.order_number ?? ''} completed`
      : `Order from ${o.buyer_name ?? '—'}`,
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

  const weekRevenue = useMemo(() =>
    revenueData.reduce((s, d) => s + d.revenue, 0),
    [revenueData])

  const quickActions = [
    { label: 'Add Gamepass', sub: 'Create new',     icon: Package,     href: '/inventory',    color: '#e879f9' },
    { label: 'New Order',    sub: 'Create order',   icon: ShoppingCart, href: '/orders',      color: '#22d3ee' },
    { label: 'Accounts',     sub: 'View accounts',  icon: Users,       href: '/accounts',     color: '#38bdf8' },
    { label: 'Analytics',    sub: 'Detailed stats', icon: BarChart2,   href: '/transactions', color: '#a78bfa' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100svh - 5rem)' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="relative">

      {/* ═══════════════════════════════════════════════════════
          § 01 · HERO
      ═══════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center px-6 sm:px-8 text-center overflow-hidden"
        style={{ minHeight: 'calc(100svh - 5rem)', paddingTop: '4rem', paddingBottom: '6rem' }}
      >
        <Spotlight style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.14) 0%, rgba(34,211,238,0.06) 45%, transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto w-full">

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center mb-8"
          >
            <span className="chip chip-active inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
              LIVE DASHBOARD
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="hero-headline mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Your Robux Business<br />
            <span style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 55%, rgba(255,255,255,0.88) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              At a Glance
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="hero-subtext mb-14 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            Command center for your Roblox gamepass operation. Scroll to explore every layer of your business.
          </motion.p>

          {/* Hero KPI grid */}
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {([
              { label: 'Total Inventory', value: totalRobux,           fmt: (v: number) => `${Math.round(v).toLocaleString()} R$`, color: '#22d3ee', icon: Coins },
              { label: 'Wallet Balance',  value: walletBalance,        fmt: (v: number) => `₱${v.toFixed(2)}`,                     color: '#34d399', icon: Wallet },
              { label: "Today's Profit",  value: todayProfit,          fmt: (v: number) => `₱${v.toFixed(2)}`,                     color: '#a78bfa', icon: TrendingUp },
              { label: 'Awaiting Action', value: outstandingOrders.length, fmt: (v: number) => `${Math.round(v)} orders`,          color: '#f59e0b', icon: ShoppingCart },
            ] as const).map(({ label, value, fmt, color, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl p-5 text-center relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: `1px solid ${color}28`,
                  backdropFilter: 'blur(24px) saturate(140%)',
                  boxShadow: `0 0 40px ${color}0c, inset 0 1px 0 rgba(255,255,255,0.06)`,
                }}
              >
                <div className="flex justify-center mb-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
                <p className="label-caps mb-1.5">{label}</p>
                <CountUp
                  value={value}
                  format={fmt}
                  duration={2.0}
                  className="text-2xl lg:text-3xl font-black tabular-nums leading-tight block"
                  style={{ color }}
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ color: 'rgba(255,255,255,0.20)' }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      <SectionDivider />

      {/* ═══════════════════════════════════════════════════════
          § 02 · INVENTORY INTELLIGENCE
      ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-8 py-24 lg:py-32 overflow-hidden">
        <Spotlight style={{ background: 'radial-gradient(ellipse 60% 70% at 10% 50%, rgba(34,211,238,0.07) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="02" label="INVENTORY INTELLIGENCE" />
          <SectionHeadline>
            {totalRobux > 0
              ? <>{totalRobux.toLocaleString()} R$ across <span style={{ color: '#22d3ee' }}>{accounts.length} accounts</span></>
              : 'Your Inventory'}
          </SectionHeadline>
          <SectionSub>
            Stock distribution, fulfillment capacity, and account utilization at a glance.
          </SectionSub>

          {/* Account balances grid */}
          <motion.div
            className="mb-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            {accounts.length === 0 ? (
              <motion.div variants={staggerItem} className="glass-card p-8 text-center rounded-2xl">
                <p style={{ color: 'rgba(255,255,255,0.40)' }}>No accounts yet — add one to get started.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {accounts.map((acc) => {
                  const available = getAvailableRobux(acc)
                  const depleted = isDepleted(acc)
                  const utilPct = acc.current_robux > 0 && acc.reserved_robux > 0
                    ? Math.min(100, (acc.reserved_robux / acc.current_robux) * 100)
                    : 0
                  const dotColor = depleted ? '#f43f5e' : available < 2000 ? '#f59e0b' : '#22d3ee'

                  return (
                    <motion.div
                      key={acc.id}
                      variants={staggerItem}
                      className="rounded-2xl p-4 relative overflow-hidden"
                      style={{
                        background: depleted ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.038)',
                        border: `1px solid ${depleted ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.072)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
                        />
                        <span className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.80)' }}>
                          {acc.username}
                        </span>
                      </div>
                      <p className="text-[18px] font-black tabular-nums leading-none mb-1" style={{ color: dotColor }}>
                        {formatRobux(acc.current_robux)}
                      </p>
                      <p className="label-caps mb-2">{depleted ? 'Depleted' : `${formatRobux(available)} free`}</p>
                      {utilPct > 0 && (
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: '#f59e0b' }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${utilPct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>

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

      {/* ═══════════════════════════════════════════════════════
          § 03 · SALES PERFORMANCE
      ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-8 py-24 lg:py-32 overflow-hidden">
        <Spotlight style={{ background: 'radial-gradient(ellipse 55% 65% at 90% 40%, rgba(52,211,153,0.07) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="03" label="SALES PERFORMANCE" />
          <SectionHeadline>
            {weekRevenue > 0
              ? <><span style={{ color: '#34d399' }}>{formatPHP(weekRevenue)}</span> earned this week</>
              : 'Sales Performance'}
          </SectionHeadline>
          <SectionSub>Weekly profit trends, order pipeline, and your best-performing games.</SectionSub>

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            {/* Revenue chart — full width */}
            <motion.div variants={staggerItem}>
              <RevenueChart data={revenueData} />
            </motion.div>

            {/* Top games + order status */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <motion.div variants={staggerItem} className="lg:col-span-2">
                <TopGamesChart data={topGamesData} />
              </motion.div>
              <motion.div variants={staggerItem} className="lg:col-span-3">
                <OrderStatusChart data={statusData} />
              </motion.div>
            </div>

            {/* Top performing accounts leaderboard */}
            {topAccounts.length > 0 && (
              <motion.div
                variants={staggerItem}
                className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <Trophy className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Top Performing Accounts</p>
                  <p className="text-[11px] ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>by realized margin</p>
                </div>
                <div className="space-y-2.5">
                  {topAccounts.map((acc, i) => (
                    <div key={acc.id} className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                        style={{
                          background: i === 0 ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.08)',
                          color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.40)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: 'rgba(255,255,255,0.76)' }}>{acc.username}</span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: '#34d399' }}>
                        {acc.margin === Infinity ? '∞%' : `${acc.margin.toFixed(0)}%`} margin
                      </span>
                      <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.40)' }}>{formatPHP(acc.profit)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════════════════════════════════════════════
          § 04 · CAPITAL & BUSINESS HEALTH
      ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-8 py-24 lg:py-32 overflow-hidden">
        <Spotlight style={{ background: 'radial-gradient(ellipse 60% 65% at 15% 60%, rgba(245,158,11,0.06) 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="04" label="CAPITAL & BUSINESS HEALTH" />
          <SectionHeadline>
            Where the money is right now
          </SectionHeadline>
          <SectionSub>Capital position, purchasing capacity, savings progress, and acquisition history.</SectionSub>

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={staggerItem}>
                <CapitalPosition accounts={accounts} walletBalance={walletBalance} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <CapitalSafety accounts={accounts} walletBalance={walletBalance} />
              </motion.div>
            </div>
            <motion.div variants={staggerItem}>
              <SavingsWidget compact={false} forecasts={savingsForecasts} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <CapitalEventsLedger refreshKey={0} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════════════════════════════════════════════════
          § 05 · MONEY FLOW & ACTIVITY
      ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-8 py-24 lg:py-32 overflow-hidden">
        <Spotlight style={{ background: 'radial-gradient(ellipse 55% 60% at 85% 30%, rgba(139,92,246,0.07) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="05" label="MONEY FLOW & ACTIVITY" />
          <SectionHeadline>
            {totalProfit > 0
              ? <><span style={{ color: '#a78bfa' }}>{formatPHP(totalProfit)}</span> total profit generated</>
              : 'Money Flow'}
          </SectionHeadline>
          <SectionSub>Where every peso came from, where it went, and what happened recently.</SectionSub>

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

            {/* Activity feed */}
            <motion.div
              variants={staggerItem}
              className="lg:col-span-2 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}
            >
              <p className="text-[12px] font-bold mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>Recent Activity</p>
              {activityFeed.length === 0 ? (
                <p className="text-[12px] text-center py-6" style={{ color: 'rgba(255,255,255,0.35)' }}>No activity yet.</p>
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
                          <p className="text-[11px] font-medium leading-snug truncate" style={{ color: 'rgba(255,255,255,0.76)' }}>{item.text}</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>{item.time}</p>
                            {item.amount && <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.amount}</p>}
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

      {/* ═══════════════════════════════════════════════════════
          § 06 · COMMAND CENTER
      ═══════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-8 py-24 lg:py-32 overflow-hidden">
        <Spotlight style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 80%, rgba(34,211,238,0.05) 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-[1200px] mx-auto">
          <SectionLabel index="06" label="COMMAND CENTER" />
          <SectionHeadline>
            {outstandingOrders.length > 0
              ? <><span style={{ color: '#f59e0b' }}>{outstandingOrders.length} order{outstandingOrders.length !== 1 ? 's' : ''}</span> waiting on you</>
              : <><span style={{ color: '#34d399' }}>All clear</span> — nothing needs action</>}
          </SectionHeadline>
          <SectionSub>The highest-value action you can take right now, your active orders, and quick navigation.</SectionSub>

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

            {/* Outstanding orders */}
            <motion.div
              variants={staggerItem}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.030)', border: '1px solid rgba(255,255,255,0.065)' }}
            >
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.065)' }}
              >
                <div>
                  <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>Outstanding Orders</p>
                  <p className="label-caps mt-0.5">
                    {outstandingOrders.length === 0
                      ? 'Nothing waiting on you'
                      : `${outstandingOrders.length} need a status push — oldest first`}
                  </p>
                </div>
                <a
                  href="/orders"
                  className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: '#22d3ee' }}
                >
                  Open Orders <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              {outstandingOrders.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2" style={{ color: '#34d399', opacity: 0.6 }} />
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Every order is moving — nothing is stuck waiting on you.
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true }}
                >
                  {outstandingOrders.slice(0, 8).map((order) => {
                    const ageHours = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000
                    const ageColor = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'rgba(255,255,255,0.40)'
                    const nextStatus: 'paid' | 'completed' = order.status === 'pending' ? 'paid' : 'completed'
                    const actionLabel = order.status === 'pending' ? 'Mark Paid' : 'Mark Done'
                    const isBusy = advancingId === order.id

                    return (
                      <motion.div
                        key={order.id}
                        variants={staggerItem}
                        className="flex items-center gap-4 px-5 py-3 transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.050)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{order.order_number ?? '—'}</span>
                            <StatusBadge status={order.status} />
                            <span className="text-[10px] font-bold" style={{ color: ageColor }}>
                              {ageHours < 48 ? `${Math.round(ageHours)}h` : `${Math.round(ageHours / 24)}d old`}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{order.buyer_name ?? '—'}</p>
                          <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>
                            {order.gamepasses?.games?.name ?? '—'} · {formatRobux(order.robux_amount ?? 0)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                            {order.selling_price ? formatPHP(order.selling_price) : '—'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => advanceOrder(order, nextStatus)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                          style={{ background: 'rgba(34,211,238,0.10)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.20)' }}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isBusy ? '…' : actionLabel}
                        </button>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={staggerItem}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map(({ label, sub, icon: Icon, href, color }) => (
                  <a
                    key={label}
                    href={href}
                    className="rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.032)',
                      border: `1px solid ${color}22`,
                      boxShadow: `0 0 20px ${color}0a`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.80)' }}>{label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{sub}</p>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer bar */}
      <div className="px-6 sm:px-8 pb-16 pt-4 text-center">
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
          {gamepassCount} gamepasses · {completedOrders.length} completed orders · {formatPHP(totalProfit)} lifetime profit
        </p>
      </div>

    </div>
  )
}
