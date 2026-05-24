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
  Plus, Users, BarChart2,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  pending: '#94a3b8',
  delivering: '#f59e0b',
  paid: '#3b82f6',
  refunded: '#ef4444',
  cancelled: '#6b7280',
}

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
      color: STATUS_COLORS[name] ?? '#6b7280',
    }))

  const maxRobux = Math.max(...accounts.map(a => a.current_robux), 1)

  const quickActions = [
    { label: 'New Order', icon: ShoppingCart, href: '/orders', color: '#00d4ff', bg: 'rgba(0,212,255,0.10)' },
    { label: 'Add Gamepass', icon: Package, href: '/inventory', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    { label: 'Add Account', icon: Users, href: '/accounts', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
    { label: 'Reports', icon: BarChart2, href: '/transactions', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
  ]

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
    <div>
      <TopBar title="Dashboard" subtitle="Welcome back — here's your overview" />

      <div className="p-6 space-y-5">
        {/* Low Robux Alert */}
        {lowRobuxAccounts.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200" style={{ boxShadow: '0 0 16px rgba(245,158,11,0.10)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Low Robux Alert</p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                {lowRobuxAccounts.map(a => `${a.username} (${(a.current_robux - a.reserved_robux).toLocaleString()} R$ available)`).join(', ')} — consider topping up.
              </p>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Robux"
            value={`${totalRobux.toLocaleString()} R$`}
            subtitle={`Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
            icon={Coins}
            iconColor="text-amber-500"
            accentColor="oklch(0.78 0.18 90)"
          />
          <StatCard
            title="Total Profit"
            value={`₱${totalProfit.toFixed(2)}`}
            subtitle={`From ${completedOrders.length} completed`}
            icon={TrendingUp}
            iconColor="text-emerald-500"
            accentColor="oklch(0.74 0.22 150)"
          />
          <StatCard
            title="Active Orders"
            value={String(activeOrders)}
            subtitle={`${orders.length} total orders`}
            icon={ShoppingCart}
            iconColor="text-blue-500"
            accentColor="oklch(0.65 0.20 220)"
          />
          <StatCard
            title="Gamepasses"
            value={String(gamepassCount)}
            subtitle="In your inventory"
            icon={Package}
            iconColor="text-purple-500"
            accentColor="oklch(0.68 0.22 290)"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart data={revenueData} />
          </div>
          <OrderStatusChart data={statusData} />
        </div>

        {/* Main 3-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Orders */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
                <p className="text-xs text-muted-foreground">Latest {recentOrders.length} orders</p>
              </div>
              <a href="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            {recentOrders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{order.order_number ?? '—'}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate mt-0.5">{order.buyer_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(order.gamepasses as any)?.games?.name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {order.selling_price ? `₱${order.selling_price}` : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center column: Top Games + Quick Actions */}
          <div className="space-y-4">
            <TopGamesChart data={topGamesData} />

            {/* Quick Actions */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map(({ label, icon: Icon, href, color, bg }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-[1.03]"
                    style={{
                      background: bg,
                      border: `1px solid ${color}25`,
                      boxShadow: `0 2px 12px ${color}12`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: bg, border: `1px solid ${color}35`, color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-semibold text-center" style={{ color: 'oklch(0.25 0.025 270)' }}>
                      {label}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Account Balances + Activity Feed */}
          <div className="space-y-4">
            {/* Account balances */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Account Balances</h3>
                <a href="/accounts" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Manage <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              {accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No accounts yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {accounts.map((acc) => {
                    const pct = Math.round((acc.current_robux / maxRobux) * 100)
                    return (
                      <div key={acc.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-foreground font-medium">{acc.username}</span>
                          <span className="text-muted-foreground">{acc.current_robux.toLocaleString()} R$</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.12)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: acc.current_robux < 500
                                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                : acc.current_robux < 2000
                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                : 'linear-gradient(90deg, #00d4ff, #10b981)',
                              boxShadow: acc.current_robux < 500 ? '0 0 8px rgba(239,68,68,0.5)' : acc.current_robux < 2000 ? '0 0 8px rgba(245,158,11,0.4)' : '0 0 8px rgba(0,212,255,0.5)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Activity Feed</h3>
                <a href="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                  All <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              {orders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 6).map((order) => {
                    const dotColor = STATUS_COLORS[order.status] ?? '#94a3b8'
                    return (
                      <div key={order.id} className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            Order from <span className="font-semibold">{order.buyer_name ?? '—'}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {order.status} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-foreground flex-shrink-0">
                          {order.selling_price ? `₱${order.selling_price}` : '—'}
                        </span>
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
