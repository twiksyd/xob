'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, formatDistanceToNow, addDays } from 'date-fns'
import TopBar from '@/components/shared/TopBar'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import NextBestAction from '@/components/dashboard/NextBestAction'
import FulfillmentReadiness from '@/components/dashboard/FulfillmentReadiness'
import MoneyFlowSummary from '@/components/dashboard/MoneyFlowSummary'
import { buildRecommendations } from '@/lib/recommendations'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUpVariants } from '@/lib/motion'
import {
  Package, ShoppingCart, Users, BarChart2, ArrowUpRight,
  CheckCircle2, ChevronDown, Loader2, Trophy, Coins,
} from 'lucide-react'
import SavingsWidget from '@/components/shared/SavingsWidget'
import { formatRobux, formatPHP } from '@/lib/utils/pricing'
import {
  OrderWithDetails, RobloxAccount, ReservationWithDetails, SavingsGoal,
} from '@/lib/types/database'

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [gamepassCount, setGamepassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, accountsRes, gpRes, resRes, goalsRes] = await Promise.all([
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
    ])
    if (ordersRes.data) setOrders(ordersRes.data as unknown as OrderWithDetails[])
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (gpRes.data) setGamepassCount(gpRes.data.length)
    if (resRes.data) setReservations(resRes.data as unknown as ReservationWithDetails[])
    if (goalsRes.data) setSavingsGoals(goalsRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders])
  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)

  // ── Advance an order's status with one click — same RPC the Orders page uses ──
  const advanceOrder = useCallback(async (order: OrderWithDetails, nextStatus: 'paid' | 'completed') => {
    setAdvancingId(order.id)
    try {
      await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: nextStatus })
      await fetchData()
    } finally {
      setAdvancingId(null)
    }
  }, [supabase, fetchData])

  // ── The recommendation engine: ranks every "thing worth doing" into one list ──
  const recommendations = useMemo(() => buildRecommendations({
    orders, accounts, reservations, onAdvanceOrder: advanceOrder,
  }), [orders, accounts, reservations, advanceOrder])

  // ── Outstanding orders queue — sorted oldest-first, the literal click-list ──
  const outstandingOrders = useMemo(() =>
    orders
      .filter(o => o.status === 'pending' || o.status === 'paid')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders])

  // ── Savings forecast: "at this pace, completes around <date>" ──────────────
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

  // ── Top performing accounts — ranked by realized margin on completed orders ──
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

  const activityFeed = useMemo(() => orders.slice(0, 6).map(o => ({
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

  const quickActions = [
    { label: 'Add Gamepass', sub: 'Create new',    icon: Package,    href: '/inventory',    color: '#e879f9' },
    { label: 'New Order',    sub: 'Create order',  icon: ShoppingCart,href: '/orders',       color: '#22d3ee' },
    { label: 'Accounts',     sub: 'View accounts', icon: Users,      href: '/accounts',     color: '#38bdf8' },
    { label: 'Analytics',    sub: 'Detailed stats',icon: BarChart2,  href: '/transactions', color: '#a78bfa' },
  ]

  if (loading) return (
    <div className="flex flex-col h-screen">
      <TopBar title="Command Center" subtitle="Everything that needs your attention, in one place" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar title="Command Center" subtitle="What should you do next?" />
      <div className="flex-1 overflow-auto">
        <div className="p-5 max-w-[1400px] mx-auto space-y-4">

          {/* ── 1. Hero: the single highest-value thing to do right now ── */}
          <NextBestAction recommendations={recommendations} />

          {/* ── 2. Operator framing: capacity + where the money went ── */}
          <div className="grid grid-cols-2 gap-4">
            <FulfillmentReadiness orders={orders} accounts={accounts} />
            <MoneyFlowSummary orders={orders} savingsGoals={savingsGoals} />
          </div>

          {/* ── 3. The action queue + savings progress ── */}
          <div className="grid grid-cols-5 gap-4">
            {/* Outstanding orders — the literal click-list */}
            <div className="col-span-3 glass-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(15,13,42,0.05)' }}>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Outstanding Orders</p>
                  <p className="label-caps mt-0.5">
                    {outstandingOrders.length === 0 ? 'Nothing waiting on you' : `${outstandingOrders.length} need a status push — oldest first`}
                  </p>
                </div>
                <a href="/orders" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
                  Open Orders <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              {outstandingOrders.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2" style={{ color: '#34d399', opacity: 0.6 }} />
                  <p className="text-[13px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Every order is moving — nothing is stuck waiting on you.</p>
                </div>
              ) : (
                <div>
                  {outstandingOrders.slice(0, 6).map((order) => {
                    const ageHours = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000
                    const ageColor = ageHours > 48 ? '#f43f5e' : ageHours > 24 ? '#f59e0b' : 'oklch(0.55 0.010 265)'
                    const nextStatus: 'paid' | 'completed' = order.status === 'pending' ? 'paid' : 'completed'
                    const actionLabel = order.status === 'pending' ? 'Mark Paid' : 'Mark Completed'
                    const isBusy = advancingId === order.id
                    return (
                      <div
                        key={order.id}
                        className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[rgba(34,211,238,0.025)]"
                        style={{ borderBottom: '1px solid rgba(15,13,42,0.04)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-semibold" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.order_number ?? '—'}</span>
                            <StatusBadge status={order.status} />
                            <span className="text-[10px] font-bold" style={{ color: ageColor }}>
                              {ageHours < 48 ? `${Math.round(ageHours)}h old` : `${Math.round(ageHours / 24)}d old`}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold mt-0.5 truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.buyer_name ?? '—'}</p>
                          <p className="text-[11px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.gamepasses?.games?.name ?? '—'} · {formatRobux(order.robux_amount ?? 0)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.selling_price ? formatPHP(order.selling_price) : '—'}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => advanceOrder(order, nextStatus)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-60"
                          style={{ background: 'rgba(34,211,238,0.10)', color: 'oklch(0.42 0.13 200)', border: '1px solid rgba(34,211,238,0.22)' }}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isBusy ? 'Working…' : actionLabel}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Savings progress, with forecast baked in */}
            <div className="col-span-2">
              <SavingsWidget compact={false} forecasts={savingsForecasts} />
            </div>
          </div>

          {/* ── 4. Everything else — collapsed by default ── */}
          <div className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[rgba(139,92,246,0.025)]"
            >
              <div className="text-left">
                <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>More detail</p>
                <p className="label-caps mt-0.5">Account balances, top performers, recent activity, trends — open when you want to dig in</p>
              </div>
              <motion.div animate={{ rotate: moreOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                <ChevronDown className="w-4 h-4" style={{ color: 'oklch(0.55 0.010 265)' }} />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {moreOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="p-5 space-y-4" style={{ borderTop: '1px solid rgba(15,13,42,0.05)' }}>

                    {/* Top performing accounts + Account balances */}
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-2 glass-secondary rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
                          <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Top Performing Accounts</p>
                        </div>
                        <p className="text-[10px] mb-3" style={{ color: 'oklch(0.55 0.010 265)' }}>Ranked by realized profit margin — where your next Robux purchase pays off fastest</p>
                        {topAccounts.length === 0 ? (
                          <p className="text-[11px] text-center py-3" style={{ color: 'oklch(0.55 0.010 265)' }}>Not enough completed orders yet to rank accounts.</p>
                        ) : (
                          <div className="space-y-2">
                            {topAccounts.map((acc, i) => (
                              <div key={acc.id} className="flex items-center gap-2.5 py-1">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                                  style={{ background: i === 0 ? 'rgba(251,191,36,0.18)' : 'rgba(15,13,42,0.06)', color: i === 0 ? '#b45309' : 'oklch(0.50 0.012 265)' }}
                                >
                                  {i + 1}
                                </span>
                                <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'oklch(0.18 0.025 270)' }}>{acc.username}</span>
                                <span className="text-[11px] font-bold tabular-nums" style={{ color: '#34d399' }}>
                                  {acc.margin === Infinity ? '∞' : `${acc.margin.toFixed(0)}%`} margin
                                </span>
                                <span className="text-[10px] tabular-nums" style={{ color: 'oklch(0.55 0.010 265)' }}>{formatPHP(acc.profit)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-3 glass-secondary rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Coins className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
                            <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Account Balances</p>
                          </div>
                          <a href="/accounts" className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
                            Manage <ArrowUpRight className="w-3 h-3" />
                          </a>
                        </div>
                        {accounts.length === 0 ? (
                          <p className="text-[12px] text-center py-4" style={{ color: 'oklch(0.55 0.010 265)' }}>No accounts yet.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {accounts.map((acc) => {
                              const available = acc.current_robux - (acc.reserved_robux ?? 0)
                              const dotColor = available < 500 ? '#f43f5e' : available < 2000 ? '#f59e0b' : '#22d3ee'
                              return (
                                <div key={acc.id} className="flex items-center gap-2.5 py-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}60` }} />
                                  <span className="text-[12px] font-medium flex-1 truncate" style={{ color: 'oklch(0.18 0.025 270)' }}>{acc.username}</span>
                                  <span className="text-[11px] font-semibold flex-shrink-0 tabular-nums" style={{ color: 'oklch(0.50 0.010 265)' }}>{formatRobux(acc.current_robux)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(15,13,42,0.05)' }}>
                          <span className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Total across {accounts.length} accounts</span>
                          <span className="text-[13px] font-extrabold tabular-nums" style={{ color: 'oklch(0.12 0.028 272)' }}>{formatRobux(totalRobux)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Trends */}
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-3"><RevenueChart data={revenueData} /></div>
                      <div className="col-span-2"><OrderStatusChart data={statusData} /></div>
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-2"><TopGamesChart data={topGamesData} /></div>

                      {/* Recent activity */}
                      <div className="col-span-3 glass-secondary rounded-2xl p-4">
                        <p className="text-[12px] font-bold mb-3" style={{ color: 'oklch(0.10 0.030 272)' }}>Recent Activity</p>
                        {activityFeed.length === 0 ? (
                          <p className="text-[12px] text-center py-4" style={{ color: 'oklch(0.55 0.010 265)' }}>No activity yet.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {activityFeed.map((item) => {
                              const Icon = item.icon
                              return (
                                <div key={item.id} className="flex items-start gap-2.5">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: item.iconBg }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium leading-snug truncate" style={{ color: 'oklch(0.18 0.025 270)' }}>{item.text}</p>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                      <p className="text-[10px]" style={{ color: 'oklch(0.60 0.010 265)' }}>{item.time}</p>
                                      {item.amount && <p className="text-[11px] font-semibold" style={{ color: 'oklch(0.18 0.025 270)' }}>{item.amount}</p>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="glass-secondary rounded-2xl p-4">
                      <p className="text-[12px] font-bold mb-3" style={{ color: 'oklch(0.10 0.030 272)' }}>Quick Actions</p>
                      <div className="grid grid-cols-4 gap-2.5">
                        {quickActions.map(({ label, sub, icon: Icon, href, color }) => (
                          <a
                            key={label}
                            href={href}
                            className="quick-action-card gap-2 p-3.5 rounded-xl"
                            style={{
                              background: `rgba(255,255,255,0.65) padding-box, linear-gradient(135deg, ${color}38, ${color}18) border-box`,
                              border: '1px solid transparent',
                              boxShadow: `0 1px 6px ${color}14`,
                            }}
                          >
                            <div
                              className="qa-icon w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${color}22, ${color}0e)`,
                                border: `1px solid ${color}32`,
                                boxShadow: `0 0 14px ${color}24`,
                                color,
                              }}
                            >
                              <Icon className="w-4 h-4" style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
                            </div>
                            <div className="text-center">
                              <p className="text-[11px] font-bold leading-tight" style={{ color: 'oklch(0.13 0.028 270)' }}>{label}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>{sub}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>

                    <p className="text-[10px] text-center" style={{ color: 'oklch(0.62 0.010 265)' }}>
                      {gamepassCount} gamepasses in inventory · {completedOrders.length} completed orders · {formatPHP(totalProfit)} total profit
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div variants={fadeUpVariants} initial="initial" animate="animate" className="h-2" />
        </div>
      </div>
    </div>
  )
}
