'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subDays, format, formatDistanceToNow } from 'date-fns'
import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import {
  Coins, TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowUpRight,
  Users, BarChart2, CheckCircle2, Box, UserPlus, TrendingDown,
} from 'lucide-react'

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [gamepassCount, setGamepassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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

  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const completedOrders = orders.filter(o => o.status === 'completed')
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const activeOrders = orders.filter(o => ['pending', 'paid', 'delivering'].includes(o.status)).length
  const lowRobuxAccounts = accounts.filter(a => (a.current_robux - a.reserved_robux) < 500)
  const recentOrders = orders.slice(0, 5)

  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOrders = completedOrders.filter(o =>
      format(new Date(o.created_at), 'yyyy-MM-dd') === dateStr
    )
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
  const topGamesData = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, sales]) => ({ name, sales }))

  const statusCounts: Record<string, number> = {}
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1 })
  const statusData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: '#6b7280',
    }))

  const quickActions = [
    { label: 'Add Gamepass', sub: 'Create new', icon: Package, href: '/inventory', color: '#ec4899', bg: 'rgba(236,72,153,0.10)' },
    { label: 'New Order', sub: 'Create order', icon: ShoppingCart, href: '/orders', color: '#00d4ff', bg: 'rgba(0,212,255,0.10)' },
    { label: 'Manage Accounts', sub: 'View accounts', icon: Users, href: '/accounts', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
    { label: 'View Analytics', sub: 'Detailed stats', icon: BarChart2, href: '/transactions', color: '#00d4ff', bg: 'rgba(0,212,255,0.08)' },
  ]

  const activityFeed = orders.slice(0, 5).map(o => {
    const isCompleted = o.status === 'completed'
    return {
      id: o.id,
      icon: isCompleted ? CheckCircle2 : ShoppingCart,
      iconColor: isCompleted ? '#10b981' : '#3b82f6',
      iconBg: isCompleted ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
      text: isCompleted
        ? `Order ${o.order_number ?? ''} completed`
        : `New order from ${o.buyer_name ?? '—'}`,
      time: formatDistanceToNow(new Date(o.created_at), { addSuffix: true }),
    }
  })

  if (loading) {
    return (
      <div>
        <TopBar title="Dashboard" subtitle="Welcome back — here's your overview" />
        <div className="p-6 flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar title="Dashboard" subtitle="Welcome back — here's your overview" />

      <div className="flex-1 overflow-auto">
        <div className="p-5 flex gap-5">

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                title="Total Robux"
                value={`${totalRobux.toLocaleString()} R$`}
                subtitle={`Across ${accounts.length} accounts`}
                icon={Coins}
                iconColor="text-cyan-500"
                accentColor="#00d4ff"
              />
              <StatCard
                title="Total Profit"
                value={`₱${totalProfit.toFixed(2)}`}
                subtitle={`From ${completedOrders.length} completed orders`}
                icon={TrendingUp}
                iconColor="text-pink-500"
                accentColor="#ec4899"
              />
              <StatCard
                title="Active Orders"
                value={String(activeOrders)}
                subtitle={`${orders.length} total orders`}
                icon={ShoppingCart}
                iconColor="text-blue-500"
                accentColor="#3b82f6"
              />
              <StatCard
                title="Gamepasses"
                value={String(gamepassCount)}
                subtitle="In your inventory"
                icon={Package}
                iconColor="text-purple-500"
                accentColor="#8b5cf6"
              />
            </div>

            {/* Revenue chart + Order Status side by side */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <RevenueChart data={revenueData} />
              </div>
              <div className="col-span-2">
                <OrderStatusChart data={statusData} />
              </div>
            </div>

            {/* Recent Orders + Top Games + Quick Actions */}
            <div className="grid grid-cols-5 gap-4">
              {/* Recent Orders */}
              <div className="col-span-3 glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>Recent Orders</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Latest {recentOrders.length} orders</p>
                  </div>
                  <a href="/orders" className="text-xs font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: '#7c3aed' }}>
                    View All <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm" style={{ color: '#9ca3af' }}>No orders yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-purple-50/40 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold" style={{ color: '#9ca3af' }}>{order.order_number ?? '—'}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: '#1e1b4b' }}>{order.buyer_name ?? '—'}</p>
                          <p className="text-xs truncate" style={{ color: '#9ca3af' }}>
                            {(order.gamepasses as any)?.games?.name ?? '—'} · {order.selling_price ? `Rp ${(order.selling_price * 1000).toLocaleString()}` : '—'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: '#1e1b4b' }}>
                            {order.selling_price ? `P${order.selling_price}` : '—'}
                          </p>
                          <p className="text-xs" style={{ color: '#9ca3af' }}>
                            {order.robux_amount ? `${order.robux_amount.toLocaleString()} R$` : '—'}
                          </p>
                          <p className="text-xs" style={{ color: '#9ca3af' }}>
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Games + Quick Actions */}
              <div className="col-span-2 space-y-4">
                <TopGamesChart data={topGamesData} />

                {/* Quick Actions */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-black uppercase tracking-wide mb-3" style={{ color: '#1e1b4b' }}>Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {quickActions.map(({ label, sub, icon: Icon, href, color, bg }) => (
                      <a
                        key={label}
                        href={href}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-[1.03]"
                        style={{ background: bg, border: `1px solid ${color}20` }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: `${color}18`, color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-bold leading-tight" style={{ color: '#1e1b4b' }}>{label}</p>
                          <p className="text-[10px]" style={{ color: '#9ca3af' }}>{sub}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-[260px] flex-shrink-0 space-y-4">

            {/* Account Balances */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: '#1e1b4b' }}>Account Balances</h3>
                <a href="/accounts" className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: '#7c3aed' }}>
                  Manage <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              {accounts.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#9ca3af' }}>No accounts yet.</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acc) => {
                    const available = acc.current_robux - (acc.reserved_robux ?? 0)
                    const isLow = available < 500
                    const dotColor = isLow ? '#ef4444' : available < 2000 ? '#f59e0b' : '#8b5cf6'
                    return (
                      <div key={acc.id} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}80` }}
                        />
                        <span className="text-xs font-medium flex-1 truncate" style={{ color: '#374151' }}>
                          {acc.username}
                        </span>
                        <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#6b7280' }}>
                          {acc.current_robux.toLocaleString()} R$
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Low Robux Alert */}
            {lowRobuxAccounts.length > 0 && (
              <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.12)' }}
                  >
                    <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>Low Robux Alert</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>
                      {lowRobuxAccounts.length} account{lowRobuxAccounts.length !== 1 ? 's' : ''} running low!
                    </p>
                  </div>
                </div>
                <a
                  href="/accounts"
                  className="mt-3 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all hover:opacity-80"
                  style={{
                    background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #3b82f6, #8b5cf6) border-box',
                    border: '1px solid transparent',
                    color: '#3b82f6',
                  }}
                >
                  View Accounts <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Activity Feed */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#1e1b4b' }}>Activity Feed</h3>
              {activityFeed.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#9ca3af' }}>No activity yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {activityFeed.map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: item.iconBg }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium leading-snug truncate" style={{ color: '#374151' }}>
                            {item.text}
                          </p>
                          <p className="text-[10px]" style={{ color: '#9ca3af' }}>{item.time}</p>
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
