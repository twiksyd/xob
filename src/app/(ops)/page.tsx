'use client'
export const dynamic = 'force-dynamic'

import OrdersWorkspace from '@/components/ops/orders/OrdersWorkspace'

// Orders is the home of the application — there is no separate dashboard.
export default function HomePage() {
  return <OrdersWorkspace />
}
