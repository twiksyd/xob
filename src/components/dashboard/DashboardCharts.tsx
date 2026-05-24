'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

const salesData = [
  { day: 'Mon', revenue: 820, profit: 312 },
  { day: 'Tue', revenue: 1140, profit: 430 },
  { day: 'Wed', revenue: 960, profit: 365 },
  { day: 'Thu', revenue: 1380, profit: 520 },
  { day: 'Fri', revenue: 1620, profit: 615 },
  { day: 'Sat', revenue: 2100, profit: 798 },
  { day: 'Sun', revenue: 1760, profit: 670 },
]

const gameData = [
  { name: 'EVADE', sales: 34 },
  { name: 'Anime Vanguards', sales: 28 },
  { name: 'Catch & Tame', sales: 21 },
  { name: 'Drag Simulator', sales: 18 },
  { name: 'Battlegrounds', sales: 15 },
]

const statusData = [
  { name: 'Completed', value: 68, color: '#22c55e' },
  { name: 'Pending', value: 18, color: '#94a3b8' },
  { name: 'Delivering', value: 10, color: '#f59e0b' },
  { name: 'Refunded', value: 4, color: '#ef4444' },
]

const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.14 0.02 265 / 0.95)',
  border: '1px solid oklch(0.25 0.025 265)',
  borderRadius: '8px',
  color: 'oklch(0.93 0.01 260)',
  fontSize: '12px',
}

export function RevenueChart() {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Revenue & Profit</h3>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={salesData}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₱${v}`} />
          <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
          <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} fill="url(#colorProfit)" name="Profit" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopGamesChart() {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Games by Sales</h3>
        <p className="text-xs text-muted-foreground">Total orders</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={gameData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="sales" fill="#22c55e" radius={[0, 4, 4, 0]} name="Orders" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OrderStatusChart() {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Order Status</h3>
        <p className="text-xs text-muted-foreground">All time</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {statusData.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.85} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
          <Legend
            formatter={(value) => <span style={{ color: 'oklch(0.72 0.02 265)', fontSize: '11px' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
