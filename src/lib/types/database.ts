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
          notes: string | null
          status: 'active' | 'inactive' | 'banned' | 'low'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          current_robux?: number
          reserved_robux?: number
          notes?: string | null
          status?: 'active' | 'inactive' | 'banned' | 'low'
        }
        Update: {
          username?: string
          current_robux?: number
          reserved_robux?: number
          notes?: string | null
          status?: 'active' | 'inactive' | 'banned' | 'low'
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
          notes: string | null
          paid_at: string | null
          delivered_at: string | null
          completed_at: string | null
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
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type RobloxAccount = Database['public']['Tables']['roblox_accounts']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type Gamepass = Database['public']['Tables']['gamepasses']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']

export type GamepassWithGame = Gamepass & { games: Game | null }
export type OrderWithDetails = Order & {
  gamepasses: (Gamepass & { games: Game | null }) | null
  roblox_accounts: RobloxAccount | null
}
export type TransactionWithOrder = Transaction & { orders: Order | null }

// UI helper types
export type OrderStatus = Order['status']
export type AccountStatus = RobloxAccount['status']
export type GamepassStatus = Gamepass['status']
export type TransactionType = Transaction['type']
export type PaymentMethod = Order['payment_method']
