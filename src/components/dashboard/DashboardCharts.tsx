'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.97)',
  border: '1px solid rgba(139, 92, 246, 0.20)',
  borderRadius: '12px',
  color: '#1e1b4b',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
}

export function RevenueChart({ data }: { data: { day: string; revenue: number; profit: number }[] }) {
  return (
    <div className="glass-card p-5 h-full">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>Revenue & Profit</h3>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Last 7 days</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ec4899' }} />
            <span style={{ color: '#6b7280' }}>Revenue</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />
            <span style={{ color: '#6b7280' }}>Profit</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₱${v}`} />
          <Area type="monotone" dataKey="revenue" stroke="#ec4899" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" dot={{ fill: '#ec4899', r: 3 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} fill="url(#colorProfit)" name="Profit" dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopGamesChart({ data }: { data: { name: string; sales: number }[] }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>Top Games by Sales</h3>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Completed orders</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: '#9ca3af' }}>No completed orders yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(139,92,246,0.08)" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} width={90} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="sales" radius={[0, 6, 6, 0]} name="Orders">
              {data.map((_, i) => (
                <Cell key={i} fill={['#ec4899', '#8b5cf6', '#3b82f6', '#00d4ff', '#10b981'][i % 5]} />
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
  pending:    '#f59e0b',
  delivering: '#f59e0b',
  paid:       '#3b82f6',
  refunded:   '#8b5cf6',
  cancelled:  '#ef4444',
}

export function OrderStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const mapped = data.map(d => ({
    ...d,
    color: STATUS_COLORS[d.name.toLowerCase()] ?? d.color,
  }))
  const total = mapped.reduce((s, d) => s + d.value, 0)
  const dominant = mapped.length > 0
    ? mapped.reduce((a, b) => b.value > a.value ? b : a)
    : null
  const dominantPct = dominant && total > 0 ? Math.round((dominant.value / total) * 100) : 0

  return (
    <div className="glass-card p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>Order Status</h3>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>All time</p>
      </div>
      {mapped.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: '#9ca3af' }}>No orders yet</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Donut with center text */}
          <div className="relative" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={mapped}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {mapped.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} orders`} />
              </PieChart>
            </ResponsiveContainer>
            {dominant && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black leading-none" style={{ color: '#1e1b4b' }}>
                  {dominantPct}%
                </span>
                <span className="text-[11px] font-semibold mt-0.5 capitalize" style={{ color: '#9ca3af' }}>
                  {dominant.name}
                </span>
              </div>
            )}
          </div>

          {/* Breakdown list */}
          <div className="w-full space-y-1.5">
            {mapped.map((entry) => {
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
              return (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}60` }}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wide flex-1 truncate" style={{ color: '#374151' }}>
                    {entry.name}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: '#9ca3af' }}>{pct}%</span>
                  <span className="text-[11px]" style={{ color: '#9ca3af' }}>{entry.value} orders</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
