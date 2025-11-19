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
      wants: {
        Row: {
          id: string
          user_id: string | null
          item_id: string | null
          quantity: number
          min_condition: 'NM' | 'LP' | 'MP' | 'HP'
          language_ok: string[]
          finish_ok: string[]
          priority: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          item_id?: string | null
          quantity: number
          min_condition: 'NM' | 'LP' | 'MP' | 'HP'
          language_ok?: string[]
          finish_ok?: string[]
          priority: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          item_id?: string | null
          quantity?: number
          min_condition?: 'NM' | 'LP' | 'MP' | 'HP'
          language_ok?: string[]
          finish_ok?: string[]
          priority?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}