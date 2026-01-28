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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          company_id: string | null
          role: 'superadmin' | 'admin' | 'user'
          is_blocked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_name?: string | null
          company_id?: string | null
          role?: 'superadmin' | 'admin' | 'user'
          is_blocked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          company_id?: string | null
          role?: 'superadmin' | 'admin' | 'user'
          is_blocked?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          is_active: boolean
          invoice_limit: number
          user_limit: number
          transaction_limit: number
          plan_id: string
          is_trial: boolean
          trial_ends_at: string | null
          subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_started_at: string | null
          subscription_ends_at: string | null
          last_payment_date: string | null
          next_payment_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          is_active?: boolean
          invoice_limit?: number
          user_limit?: number
          transaction_limit?: number
          plan_id?: string
          is_trial?: boolean
          trial_ends_at?: string | null
          subscription_status?: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          last_payment_date?: string | null
          next_payment_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          is_active?: boolean
          invoice_limit?: number
          user_limit?: number
          transaction_limit?: number
          plan_id?: string
          is_trial?: boolean
          trial_ends_at?: string | null
          subscription_status?: 'trial' | 'active' | 'suspended' | 'cancelled'
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          last_payment_date?: string | null
          next_payment_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'companies_plan_id_fkey'
            columns: ['plan_id']
            referencedRelation: 'subscription_plans'
            referencedColumns: ['id']
          }
        ]
      }
      customer_transactions: {
        Row: {
          id: string
          customer_id: string
          company_id: string | null
          transaction_type: 'debt' | 'credit'
          source: string
          amount: number
          transaction_date: string
          description: string
          currency: string
        }
        Insert: {
          id?: string
          customer_id: string
          company_id?: string | null
          transaction_type: 'debt' | 'credit'
          source?: string
          amount: number
          transaction_date: string
          description: string
          currency?: string
        }
        Update: {
          id?: string
          customer_id?: string
          company_id?: string | null
          transaction_type?: 'debt' | 'credit'
          source?: string
          amount?: number
          transaction_date?: string
          description?: string
          currency?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          user_id: string
          company_name: string | null
          logo_url: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          address: string | null
          website: string | null
        }
        Insert: {
          user_id: string
          company_name?: string | null
          logo_url?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          website?: string | null
        }
        Update: {
          user_id?: string
          company_name?: string | null
          logo_url?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address?: string | null
          website?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          deal_id: string | null
          company_id: string | null
          type: 'task' | 'meeting' | 'call' | 'email'
          subject: string
          description: string | null
          due_date: string | null
          is_completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id?: string | null
          deal_id?: string | null
          company_id?: string | null
          type: 'task' | 'meeting' | 'call' | 'email'
          subject: string
          description?: string | null
          due_date?: string | null
          is_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string | null
          deal_id?: string | null
          company_id?: string | null
          type?: 'task' | 'meeting' | 'call' | 'email'
          subject?: string
          description?: string | null
          due_date?: string | null
          is_completed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          type: 'bank' | 'cash' | 'credit_card'
          currency: 'TRY' | 'USD' | 'EUR'
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          type: 'bank' | 'cash' | 'credit_card'
          currency?: 'TRY' | 'USD' | 'EUR'
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          type?: 'bank' | 'cash' | 'credit_card'
          currency?: 'TRY' | 'USD' | 'EUR'
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          type: 'individual' | 'corporate'
          customer_status: 'customer' | 'lead'
          email: string | null
          phone: string | null
          address: string | null
          tax_number: string | null
          tax_office: string | null
          contact_person: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          type: 'individual' | 'corporate'
          customer_status?: 'customer' | 'lead'
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_number?: string | null
          tax_office?: string | null
          contact_person?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          type?: 'individual' | 'corporate'
          customer_status?: 'customer' | 'lead'
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_number?: string | null
          tax_office?: string | null
          contact_person?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          customer_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          customer_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          customer_id?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          customer_id: string
          file_name: string
          file_url: string
          file_type: string
          file_size: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          customer_id: string
          file_name: string
          file_url: string
          file_type: string
          file_size: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          customer_id?: string
          file_name?: string
          file_url?: string
          file_type?: string
          file_size?: number
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          type: 'income' | 'expense'
          amount: number
          category: string
          payee: string | null
          description: string | null
          transaction_date: string
          customer_id: string | null
          bank_account: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          type: 'income' | 'expense'
          amount: number
          category: string
          payee?: string | null
          description?: string | null
          transaction_date: string
          customer_id?: string | null
          bank_account?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          type?: 'income' | 'expense'
          amount?: number
          category?: string
          payee?: string | null
          description?: string | null
          transaction_date?: string
          customer_id?: string | null
          bank_account?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          type: 'income' | 'expense'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          type: 'income' | 'expense'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          type?: 'income' | 'expense'
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          description: string | null
          unit_price: number
          type: 'service' | 'product'
          sku: string | null
          stock_quantity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          description?: string | null
          unit_price: number
          type?: 'service' | 'product'
          sku?: string | null
          stock_quantity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          description?: string | null
          unit_price?: number
          type?: 'service' | 'product'
          sku?: string | null
          stock_quantity?: number | null
          created_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          customer_id: string
          quote_number: string
          issue_date: string
          expiry_date: string
          token: string | null
          status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          customer_id: string
          quote_number: string
          issue_date: string
          expiry_date: string
          token?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          customer_id?: string
          quote_number?: string
          issue_date?: string
          expiry_date?: string
          token?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          company_id: string | null
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          company_id?: string | null
          product_id?: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          company_id?: string | null
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          customer_id: string
          title: string
          value: number
          stage: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          customer_id: string
          title: string
          value: number
          stage?: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          customer_id?: string
          title?: string
          value?: number
          stage?: 'new' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
          expected_close_date?: string
          created_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          actor_id: string | null
          action_type: string | null
          description: string | null
          message: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          actor_id?: string | null
          action_type?: string | null
          description?: string | null
          message: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          actor_id?: string | null
          action_type?: string | null
          description?: string | null
          message?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      system_errors: {
        Row: {
          id: string
          error_code: string
          error_message: string
          error_source: string | null
          request_path: string | null
          user_id: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          error_code: string
          error_message: string
          error_source?: string | null
          request_path?: string | null
          user_id?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          error_code?: string
          error_message?: string
          error_source?: string | null
          request_path?: string | null
          user_id?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          price: number
          currency: string
          billing_period: string
          features: Record<string, unknown>
          is_active: boolean
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          price?: number
          currency?: string
          billing_period?: string
          features?: Record<string, unknown>
          is_active?: boolean
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          price?: number
          currency?: string
          billing_period?: string
          features?: Record<string, unknown>
          is_active?: boolean
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          company_id: string
          role_name: 'admin' | 'user'
          module_key: string
          can_view: boolean
          can_edit: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          role_name: 'admin' | 'user'
          module_key: string
          can_view?: boolean
          can_edit?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          role_name?: 'admin' | 'user'
          module_key?: string
          can_view?: boolean
          can_edit?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          customer_id: string
          invoice_number: string
          invoice_date: string
          due_date: string
          status: 'draft' | 'sent' | 'pending' | 'paid' | 'cancelled'
          subtotal: number
          tax_amount: number
          total_amount: number
          notes: string | null
          token: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          customer_id: string
          invoice_number: string
          invoice_date: string
          due_date: string
          status?: 'draft' | 'sent' | 'pending' | 'paid' | 'cancelled'
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          token?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          customer_id?: string
          invoice_number?: string
          invoice_date?: string
          due_date?: string
          status?: 'draft' | 'sent' | 'pending' | 'paid' | 'cancelled'
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          token?: string | null
          created_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string | null
          company_id: string | null
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_id?: string | null
          invoice_id: string
          amount: number
          payment_date: string
          payment_method?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          company_id?: string | null
          invoice_id?: string
          amount?: number
          payment_date?: string
          payment_method?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          company_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          company_id?: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate?: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          company_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      public_invoice_get: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      public_quote_get: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      public_quote_set_status: {
        Args: {
          p_token: string
          p_status: string
        }
        Returns: null
      }
      user_has_permission: {
        Args: {
          p_user_id: string
          p_module_key: string
          p_permission_type: string
        }
        Returns: boolean
      }
      seed_default_permissions: {
        Args: {
          p_company_id: string
        }
        Returns: null
      }
      get_company_permissions: {
        Args: {
          p_company_id: string
        }
        Returns: {
          role_name: string
          module_key: string
          can_view: boolean
          can_edit: boolean
        }[]
      }
      update_company_permissions: {
        Args: {
          p_company_id: string
          p_permissions: Json
        }
        Returns: null
      }
      get_company_usage_stats: {
        Args: {
          company_uuid: string
        }
        Returns: Json
      }
      check_company_quota: {
        Args: {
          company_uuid: string
          resource_type: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
