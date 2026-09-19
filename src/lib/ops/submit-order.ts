import type { SupabaseClient } from '@supabase/supabase-js'
import type { LineItem, RobloxAccount } from '@/lib/types/database'
import { calculateOrderTotals } from '@/lib/utils/pricing'

/* Creating and editing an XOB-native order.
 *
 * Ported unchanged from the previous order workspace. The sequence matters:
 *
 *   1. write the orders header (and order_items children)
 *   2. reserve_order_robux — reserves the EFFECTIVE amount, which is what a
 *      Plus account actually spends, never the nominal gamepass amount
 *   3. only then move the status, through claim + complete_logical_order for
 *      a completed order, or transition_order for anything else
 *
 * Reserving before the status moves is what keeps reserved_robux and the
 * reservations ledger in step. effective_robux_amount is stored on the row so
 * every later RPC reserves and deducts the same figure this order was priced
 * against.
 */

export interface ManualOrderInput {
  buyerName: string
  buyerRobloxUsername: string
  accountId: string
  paymentMethod: 'GCash' | 'Maya' | 'Bank' | 'Cash' | 'Other'
  status: 'pending' | 'paid' | 'completed'
  notes: string
}

export interface SubmitContext {
  supabase: SupabaseClient
  accounts: RobloxAccount[]
  items: LineItem[]
  input: ManualOrderInput
  /** Existing orders.id when editing; null when creating. */
  editOrderId: string | null
}

export interface SubmitOutcome {
  orderId: string
  created: boolean
  /** Non-fatal problems: the order exists, but a follow-up step failed. */
  warnings: string[]
}

export async function submitManualOrder({
  supabase,
  accounts,
  items,
  input,
  editOrderId,
}: SubmitContext): Promise<SubmitOutcome> {
  const validItems = items.filter(i => i.gamepass_id)
  if (validItems.length === 0) throw new Error('Add at least one gamepass to the order.')
  if (!input.accountId) throw new Error('Choose the account that will fulfill this order.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const account = accounts.find(a => a.id === input.accountId)
  const rateUsed = account?.robux_cost_rate ?? 0
  const totals = calculateOrderTotals(validItems, rateUsed, account?.is_plus_account ?? false)
  const effectiveRobux = Math.round(totals.effectiveRobux)
  const gamepassNames = validItems.map(i => i.gamepass_name).filter(Boolean).join(', ')
  const first = validItems[0]
  const warnings: string[] = []

  const shared = {
    buyer_name: input.buyerName || null,
    buyer_roblox_username: input.buyerRobloxUsername || null,
    roblox_account_id: input.accountId,
    payment_method: input.paymentMethod,
    notes: input.notes || null,
    gamepass_id: first?.gamepass_id || null,
    robux_amount: totals.totalRobux,
    selling_price: totals.totalPrice,
    cost: totals.totalCost,
    profit: totals.totalProfit,
    account_rate_used: rateUsed || null,
    effective_robux_amount: totals.totalRobux > 0 ? effectiveRobux : null,
  }

  const itemRows = (orderId: string) =>
    validItems.map(item => ({
      order_id: orderId,
      gamepass_id: item.gamepass_id || null,
      gamepass_name: item.gamepass_name,
      game_name: item.game_name,
      robux_amount: item.robux_amount,
      selling_price: item.selling_price,
      cost: item.cost,
      profit: item.profit,
    }))

  /* ── Edit ─────────────────────────────────────────────────────────────── */
  if (editOrderId) {
    const { data: existing, error: readError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', editOrderId)
      .single()
    if (readError) throw new Error(`Could not read the order: ${readError.message}`)
    const previousStatus = (existing as { status: string } | null)?.status

    const { error: updateError } = await supabase
      .from('orders')
      .update({ ...shared, updated_at: new Date().toISOString() })
      .eq('id', editOrderId)
    if (updateError) throw new Error(`Could not update order: ${updateError.message}`)

    await supabase.from('order_items').delete().eq('order_id', editOrderId)
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows(editOrderId))
    if (itemsError) warnings.push(`Line items may be out of date: ${itemsError.message}`)

    if (['pending', 'paid'].includes(input.status) && totals.totalRobux > 0) {
      const { error } = await supabase.rpc('reserve_order_robux', {
        p_order_id: editOrderId,
        p_account_id: input.accountId,
        p_robux_amount: effectiveRobux,
        p_gamepass_names: gamepassNames,
      })
      if (error) warnings.push(`Reservation not updated: ${error.message}`)
    }

    if (input.status !== previousStatus) {
      if (input.status === 'completed') {
        const { error: claimError } = await supabase.rpc('claim_logical_order', {
          p_order_id: editOrderId,
        })
        if (claimError) warnings.push(`Could not claim order: ${claimError.message}`)
        const { error } = await supabase.rpc('complete_logical_order', { p_order_id: editOrderId })
        if (error) warnings.push(`Status not changed: ${error.message}`)
      } else {
        const { error } = await supabase.rpc('transition_order', {
          p_order_id: editOrderId,
          p_new_status: input.status,
        })
        if (error) warnings.push(`Status not changed: ${error.message}`)
      }
    }

    return { orderId: editOrderId, created: false, warnings }
  }

  /* ── Create ───────────────────────────────────────────────────────────── */
  const { data: created, error: insertError } = await supabase
    .from('orders')
    .insert({ ...shared, user_id: user.id, status: 'pending' })
    .select()
    .single()
  if (insertError || !created) {
    throw new Error(`Could not create order: ${insertError?.message ?? 'unknown error'}`)
  }

  const orderId = (created as { id: string }).id

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows(orderId))
  if (itemsError) warnings.push(`Line items were not saved: ${itemsError.message}`)

  if (totals.totalRobux > 0) {
    const { error } = await supabase.rpc('reserve_order_robux', {
      p_order_id: orderId,
      p_account_id: input.accountId,
      p_robux_amount: effectiveRobux,
      p_gamepass_names: gamepassNames,
    })
    if (error) warnings.push(`Robux was not reserved: ${error.message}`)
  }

  if (input.status !== 'pending') {
    if (input.status === 'completed') {
      const { error: claimError } = await supabase.rpc('claim_logical_order', { p_order_id: orderId })
      if (claimError) warnings.push(`Could not claim order: ${claimError.message}`)
      const { error } = await supabase.rpc('complete_logical_order', { p_order_id: orderId })
      if (error) warnings.push(`Order created as pending: ${error.message}`)
    } else {
      const { error } = await supabase.rpc('transition_order', {
        p_order_id: orderId,
        p_new_status: input.status,
      })
      if (error) warnings.push(`Order created as pending: ${error.message}`)
    }
  }

  return { orderId, created: true, warnings }
}
