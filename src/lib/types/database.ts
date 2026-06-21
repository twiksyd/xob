export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          robux_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          robux_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          robux_rate?: number
          updated_at?: string
        }
      }
      roblox_accounts: {
        Row: {
          id: string
          user_id: string
          username: string
          current_robux: number
          reserved_robux: number
          robux_cost_rate: number
          notes: string | null
          roblox_user_id: string | null
          status: 'active' | 'inactive' | 'banned' | 'low'
          has_active_discount: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          current_robux?: number
          reserved_robux?: number
          robux_cost_rate?: number
          notes?: string | null
          roblox_user_id?: string | null
          status?: 'active' | 'inactive' | 'banned' | 'low'
          has_active_discount?: boolean
        }
        Update: {
          username?: string
          current_robux?: number
          reserved_robux?: number
          robux_cost_rate?: number
          notes?: string | null
          roblox_user_id?: string | null
          status?: 'active' | 'inactive' | 'banned' | 'low'
          has_active_discount?: boolean
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category?: string | null
          color?: string
        }
        Update: {
          name?: string
          category?: string | null
          color?: string
        }
      }
      gamepasses: {
        Row: {
          id: string
          user_id: string
          game_id: string | null
          name: string
          robux_amount: number
          competitor_price: number
          your_price: number
          robux_rate: number
          your_cost: number
          profit: number
          status: 'Good' | 'Okay' | 'Bad'
          suggested_lower_price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_id?: string | null
          name: string
          robux_amount: number
          competitor_price?: number
          your_price?: number
          robux_rate?: number
          your_cost?: number
          profit?: number
          status?: 'Good' | 'Okay' | 'Bad'
          suggested_lower_price?: number
          is_active?: boolean
        }
        Update: {
          game_id?: string | null
          name?: string
          robux_amount?: number
          competitor_price?: number
          your_price?: number
          robux_rate?: number
          your_cost?: number
          profit?: number
          status?: 'Good' | 'Okay' | 'Bad'
          suggested_lower_price?: number
          is_active?: boolean
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          order_number: string | null
          gamepass_id: string | null
          roblox_account_id: string | null
          buyer_name: string | null
          buyer_roblox_username: string | null
          robux_amount: number | null
          selling_price: number | null
          cost: number | null
          profit: number | null
          payment_method: 'GCash' | 'Maya' | 'Bank' | 'Cash' | 'Other'
          status: 'pending' | 'paid' | 'delivering' | 'completed' | 'refunded' | 'cancelled'
          account_rate_used: number | null
          notes: string | null
          paid_at: string | null
          delivered_at: string | null
          completed_at: string | null
          refunded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gamepass_id?: string | null
          roblox_account_id?: string | null
          buyer_name?: string | null
          buyer_roblox_username?: string | null
          robux_amount?: number | null
          selling_price?: number | null
          cost?: number | null
          profit?: number | null
          payment_method?: 'GCash' | 'Maya' | 'Bank' | 'Cash' | 'Other'
          status?: 'pending' | 'paid' | 'delivering' | 'completed' | 'refunded' | 'cancelled'
          notes?: string | null
        }
        Update: {
          gamepass_id?: string | null
          roblox_account_id?: string | null
          buyer_name?: string | null
          buyer_roblox_username?: string | null
          robux_amount?: number | null
          selling_price?: number | null
          cost?: number | null
          profit?: number | null
          payment_method?: 'GCash' | 'Maya' | 'Bank' | 'Cash' | 'Other'
          status?: 'pending' | 'paid' | 'delivering' | 'completed' | 'refunded' | 'cancelled'
          account_rate_used?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          roblox_account_id: string | null
          roblox_account_username: string | null
          type: 'sale' | 'refund' | 'adjustment' | 'topup'
          robux_change: number
          balance_before: number | null
          balance_after: number | null
          selling_price: number | null
          profit: number | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id?: string | null
          roblox_account_id?: string | null
          roblox_account_username?: string | null
          type?: 'sale' | 'refund' | 'adjustment' | 'topup'
          robux_change: number
          balance_before?: number | null
          balance_after?: number | null
          selling_price?: number | null
          profit?: number | null
          description?: string | null
        }
        Update: never
      }
      wallet_transactions: {
        Row: {
          id: string
          user_id: string
          type: 'income' | 'expense' | 'adjustment'
          amount: number
          category: string
          description: string | null
          reference_order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'income' | 'expense' | 'adjustment'
          amount: number
          category?: string
          description?: string | null
          reference_order_id?: string | null
        }
        Update: never
      }
      capital_events: {
        Row: {
          id: string
          user_id: string
          accounts_purchased: number
          robux_acquired: number
          cost: number
          business_value_before: number
          business_value_after: number
          profit_used: number
          capital_used: number
          protected_capital_remaining: number
          funding_source: 'profit' | 'mixed' | 'capital'
          supplier: string | null
          roblox_account_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          accounts_purchased: number
          robux_acquired: number
          cost: number
          business_value_before: number
          business_value_after: number
          profit_used?: number
          capital_used?: number
          protected_capital_remaining: number
          funding_source: 'profit' | 'mixed' | 'capital'
          supplier?: string | null
          roblox_account_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: never
      }
      transfer_reservations: {
        Row: {
          id: string
          user_id: string
          roblox_account_id: string
          amount: number
          customer_label: string | null
          order_id: string | null
          note: string | null
          scheduled_for: string | null
          status: 'reserved' | 'fulfilled' | 'cancelled'
          created_at: string
          fulfilled_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          roblox_account_id: string
          amount: number
          customer_label?: string | null
          order_id?: string | null
          note?: string | null
          scheduled_for?: string | null
          status?: 'reserved' | 'fulfilled' | 'cancelled'
          created_at?: string
          fulfilled_at?: string | null
          cancelled_at?: string | null
        }
        Update: never
      }
      transfer_logs: {
        Row: {
          id: string
          user_id: string
          roblox_account_id: string
          amount: number
          reservation_id: string | null
          sent_at: string
          note: string | null
        }
        Insert: {
          id?: string
          user_id: string
          roblox_account_id: string
          amount: number
          reservation_id?: string | null
          sent_at?: string
          note?: string | null
        }
        Update: never
      }
      instant_send_price_tiers: {
        Row: {
          id: string
          user_id: string
          robux_amount: number
          price: number
          profit: number
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          robux_amount: number
          price: number
          profit: number
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          price?: number
          profit?: number
          status?: string | null
          updated_at?: string
        }
      }
      instant_send_sales: {
        Row: {
          id: string
          user_id: string
          roblox_account_id: string
          robux_amount: number
          price: number
          profit: number
          breakdown: { amount: number; price: number; profit: number; sent_at: string; log_id: string }[]
          customer_label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          roblox_account_id: string
          robux_amount: number
          price: number
          profit: number
          breakdown: { amount: number; price: number; profit: number; sent_at: string; log_id: string }[]
          customer_label?: string | null
          created_at?: string
        }
        Update: never
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type RobloxAccount = Database['public']['Tables']['roblox_accounts']['Row']
export type TransferReservation = Database['public']['Tables']['transfer_reservations']['Row']
export type TransferLog = Database['public']['Tables']['transfer_logs']['Row']
export type InstantSendPriceTier = Database['public']['Tables']['instant_send_price_tiers']['Row']
export type InstantSendSale = Database['public']['Tables']['instant_send_sales']['Row']
export type AllowanceSummary = {
  roblox_account_id: string
  sent_today: number
  reserved: number
  lifetime_sent: number
  available: number
  last_sent_at: string | null
}
export type Game = Database['public']['Tables']['games']['Row']
export type Gamepass = Database['public']['Tables']['gamepasses']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']

export type OrderItem = {
  id: string
  order_id: string
  gamepass_id: string | null
  gamepass_name: string
  game_name: string | null
  robux_amount: number
  selling_price: number
  cost: number
  profit: number
  created_at: string
}

export type LineItem = {
  _key: string
  gamepass_id: string
  gamepass_name: string
  game_name: string | null
  robux_amount: number
  selling_price: number
  cost: number
  profit: number
}

export type GamepassWithGame = Gamepass & { games: Game | null }
export type OrderWithDetails = Order & {
  gamepasses: (Gamepass & { games: Game | null }) | null
  roblox_accounts: RobloxAccount | null
  order_items: OrderItem[]
}
export type OrderWithItems = Order & { order_items: OrderItem[] }
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row']
export type CapitalEvent = Database['public']['Tables']['capital_events']['Row']
export type TransactionWithOrder = Transaction & { orders: Order | null }

export type RobloxReservation = {
  id: string
  user_id: string
  order_id: string
  account_id: string
  robux_amount: number
  gamepass_names: string
  status: 'active' | 'released'
  released_at: string | null
  created_at: string
}

export type ReservationWithDetails = RobloxReservation & {
  roblox_accounts: { username: string } | null
  orders: { order_number: string | null; buyer_name: string | null; status: string } | null
}

export type SavingsGoal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  allocation_pct: number
  priority: number
  status: 'active' | 'completed' | 'locked'
  created_at: string
  updated_at: string
}

export type SavingsTransaction = {
  id: string
  user_id: string
  goal_id: string
  order_id: string | null
  amount: number
  type: 'allocation' | 'reversal'
  description: string | null
  created_at: string
}

export type OrderReassignment = {
  id: string
  user_id: string
  order_id: string
  from_account_id: string | null
  from_account_username: string
  to_account_id: string | null
  to_account_username: string
  robux_amount: number
  order_status_at_time: string
  created_at: string
}

export type SellerAccount = {
  id: string
  user_id: string
  username: string
  display_name: string | null
  has_drag_spec: boolean
  estimated_price: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SellerAccountVehicle = {
  id: string
  user_id: string
  seller_account_id: string
  name: string
  is_limited: boolean
  estimated_value: number | null
  created_at: string
}

export type SellerAccountWithVehicles = SellerAccount & {
  seller_account_vehicles: SellerAccountVehicle[]
}

// UI helper types
export type OrderStatus = Order['status']
export type AccountStatus = RobloxAccount['status']
export type GamepassStatus = Gamepass['status']
export type TransactionType = Transaction['type']
export type PaymentMethod = Order['payment_method']
