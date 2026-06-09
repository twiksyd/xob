'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

const TT = {
  backgroundColor: 'rgba(255,255,255,0.90)',
  border: '1px solid rgba(139,92,246,0.15)',
  borderRadius: '12px',
  color: 'oklch(0.10 0.030 272)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(139,92,246,0.12)',
  padding: '8px 12px',
}

const AXIS = { fontSize: 11, fill: 'oklch(0.55 0.010 265)' }

export function RevenueChart({ data }: { data: { day: string; revenue: number; profit: number }[] }) {
  return (
    <div className="glass-card p-5 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[13px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Revenue & Profit</p>
          <p className="label-caps mt-0.5">Last 7 days</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#e879f9', boxShadow: '0 0 6px rgba(232,121,249,0.6)' }} /> Revenue
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px rgba(34,211,238,0.6)' }} /> Profit
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={data} margin={{ left: -10, right: 4 }}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#e879f9" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#e879f9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
            <filter id="glowRev">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT} formatter={(v) => `₱${v}`} />
          <Area
            type="monotone" dataKey="revenue" stroke="#e879f9" strokeWidth={2.5}
            fill="url(#gRev)" name="Revenue"
            dot={{ fill: '#e879f9', r: 3.5, strokeWidth: 0, filter: 'drop-shadow(0 0 4px rgba(232,121,249,0.8))' }}
            activeDot={{ r: 5, fill: '#e879f9', strokeWidth: 0 }}
          />
          <Area
            type="monotone" dataKey="profit" stroke="#22d3ee" strokeWidth={2.5}
            fill="url(#gPro)" name="Profit"
            dot={{ fill: '#22d3ee', r: 3.5, strokeWidth: 0, filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.8))' }}
            activeDot={{ r: 5, fill: '#22d3ee', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopGamesChart({ data }: { data: { name: string; sales: number }[] }) {
  const COLORS = ['#22d3ee', '#a78bfa', '#e879f9', '#38bdf8', '#34d399']
  return (
    <div className="glass-card p-5">
      <p className="text-[13px] font-bold mb-0.5" style={{ color: 'oklch(0.10 0.030 272)' }}>Top Games by Sales</p>
      <p className="label-caps mb-4">Completed orders</p>
      {data.length === 0 ? (
        <p className="text-[12px] text-center py-8" style={{ color: 'oklch(0.55 0.010 265)' }}>No completed orders yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} layout="vertical" margin={{ left: -8, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(139,92,246,0.06)" />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ ...AXIS, fontSize: 10 }} width={88} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT} />
            <Bar dataKey="sales" radius={[0, 6, 6, 0]} name="Orders">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % 5]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22d3ee', pending: '#94a3b8', delivering: '#f59e0b',
  paid: '#a78bfa', refunded: '#e879f9', cancelled: '#f43f5e',
}

export function OrderStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const mapped = data.map(d => ({ ...d, color: STATUS_COLORS[d.name.toLowerCase()] ?? d.color }))
  const total = mapped.reduce((s, d) => s + d.value, 0)
  const dominant = mapped.length > 0 ? mapped.reduce((a, b) => b.value > a.value ? b : a) : null
  const dominantPct = dominant && total > 0 ? Math.round((dominant.value / total) * 100) : 0

  return (
    <div className="glass-card p-5 h-full">
      <p className="text-[13px] font-bold mb-0.5" style={{ color: 'oklch(0.10 0.030 272)' }}>Order Status</p>
      <p className="label-caps mb-3">All time</p>
      {mapped.length === 0 ? (
        <p className="text-[12px] text-center py-8" style={{ color: 'oklch(0.55 0.010 265)' }}>No orders yet</p>
      ) : (
        <div className="flex items-center gap-5">
          {/* Donut — left */}
          <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <defs>
                  {mapped.map((e, i) => (
                    <filter key={i} id={`glow-${i}`}>
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  ))}
                </defs>
                <Pie
                  data={mapped} cx="50%" cy="50%"
                  innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value"
                  startAngle={90} endAngle={-270}
                  strokeWidth={0}
                >
                  {mapped.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => `${v} orders`} />
              </PieChart>
            </ResponsiveContainer>
            {dominant && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[22px] font-black leading-none" style={{ color: 'oklch(0.10 0.030 272)' }}>{dominantPct}%</span>
                <span className="text-[10px] font-semibold mt-0.5 capitalize" style={{ color: 'oklch(0.55 0.010 265)' }}>{dominant.name}</span>
              </div>
            )}
          </div>

          {/* Legend — right */}
          <div className="flex-1 space-y-2.5">
            {mapped.map((e) => {
              const pct = total > 0 ? Math.round((e.value / total) * 100) : 0
              return (
                <div key={e.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: e.color, boxShadow: `0 0 6px ${e.color}80` }}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide flex-1 truncate"
                    style={{ color: 'oklch(0.25 0.020 265)' }}
                  >
                    {e.name}
                  </span>
                  <span className="text-[11px] font-black" style={{ color: e.color }}>{pct}%</span>
                  <span className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>{e.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
