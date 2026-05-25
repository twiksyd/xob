'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

const TT = {
  backgroundColor: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(15,13,42,0.07)',
  borderRadius: '12px',
  color: 'oklch(0.10 0.030 272)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(15,13,42,0.10)',
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
            <span className="w-2 h-2 rounded-full" style={{ background: '#e879f9' }} /> Revenue
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'oklch(0.50 0.012 265)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} /> Profit
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={data} margin={{ left: -10, right: 4 }}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#e879f9" stopOpacity={0.14} />
              <stop offset="95%" stopColor="#e879f9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.14} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,13,42,0.05)" vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT} formatter={(v) => `₱${v}`} />
          <Area type="monotone" dataKey="revenue" stroke="#e879f9" strokeWidth={1.5} fill="url(#gRev)" name="Revenue" dot={{ fill: '#e879f9', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
          <Area type="monotone" dataKey="profit"  stroke="#38bdf8" strokeWidth={1.5} fill="url(#gPro)" name="Profit"  dot={{ fill: '#38bdf8', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(15,13,42,0.05)" />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ ...AXIS, fontSize: 10 }} width={88} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT} />
            <Bar dataKey="sales" radius={[0, 5, 5, 0]} name="Orders">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22d3ee', pending: '#94a3b8', delivering: '#f59e0b',
  paid: '#38bdf8', refunded: '#a78bfa', cancelled: '#f43f5e',
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
        <div className="flex flex-col items-center gap-4">
          <div className="relative" style={{ width: 170, height: 170 }}>
            <ResponsiveContainer width={170} height={170}>
              <PieChart>
                <Pie data={mapped} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                  {mapped.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => `${v} orders`} />
              </PieChart>
            </ResponsiveContainer>
            {dominant && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[22px] font-black leading-none" style={{ color: 'oklch(0.10 0.030 272)' }}>{dominantPct}%</span>
                <span className="text-[11px] font-medium mt-0.5 capitalize" style={{ color: 'oklch(0.55 0.010 265)' }}>{dominant.name}</span>
              </div>
            )}
          </div>
          <div className="w-full space-y-1.5">
            {mapped.map((e) => {
              const pct = total > 0 ? Math.round((e.value / total) * 100) : 0
              return (
                <div key={e.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span className="font-semibold uppercase tracking-wide flex-1 truncate" style={{ color: 'oklch(0.25 0.020 265)' }}>{e.name}</span>
                  <span className="font-bold" style={{ color: e.color }}>{pct}%</span>
                  <span style={{ color: 'oklch(0.55 0.010 265)' }}>{e.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
