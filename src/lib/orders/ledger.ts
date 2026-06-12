import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

export async function deductRobux(supabase: SupabaseClient, acctId: string, amount: number) {
  const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', acctId).single()
  if (!acc) return
  await supabase.from('roblox_accounts').update({ current_robux: Math.max(0, acc.current_robux - amount), updated_at: new Date().toISOString() }).eq('id', acctId)
}

export async function restoreRobux(supabase: SupabaseClient, acctId: string, amount: number) {
  const { data: acc } = await supabase.from('roblox_accounts').select('current_robux').eq('id', acctId).single()
  if (!acc) return
  await supabase.from('roblox_accounts').update({ current_robux: acc.current_robux + amount, updated_at: new Date().toISOString() }).eq('id', acctId)
}

export async function creditWallet(supabase: SupabaseClient, userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null) {
  if (amount <= 0) return
  await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'income', amount, category: 'Sale', description: `Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
}

export async function reverseWallet(supabase: SupabaseClient, userId: string, orderId: string, amount: number, orderNum: string | null, buyer: string | null, reason: 'Refund' | 'Cancellation') {
  if (amount <= 0) return
  await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'expense', amount: -amount, category: reason === 'Refund' ? 'Refund Issued' : 'Cancellation', description: `${reason}: Order ${orderNum ?? ''} — ${buyer ?? 'Customer'}`, reference_order_id: orderId })
}
