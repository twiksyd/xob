import type { createClient } from '@/lib/supabase/client'
import type { RobloxAccount } from '@/lib/types/database'
import { parseRobloxUserId } from '@/components/accounts/AccountModal'
import { calculateBusinessValue, classifyPurchase } from '@/lib/utils/capital'

/* The single implementation of "create or update a Roblox account".
 *
 * Both the legacy Accounts page and the operations console call this — the
 * console must never grow a second copy, because the create path also derives
 * the cost basis and writes the capital event that Capital Safety reads. */

export interface AccountFormData {
  username: string
  current_robux: number
  reserved_robux: number
  robux_cost_rate: number
  status: 'active' | 'inactive' | 'banned' | 'low'
  notes?: string
  roblox_profile?: string
  purchase_cost?: number
  supplier?: string
  purchase_date?: string
  has_active_discount?: boolean
  has_super_discount?: boolean
  is_plus_account?: boolean
  chrome_profile?: string
}

type Client = ReturnType<typeof createClient>

/* Plus is timestamped only when it changes, so `plus_enabled_at` keeps meaning
   "when Plus was switched on" and an already-dismissed renewal reminder is not
   resurrected by an unrelated edit. */
function plusTimestamps(wasPlus: boolean, isNowPlus: boolean): Record<string, string | null> {
  if (!wasPlus && isNowPlus) {
    return { plus_enabled_at: new Date().toISOString(), plus_reminder_dismissed_at: null }
  }
  if (wasPlus && !isNowPlus) {
    return { plus_enabled_at: null, plus_reminder_dismissed_at: null }
  }
  return {}
}

async function resolveRobloxUserId(data: AccountFormData): Promise<string | null> {
  const manual = parseRobloxUserId(data.roblox_profile)
  if (manual) return manual
  if (!data.username) return null
  try {
    const res = await fetch(`/api/roblox-lookup?username=${encodeURIComponent(data.username)}`)
    if (res.ok) return ((await res.json()).userId as string | null) ?? null
  } catch {}
  return null
}

export async function saveAccount({
  supabase,
  data,
  editAccount,
  accounts,
  walletBalance,
}: {
  supabase: Client
  data: AccountFormData
  /** Null/undefined creates; a row updates that row. */
  editAccount?: RobloxAccount | null
  /** Inventory side of business value, for the capital event on a purchase. */
  accounts: RobloxAccount[]
  /** Cash side. Fetched via `get_wallet_balance` when the caller does not
   *  already hold it — only needed when a purchase cost was entered. */
  walletBalance?: number
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')

  const robloxUserId = await resolveRobloxUserId(data)

  if (editAccount) {
    // current_robux / reserved_robux / robux_cost_rate are deliberately absent:
    // on an existing account they move only through the order financial engine
    // or adjust_account_field, both of which leave an audit trail.
    const isNowPlus = data.is_plus_account ?? false
    const { error } = await supabase
      .from('roblox_accounts')
      .update({
        username: data.username,
        status: data.status,
        notes: data.notes ?? null,
        roblox_user_id: robloxUserId,
        has_active_discount: data.has_active_discount ?? false,
        has_super_discount: data.has_super_discount ?? false,
        is_plus_account: isNowPlus,
        chrome_profile: data.chrome_profile?.trim() || null,
        ...plusTimestamps(editAccount.is_plus_account, isNowPlus),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editAccount.id)
    if (error) throw error
    return
  }

  // A purchase cost derives the cost basis directly — Purchase Cost ÷ Robux
  // Acquired × 1,000 — instead of asking for the same figure twice.
  const purchaseCost = data.purchase_cost ?? 0
  const robuxCostRate =
    purchaseCost > 0 && data.current_robux > 0
      ? (purchaseCost / data.current_robux) * 1000
      : (data.robux_cost_rate ?? 0)

  const isNowPlus = data.is_plus_account ?? false
  const { data: inserted, error } = await supabase
    .from('roblox_accounts')
    .insert({
      username: data.username,
      current_robux: data.current_robux,
      reserved_robux: data.reserved_robux,
      robux_cost_rate: robuxCostRate,
      status: data.status,
      notes: data.notes ?? null,
      roblox_user_id: robloxUserId,
      has_active_discount: data.has_active_discount ?? false,
      has_super_discount: data.has_super_discount ?? false,
      is_plus_account: isNowPlus,
      chrome_profile: data.chrome_profile?.trim() || null,
      ...plusTimestamps(false, isNowPlus),
      user_id: user.id,
    })
    .select('id')
    .single()
  if (error) throw error

  if (inserted && purchaseCost > 0) {
    const cash = walletBalance ?? Number((await supabase.rpc('get_wallet_balance')).data ?? 0)
    const businessValueBefore = calculateBusinessValue(accounts, cash)
    const { error: eventError } = await supabase.from('capital_events').insert({
      user_id: user.id,
      accounts_purchased: 1,
      robux_acquired: data.current_robux,
      cost: purchaseCost,
      business_value_before: businessValueBefore,
      supplier: data.supplier?.trim() || null,
      roblox_account_id: inserted.id,
      created_at: data.purchase_date ? new Date(data.purchase_date).toISOString() : undefined,
      ...classifyPurchase(businessValueBefore, purchaseCost),
    })
    if (eventError) throw eventError
  }
}
