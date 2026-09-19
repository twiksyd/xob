'use client'
export const dynamic = 'force-dynamic'

import OrdersWorkspace from '@/components/ops/orders/OrdersWorkspace'

// `/orders` stays live alongside `/` so older bookmarks and links keep working.
export default function OrdersPage() {
  return <OrdersWorkspace />
}
