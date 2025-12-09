export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          subscription_tier: 'free' | 'pro' | 'lgs'
          subscription_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          subscription_tier?: 'free' | 'pro' | 'lgs'
          subscription_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          subscription_tier?: 'free' | 'pro' | 'lgs'
          subscription_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trade_sessions: {
        Row: {
          id: string
          qr_code: string
          user_a_id: string
          user_b_id: string | null
          game: string
          price_source: string
          fairness_threshold: number
          currency: string
          status: string
          event_id: string | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          qr_code: string
          user_a_id: string
          user_b_id?: string | null
          game?: string
          price_source?: string
          fairness_threshold?: number
          currency?: string
          status?: string
          event_id?: string | null
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          qr_code?: string
          user_a_id?: string
          user_b_id?: string | null
          game?: string
          price_source?: string
          fairness_threshold?: number
          currency?: string
          status?: string
          event_id?: string | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_qr_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      check_qr_rate_limit: {
        Args: {
          p_ip_address: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}