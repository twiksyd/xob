'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subDays, format, formatDistanceToNow } from 'date-fns'
import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import { motion } from 'framer-motion'
import { springToggle } from '@/lib/motion'
import {
  Coins, TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowUpRight,
  Users, BarChart2, CheckCircle2,
} from 'lucide-react'

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [gamepassCount, setGamepassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [displayProfit, setDisplayProfit] = useState(0)
  const [metricView, setMetricView] = useState<'today' | 'overall'>('overall')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, accountsRes, gpRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, selling_price, profit, robux_amount, created_at, buyer_name, gamepasses(name, games(name)), roblox_accounts(username)')
        .order('created_at', { ascending: false }),
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('gamepasses').select('id'),
    ])
    if (ordersRes.data) setOrders(ordersRes.data)
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (gpRes.data) setGamepassCount(gpRes.data.length)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const profit = orders
      .filter(o => o.status === 'completed')
      .reduce((s: number, o: any) => s + (o.profit ?? 0), 0)
    if (!profit) { setDisplayProfit(0); return }
    const start = Date.now()
    const duration = 1400
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayProfit(profit * eased)
      if (p < 1) requestAnimationFrame(tick)
      else setDisplayProfit(profit)
    }
    requestAnimationFrame(tick)
  }, [orders])

  const completedOrders = orders.filter(o => o.status === 'completed')
  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const activeOrders = orders.filter(o => ['pending', 'paid'].includes(o.status)).length
  const lowRobuxAccounts = accounts.filter(a => (a.current_robux - (a.reserved_robux ?? 0)) < 500)

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const todayOrders = useMemo(() =>
    orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === todayStr),
    [orders, todayStr])
  const todayCompleted = useMemo(() => todayOrders.filter(o => o.status === 'completed'), [todayOrders])

  const viewMetrics = useMemo(() => {
    if (metricView === 'today') {
      return {
        profit: todayCompleted.reduce((s, o) => s + (o.profit ?? 0), 0),
        active: todayOrders.filter(o => ['pending', 'paid'].includes(o.status)).length,
        profitSub: `${todayCompleted.length} completed today`,
        activeSub: `${todayOrders.length} orders today`,
      }
    }
    return {
      profit: totalProfit,
      active: activeOrders,
      profitSub: `${completedOrders.length} completed orders`,
      activeSub: `${orders.length} total orders`,
    }
  }, [metricView, todayCompleted, todayOrders, totalProfit, activeOrders, completedOrders, orders])

  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOrders = completedOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dateStr)
    return {
      day: format(date, 'EEE'),
      revenue: dayOrders.reduce((s, o) => s + (o.selling_price ?? 0), 0),
      profit: dayOrders.reduce((s, o) => s + (o.profit ?? 0), 0),
    }
  })

  const gameCounts: Record<string, number> = {}
  completedOrders.forEach(o => {
    const name = (o.gamepasses as any)?.games?.name ?? 'Unknown'
    gameCounts[name] = (gameCounts[name] ?? 0) + 1
  })
  const topGamesData = Object.entries(gameCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, sales]) => ({ name, sales }))

  const statusCounts: Record<string, number> = {}
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1 })
  const statusData = Object.entries(statusCounts).filter(([, v]) => v > 0).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value, color: '#6b7280',
  }))

  const quickActions = [
    { label: 'Add Gamepass', sub: 'Create new',    icon: Package,    href: '/inventory',    color: '#e879f9' },
    { label: 'New Order',    sub: 'Create order',  icon: ShoppingCart,href: '/orders',       color: '#22d3ee' },
    { label: 'Accounts',     sub: 'View accounts', icon: Users,      href: '/accounts',     color: '#38bdf8' },
    { label: 'Analytics',    sub: 'Detailed stats',icon: BarChart2,  href: '/transactions', color: '#a78bfa' },
  ]

  const activityFeed = orders.slice(0, 6).map(o => ({
    id: o.id,
    icon: o.status === 'completed' ? CheckCircle2 : ShoppingCart,
    iconColor: o.status === 'completed' ? '#22d3ee' : '#38bdf8',
    iconBg: o.status === 'completed' ? 'rgba(34,211,238,0.10)' : 'rgba(56,189,248,0.10)',
    text: o.status === 'completed'
      ? `Order ${o.order_number ?? ''} completed`
      : `Order from ${o.buyer_name ?? '—'}`,
    time: formatDistanceToNow(new Date(o.created_at), { addSuffix: true }),
    amount: o.selling_price ? `₱${o.selling_price}` : null,
  }))

  if (loading) return (
    <div className="flex flex-col h-screen">
      <TopBar title="Dashboard" subtitle="Welcome back — here's your overview" />
      <div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar title="Dashboard" subtitle="Welcome back — here's your overview" />
      <div className="flex-1 overflow-auto">
        <div className="p-5 flex gap-5">

          {/* ── Main ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Stats header + toggle */}
            <div className="flex items-center justify-between mb-1">
              <span className="label-caps">Overview</span>
              <div className="metric-toggle">
                {(['today', 'overall'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setMetricView(view)}
                    className={`metric-toggle-btn ${metricView === view ? 'metric-toggle-btn-active' : 'metric-toggle-btn-inactive'}`}
                  >
                    {metricView === view && (
                      <motion.div layoutId="dash-toggle-bg" className="metric-toggle-bg" transition={springToggle} />
                    )}
                    <span className="relative z-10 capitalize">{view}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3.5">
              <StatCard title="Total Robux"   value={`${totalRobux.toLocaleString()} R$`}                subtitle={`Across ${accounts.length} accounts`}                icon={Coins}       iconColor="#22d3ee" accentColor="#22d3ee" />
              <StatCard title={metricView === 'today' ? "Today's Profit" : "Total Profit"}  value={`₱${viewMetrics.profit.toFixed(2)}`}  subtitle={viewMetrics.profitSub}    icon={TrendingUp}  iconColor="#e879f9" accentColor="#e879f9" animKey={metricView} />
              <StatCard title={metricView === 'today' ? "Today's Orders" : "Active Orders"} value={String(viewMetrics.active)}            subtitle={viewMetrics.activeSub}    icon={ShoppingCart}iconColor="#38bdf8" accentColor="#38bdf8" animKey={metricView} />
              <StatCard title="Gamepasses"    value={String(gamepassCount)}                 subtitle="In your inventory"                                icon={Package}     iconColor="#a78bfa" accentColor="#a78bfa" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-5 gap-3.5">
              <div className="col-span-3"><RevenueChart data={revenueData} /></div>
              <div className="col-span-2"><OrderStatusChart data={statusData} /></div>
            </div>

            {/* Bottom */}
            <div className="grid grid-cols-5 gap-3.5">
              {/* Recent Orders */}
              <div className="col-span-3 glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(15,13,42,0.05)]">
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Recent Orders</p>
                    <p className="label-caps mt-0.5">Latest {Math.min(orders.length, 5)} entries</p>
                  </div>
                  <a href="/orders" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
                    View all <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                {orders.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[13px]" style={{ color: 'oklch(0.55 0.010 265)' }}>No orders yet.</p>
                  </div>
                ) : (
                  <div>
                    {orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center gap-4 px-5 py-3 border-b border-[rgba(15,13,42,0.04)] hover:bg-[rgba(34,211,238,0.025)] transition-colors last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-semibold" style={{ color: 'oklch(0.55 0.010 265)' }}>{order.order_number ?? '—'}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-[13px] font-semibold mt-0.5 truncate" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.buyer_name ?? '—'}</p>
                          <p className="text-[11px] truncate" style={{ color: 'oklch(0.55 0.010 265)' }}>{(order.gamepasses as any)?.games?.name ?? '—'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>{order.selling_price ? `₱${order.selling_price}` : '—'}</p>
                          <p className="text-[11px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right of bottom */}
              <div className="col-span-2 space-y-3.5">
                <TopGamesChart data={topGamesData} />
                {/* Quick Actions */}
                <div
                  className="glass-card p-4"
                  style={{ boxShadow: '0 4px 24px rgba(139,92,246,0.08), 0 1px 4px rgba(15,13,42,0.04)' }}
                >
                  <p className="text-[13px] font-bold mb-3" style={{ color: 'oklch(0.10 0.030 272)' }}>Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2.5">
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
              </div>
            </div>
          </div>

          {/* ── Right sidebar ─────────────────────── */}
          <div className="w-[250px] flex-shrink-0 space-y-3.5">

            {/* Account Balances */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Account Balances</p>
                <a href="/accounts" className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
                  Manage <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              {accounts.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: 'oklch(0.55 0.010 265)' }}>No accounts yet.</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acc) => {
                    const available = acc.current_robux - (acc.reserved_robux ?? 0)
                    const dotColor = available < 500 ? '#f43f5e' : available < 2000 ? '#f59e0b' : '#22d3ee'
                    return (
                      <div key={acc.id} className="flex items-center gap-2.5 py-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}60` }} />
                        <span className="text-[12px] font-medium flex-1 truncate" style={{ color: 'oklch(0.18 0.025 270)' }}>{acc.username}</span>
                        <span className="text-[11px] font-semibold flex-shrink-0 tabular-nums" style={{ color: 'oklch(0.50 0.010 265)' }}>{acc.current_robux.toLocaleString()} R$</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Profit Counter */}
            <div
              className="glass-card p-4"
              style={{ boxShadow: '0 2px 16px rgba(52,211,153,0.08)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps">Total Profit</p>
                <TrendingUp
                  className="w-3.5 h-3.5"
                  style={{ color: '#34d399', filter: 'drop-shadow(0 0 5px rgba(52,211,153,0.55))' }}
                />
              </div>
              <p className="profit-counter-value">₱{displayProfit.toFixed(2)}</p>
              <p className="text-[11px] mt-1" style={{ color: 'oklch(0.55 0.010 265)' }}>
                {completedOrders.length} completed order{completedOrders.length !== 1 ? 's' : ''}
              </p>
              <div className="mt-3 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(52,211,153,0.12)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: totalProfit > 0 ? '100%' : '0%',
                    background: 'linear-gradient(90deg, #34d399, #22d3ee)',
                    boxShadow: '0 0 8px rgba(52,211,153,0.40)',
                    transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
            </div>

            {/* Low Robux Alert */}
            {lowRobuxAccounts.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Low Robux Alert</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'oklch(0.55 0.010 265)' }}>{lowRobuxAccounts.length} account{lowRobuxAccounts.length !== 1 ? 's' : ''} running low</p>
                  </div>
                </div>
                <a href="/accounts" className="flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[11px] font-bold transition-all btn-outline">
                  View Accounts <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Activity Feed */}
            <div className="glass-card p-4">
              <p className="text-[13px] font-bold mb-3" style={{ color: 'oklch(0.10 0.030 272)' }}>Activity Feed</p>
              {activityFeed.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: 'oklch(0.55 0.010 265)' }}>No activity yet.</p>
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
        </div>
      </div>
    </div>
  )
}
