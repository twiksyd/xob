'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subDays, format, formatDistanceToNow } from 'date-fns'
import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import { Coins, TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowUpRight } from 'lucide-react'

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

  // Stats
  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const completedOrders = orders.filter(o => o.status === 'completed')
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const activeOrders = orders.filter(o => ['pending', 'paid', 'delivering'].includes(o.status)).length
  const lowRobuxAccounts = accounts.filter(a => (a.current_robux - a.reserved_robux) < 500)

  // Recent 5 orders
  const recentOrders = orders.slice(0, 5)

  // 7-day revenue chart
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

  // Top games by completed order count
  const gameCounts: Record<string, number> = {}
  completedOrders.forEach(o => {
    const name = (o.gamepasses as any)?.games?.name ?? 'Unknown'
    gameCounts[name] = (gameCounts[name] ?? 0) + 1
  })
  const topGamesData = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, sales]) => ({ name, sales }))

  // Order status breakdown
  const statusCounts: Record<string, number> = {}
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1 })
  const statusData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] ?? '#6b7280',
    }))

  // Account balances for progress bars
  const maxRobux = Math.max(...accounts.map(a => a.current_robux), 1)

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

      <div className="p-6 space-y-6">
        {/* Low Robux Alert */}
        {lowRobuxAccounts.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">Low Robux Alert</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
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
            iconColor="text-amber-400"
            accentColor="oklch(0.78 0.18 90)"
          />
          <StatCard
            title="Total Profit"
            value={`₱${totalProfit.toFixed(2)}`}
            subtitle={`From ${completedOrders.length} completed orders`}
            icon={TrendingUp}
            iconColor="text-emerald-400"
            accentColor="oklch(0.74 0.22 150)"
          />
          <StatCard
            title="Active Orders"
            value={String(activeOrders)}
            subtitle={`${orders.length} total orders`}
            icon={ShoppingCart}
            iconColor="text-blue-400"
            accentColor="oklch(0.65 0.20 220)"
          />
          <StatCard
            title="Gamepasses"
            value={String(gamepassCount)}
            subtitle="In your inventory"
            icon={Package}
            iconColor="text-purple-400"
            accentColor="oklch(0.68 0.22 290)"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart data={revenueData} />
          </div>
          <OrderStatusChart data={statusData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Orders */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
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
                  <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{order.order_number ?? '—'}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate mt-0.5">{order.buyer_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {(order.gamepasses as any)?.games?.name ?? '—'} · {(order.gamepasses as any)?.name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {order.selling_price ? `₱${order.selling_price}` : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.robux_amount ? `${order.robux_amount.toLocaleString()} R$` : '—'}
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

          {/* Right column */}
          <div className="space-y-4">
            <TopGamesChart data={topGamesData} />

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
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: acc.current_robux < 500 ? '#ef4444' : acc.current_robux < 2000 ? '#f59e0b' : '#22c55e'
                            }}
                          />
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
