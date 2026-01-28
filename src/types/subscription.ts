// NOT: SQL migration çalıştırıldıktan sonra database types'ı regenerate edilmeli
// Şimdilik manuel type tanımları kullanıyoruz

export interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  description: string | null
  price: number
  currency: string
  billing_period: 'monthly' | 'yearly'
  features: PlanFeatures
  is_active: boolean
  is_featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type SubscriptionPlanInsert = Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>
export type SubscriptionPlanUpdate = Partial<SubscriptionPlanInsert>

export interface PlanFeatures {
  max_users: number
  max_invoices: number
  max_customers: number
  max_products: number
  max_deals: number
  max_quotes: number
  max_storage_mb: number
  modules: {
    finance: boolean
    invoices: boolean
    customers: boolean
    products: boolean
    quotes: boolean
    deals: boolean
    accounts: boolean
    reports: boolean
    api_access: boolean
  }
}

export interface CompanyUsageStats {
  users: number
  invoices: number
  customers: number
  products: number
  deals: number
  quotes: number
}

export interface QuotaCheckResult {
  allowed: boolean
  unlimited?: boolean
  current?: number
  limit?: number
  remaining?: number
  reason?: 'no_plan' | 'quota_exceeded'
  message?: string
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled'
export type BillingPeriod = 'monthly' | 'yearly'

export interface CompanySubscription {
  plan_id: string | null
  is_trial: boolean
  trial_ends_at: string | null
  subscription_status: SubscriptionStatus
  subscription_started_at: string | null
  subscription_ends_at: string | null
  last_payment_date: string | null
  next_payment_date: string | null
}
