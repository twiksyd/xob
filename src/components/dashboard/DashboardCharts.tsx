'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.97)',
  border: '1px solid rgba(0, 212, 255, 0.28)',
  borderRadius: '12px',
  color: 'oklch(0.13 0.030 270)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 0 16px rgba(0,212,255,0.08)',
}

export function RevenueChart({ data }: { data: { day: string; revenue: number; profit: number }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'oklch(0.13 0.030 270)' }}>Revenue & Profit</h3>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(0.52 0.018 265)' }}>Last 7 days</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₱${v}`} />
          <Area type="monotone" dataKey="revenue" stroke="#00d4ff" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
          <Area type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorProfit)" name="Profit" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopGamesChart({ data }: { data: { name: string; sales: number }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'oklch(0.13 0.030 270)' }}>Top Games by Sales</h3>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(0.52 0.018 265)' }}>Completed orders</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: 'oklch(0.52 0.018 265)' }}>No completed orders yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="sales" radius={[0, 6, 6, 0]} name="Orders">
              {data.map((_, i) => (
                <Cell key={i} fill={['#00d4ff', '#8b5cf6', '#ff0066', '#3b82f6', '#10b981'][i % 5]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  completed:  '#00d4ff',
  pending:    '#94a3b8',
  delivering: '#f59e0b',
  paid:       '#3b82f6',
  refunded:   '#8b5cf6',
  cancelled:  '#ff0066',
}

export function OrderStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const mapped = data.map(d => ({
    ...d,
    color: STATUS_COLORS[d.name.toLowerCase()] ?? d.color,
  }))
  const total = mapped.reduce((s, d) => s + d.value, 0)

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'oklch(0.13 0.030 270)' }}>Order Status</h3>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(0.52 0.018 265)' }}>All time</p>
      </div>
      {mapped.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: 'oklch(0.52 0.018 265)' }}>No orders yet</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={mapped} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                  {mapped.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.90} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} orders`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            {mapped.map((entry) => {
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
              return (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}80` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: 'oklch(0.25 0.025 270)' }}>
                        {entry.name}
                      </span>
                      <span className="text-[11px] font-bold flex-shrink-0" style={{ color: entry.color }}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'oklch(0.52 0.018 265)' }}>{entry.value} orders</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
