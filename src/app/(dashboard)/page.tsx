import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { RevenueChart, TopGamesChart, OrderStatusChart } from '@/components/dashboard/DashboardCharts'
import {
  Coins, TrendingUp, ShoppingCart, Users,
  AlertTriangle, Gamepad2, Package, ArrowUpRight
} from 'lucide-react'

// Mock data — will be replaced with Supabase queries
const recentOrders = [
  { id: 'ORD-0024', buyer: 'JohnDoe123', game: 'EVADE', gamepass: 'VIP Pass', robux: 300, price: 95, status: 'completed', time: '5m ago' },
  { id: 'ORD-0023', buyer: 'Player456', game: 'Anime Vanguards', gamepass: 'Premium Pass', robux: 149, price: 50, status: 'delivering', time: '18m ago' },
  { id: 'ORD-0022', buyer: 'GamerXYZ', game: 'Drag Simulator', gamepass: 'Police Pass', robux: 499, price: 165, status: 'paid', time: '42m ago' },
  { id: 'ORD-0021', buyer: 'ProGamer99', game: 'Catch & Tame', gamepass: 'Shiny Hunter', robux: 359, price: 115, status: 'completed', time: '1h ago' },
  { id: 'ORD-0020', buyer: 'Roblox_Fan', game: 'Battlegrounds', gamepass: 'VIP Server', robux: 99, price: 35, status: 'pending', time: '2h ago' },
]

const lowRobuxAccounts = [
  { username: 'SellerAcc2', current_robux: 340, reserved: 200 },
  { username: 'SellerAcc4', current_robux: 180, reserved: 0 },
]

export default function DashboardPage() {
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
                {lowRobuxAccounts.map(a => `${a.username} (${a.current_robux.toLocaleString()} R$)`).join(', ')} — consider topping up.
              </p>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Robux"
            value="42,380 R$"
            subtitle="Across 6 accounts"
            icon={Coins}
            iconColor="text-amber-400"
            trend={{ value: '+2,400 this week', positive: true }}
          />
          <StatCard
            title="Total Profit"
            value="₱8,724"
            subtitle="This month"
            icon={TrendingUp}
            iconColor="text-emerald-400"
            trend={{ value: '+₱1,230 vs last month', positive: true }}
          />
          <StatCard
            title="Active Orders"
            value="12"
            subtitle="3 need action"
            icon={ShoppingCart}
            iconColor="text-blue-400"
            trend={{ value: '5 completed today', positive: true }}
          />
          <StatCard
            title="Gamepasses"
            value="94"
            subtitle="Across 13 games"
            icon={Package}
            iconColor="text-purple-400"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <OrderStatusChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Orders */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
                <p className="text-xs text-muted-foreground">Latest transactions</p>
              </div>
              <a href="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-border/30">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-0.5">{order.buyer}</p>
                    <p className="text-xs text-muted-foreground">{order.game} · {order.gamepass}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">₱{order.price}</p>
                    <p className="text-xs text-muted-foreground">{order.robux.toLocaleString()} R$</p>
                    <p className="text-xs text-muted-foreground">{order.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Games + Account Quick View */}
          <div className="space-y-4">
            <TopGamesChart />

            {/* Account balances summary */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Account Balances</h3>
                <a href="/accounts" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Manage <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: 'SellerAcc1', robux: 12400, pct: 82 },
                  { name: 'SellerAcc2', robux: 3340, pct: 22 },
                  { name: 'SellerAcc3', robux: 18200, pct: 95 },
                  { name: 'SellerAcc4', robux: 1800, pct: 12 },
                ].map((acc) => (
                  <div key={acc.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{acc.name}</span>
                      <span className="text-muted-foreground">{acc.robux.toLocaleString()} R$</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${acc.pct}%`,
                          background: acc.pct < 20 ? '#ef4444' : acc.pct < 40 ? '#f59e0b' : '#22c55e'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
