'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.16 0.025 265 / 0.97)',
  border: '1px solid oklch(0.30 0.03 265)',
  borderRadius: '8px',
  color: 'oklch(0.95 0.01 260)',
  fontSize: '12px',
}

export function RevenueChart({ data }: { data: { day: string; revenue: number; profit: number }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Revenue & Profit</h3>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
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

export function TopGamesChart({ data }: { data: { name: string; sales: number }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Games by Sales</h3>
        <p className="text-xs text-muted-foreground">Completed orders</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No completed orders yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="sales" fill="#22c55e" radius={[0, 4, 4, 0]} name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function OrderStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Order Status</h3>
        <p className="text-xs text-muted-foreground">All time</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No orders yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} opacity={0.85} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} orders`} />
            <Legend formatter={(value) => <span style={{ color: 'oklch(0.72 0.02 265)', fontSize: '11px' }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
