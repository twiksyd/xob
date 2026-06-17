'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import OrderSummary from '@/components/orders/OrderSummary'
import OrderForm, { orderFormSchema, OrderFormData, GamepassWithGame } from '@/components/orders/OrderForm'
import OrderActivityPanel from '@/components/orders/OrderActivityPanel'
import { useOrderCart } from '@/hooks/useOrderCart'
import { RobloxAccount, OrderWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { calculateOrderTotals } from '@/lib/utils/pricing'

const PAGE_SIZE = 50

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]                   = useState<OrderWithDetails[]>([])
  const [hasMore, setHasMore]                 = useState(false)
  const [loadingMore, setLoadingMore]         = useState(false)
  const [gamepasses, setGamepasses]           = useState<GamepassWithGame[]>([])
  const [accounts, setAccounts]               = useState<RobloxAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [statusChanging, setStatusChanging]   = useState<string | null>(null)
  const [editOrder, setEditOrder]             = useState<OrderWithDetails | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [justCreated, setJustCreated]         = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const cart = useOrderCart(gamepasses)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      buyer_name: '', buyer_roblox_username: '',
      roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '',
    },
  })

  const accountId  = watch('roblox_account_id')
  const isEditMode = editOrder !== null

  // Account-level cost basis: use the selected account's rate if set
  const accountRate = useMemo(() => {
    if (!accountId) return 0
    return accounts.find(a => a.id === accountId)?.robux_cost_rate ?? 0
  }, [accountId, accounts])

  const totals = useMemo(
    () => calculateOrderTotals(cart.items, accountRate),
    [cart.items, accountRate]
  )

  // ── Populate form when editing ──────────────────────────────────────────────
  useEffect(() => {
    if (editOrder) {
      reset({
        buyer_name:            editOrder.buyer_name ?? '',
        buyer_roblox_username: editOrder.buyer_roblox_username ?? '',
        roblox_account_id:     editOrder.roblox_account_id ?? '',
        payment_method:        editOrder.payment_method,
        status:                (editOrder.status === 'delivering' ? 'paid' : editOrder.status) as OrderFormData['status'],
        notes:                 editOrder.notes ?? '',
      })
      const oi = editOrder.order_items
      if (oi && oi.length > 0) {
        cart.setItems(oi.map(item => ({
          _key: item.id,
          gamepass_id:    item.gamepass_id ?? '',
          gamepass_name:  item.gamepass_name,
          game_name:      item.game_name,
          robux_amount:   item.robux_amount,
          selling_price:  item.selling_price,
          cost:           item.cost,
          profit:         item.profit,
        })))
      } else {
        cart.setItems([{
          _key:           'legacy',
          gamepass_id:    editOrder.gamepass_id ?? '',
          gamepass_name:  '',
          game_name:      null,
          robux_amount:   editOrder.robux_amount ?? 0,
          selling_price:  editOrder.selling_price ?? 0,
          cost:           editOrder.cost ?? 0,
          profit:         editOrder.profit ?? 0,
        }])
      }
    } else {
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      cart.setItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrder, reset])

  function cancelEdit() { setEditOrder(null) }

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordRes, gpRes, accRes] = await Promise.all([
      supabase.from('orders')
        .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.from('gamepasses').select('*, games(*)').order('is_active', { ascending: false }).order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
    ])
    if (ordRes.data) {
      setOrders(ordRes.data.slice(0, PAGE_SIZE) as OrderWithDetails[])
      setHasMore(ordRes.data.length > PAGE_SIZE)
    }
    if (gpRes.data)  setGamepasses(gpRes.data as GamepassWithGame[])
    if (accRes.data) setAccounts(accRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    const cursor = orders[orders.length - 1]?.created_at
    if (!cursor) { setLoadingMore(false); return }
    const { data } = await supabase
      .from('orders')
      .select('*, gamepasses(*, games(*)), roblox_accounts(*), order_items(*)')
      .order('created_at', { ascending: false })
      .lt('created_at', cursor)
      .limit(PAGE_SIZE + 1)
    if (data) {
      setOrders(prev => [...prev, ...(data.slice(0, PAGE_SIZE) as OrderWithDetails[])])
      setHasMore(data.length > PAGE_SIZE)
    }
    setLoadingMore(false)
  }, [supabase, hasMore, loadingMore, orders])

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: OrderFormData) {
    if (cart.validItems.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const rateUsed = accounts.find(a => a.id === data.roblox_account_id)?.robux_cost_rate ?? 0
    const { totalRobux: tRobux, totalPrice: tPrice, totalCost: tCost, totalProfit: tProfit } = calculateOrderTotals(cart.validItems, rateUsed)
    const first = cart.validItems[0]
    const gpNames = cart.validItems.map(i => i.gamepass_name).filter(Boolean).join(', ')

    if (editOrder) {
      const prevStatus = editOrder.status
      const newStatus  = data.status

      // 1. Persist field edits — status is handled separately by transition_order below,
      // so the order's status in the DB still reflects prevStatus at that point.
      await supabase.from('orders').update({
        buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        account_rate_used: rateUsed || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editOrder.id)
      await supabase.from('order_items').delete().eq('order_id', editOrder.id)
      if (cart.validItems.length > 0) {
        await supabase.from('order_items').insert(cart.validItems.map(item => ({
          order_id: editOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }

      // 2. Reservation sync — keep robux_reservations / reserved_robux aligned with the
      // (possibly changed) account/amount whenever the order is or returns to pending/paid
      if (['pending', 'paid'].includes(newStatus) && data.roblox_account_id && tRobux > 0) {
        await supabase.rpc('reserve_order_robux', {
          p_order_id:       editOrder.id,
          p_account_id:     data.roblox_account_id,
          p_robux_amount:   tRobux,
          p_gamepass_names: gpNames,
        })
      }

      // 3. Status transition — transition_order is the single financial engine for
      // every status change (sale, refund/cancel, savings, reservations, ledger rows)
      if (newStatus !== prevStatus) {
        const { error } = await supabase.rpc('transition_order', { p_order_id: editOrder.id, p_new_status: newStatus })
        if (error) alert(`Could not update order status: ${error.message}`)
      }

      setEditOrder(null)
    } else {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: user.id, buyer_name: data.buyer_name, buyer_roblox_username: data.buyer_roblox_username,
        roblox_account_id: data.roblox_account_id, payment_method: data.payment_method,
        status: 'pending', notes: data.notes, gamepass_id: first?.gamepass_id || null,
        robux_amount: tRobux, selling_price: tPrice, cost: tCost, profit: tProfit,
        account_rate_used: rateUsed || null,
      }).select().single()
      if (newOrder && cart.validItems.length > 0) {
        await supabase.from('order_items').insert(cart.validItems.map(item => ({
          order_id: newOrder.id, gamepass_id: item.gamepass_id || null,
          gamepass_name: item.gamepass_name, game_name: item.game_name,
          robux_amount: item.robux_amount, selling_price: item.selling_price, cost: item.cost, profit: item.profit,
        })))
      }
      // Create reservation for new order (transition_order will release it if status goes beyond pending/paid)
      if (newOrder && data.roblox_account_id && tRobux > 0) {
        await supabase.rpc('reserve_order_robux', {
          p_order_id:       newOrder.id,
          p_account_id:     data.roblox_account_id,
          p_robux_amount:   tRobux,
          p_gamepass_names: gpNames,
        })
      }
      if (newOrder && data.status !== 'pending') {
        await supabase.rpc('transition_order', { p_order_id: newOrder.id, p_new_status: data.status })
      }
      setJustCreated(true)
      reset({ buyer_name: '', buyer_roblox_username: '', roblox_account_id: '', payment_method: 'GCash', status: 'pending', notes: '' })
      cart.setItems([])
      setTimeout(() => setJustCreated(false), 1800)
    }

    setSaving(false)
    fetchData()
  }

  // ── Status / delete ─────────────────────────────────────────────────────────
  async function handleStatusChange(order: OrderWithDetails, newStatus: string) {
    if (order.status === newStatus || statusChanging === order.id) return
    setStatusChanging(order.id)
    const { error } = await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: newStatus })
    if (error) alert(`Could not update order status: ${error.message}`)
    setStatusChanging(null)
    fetchData()
  }

  async function handleDelete(order: OrderWithDetails) {
    if (!confirm('Delete this order?')) return
    const { error } = await supabase.rpc('delete_order', { p_order_id: order.id })
    if (error) alert(`Could not delete order: ${error.message}`)
    fetchData()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:h-full">
      <TopBar
        title="Order Workspace"
      />
      <PageHero
        badge="Operations"
        title="Order Queue"
        subtitle="Fulfillment pipeline, buyer management, and real-time delivery status."
        gradient="linear-gradient(135deg, #22d3ee 0%, #38bdf8 60%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="px-4 lg:px-5 pt-4 space-y-2">
        <span className="label-caps">Order Summary</span>
        <OrderSummary orders={orders} />
      </div>

      <div className="flex flex-col lg:flex-row gap-5 p-4 lg:p-5 pt-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden">

        {/* ── LEFT: Create / Edit panel (≈70%) ──────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <OrderForm
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            onFormSubmit={handleSubmit(onSubmit)}
            isEditMode={isEditMode}
            editOrder={editOrder}
            onCancelEdit={cancelEdit}
            gamepasses={gamepasses}
            accounts={accounts}
            cartGroups={cart.cartGroups}
            cartCounts={cart.cartCounts}
            validItemsCount={cart.validItems.length}
            onAddToCart={cart.addToCart}
            onRemoveFromCart={cart.removeFromCart}
            onClearCart={cart.clearCart}
            totals={totals}
            accountRate={accountRate}
            saving={saving}
            justCreated={justCreated}
          />
        </div>

        {/* ── RIGHT: Activity panel (≈30%) ──────────────────────────────────── */}
        <OrderActivityPanel
          orders={orders}
          loading={loading}
          statusChanging={statusChanging}
          hasMore={hasMore}
          loadingMore={loadingMore}
          historyExpanded={historyExpanded}
          onToggleHistory={() => setHistoryExpanded(p => !p)}
          onEdit={setEditOrder}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onLoadMore={loadMore}
        />

      </div>
    </div>
  )
}
