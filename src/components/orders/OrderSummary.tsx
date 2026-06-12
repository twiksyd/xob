'use client'

import { useMemo } from 'react'
import { ClipboardList, Wallet, TrendingUp, ListChecks } from 'lucide-react'
import StatCard from '@/components/shared/StatCard'
import { OrderWithDetails } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { isActiveOrder } from '@/lib/utils/orders'

interface OrderSummaryProps {
  orders: OrderWithDetails[]
}

export default function OrderSummary({ orders }: OrderSummaryProps) {
  const stats = useMemo(() => {
    const active = orders.filter(isActiveOrder)
    const pendingRevenue = active.reduce((sum, o) => sum + (o.selling_price ?? 0), 0)
    const completed = orders.filter(o => o.status === 'completed')
    const totalProfit = completed.reduce((sum, o) => sum + (o.profit ?? 0), 0)

    return {
      activeCount: active.length,
      pendingRevenue,
      totalProfit,
      pending: orders.filter(o => o.status === 'pending').length,
      paid: orders.filter(o => o.status === 'paid').length,
      completed: completed.length,
      refunded: orders.filter(o => o.status === 'refunded').length,
    }
  }, [orders])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      <StatCard
        title="Active Orders"
        value={`${stats.activeCount}`}
        subtitle="Pending + Paid"
        icon={ClipboardList} iconColor="#22d3ee" accentColor="#22d3ee"
      />
      <StatCard
        title="Pending Revenue"
        value={formatPHP(stats.pendingRevenue)}
        subtitle="From active orders"
        icon={Wallet} iconColor="#f59e0b" accentColor="#f59e0b"
      />
      <StatCard
        title="Total Profit"
        value={formatPHP(stats.totalProfit)}
        subtitle="From completed orders"
        icon={TrendingUp} iconColor="#34d399" accentColor="#34d399"
      />
      <StatCard
        title="Order Status"
        value={`${orders.length} total`}
        subtitle={`${stats.pending} pending · ${stats.paid} paid · ${stats.completed} done · ${stats.refunded} refunded`}
        icon={ListChecks} iconColor="#a78bfa" accentColor="#a78bfa"
      />
    </div>
  )
}
