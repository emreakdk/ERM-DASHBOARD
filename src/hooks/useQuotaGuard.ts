import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTenant } from '../contexts/TenantContext'

export type ActionType = 
  | 'CREATE_INVOICE' 
  | 'ADD_USER' 
  | 'ADD_CUSTOMER' 
  | 'ADD_PRODUCT'
  | 'ADD_DEAL'
  | 'ADD_QUOTE'

interface QuotaCheckResult {
  allowed: boolean
  reason?: 'quota_exceeded' | 'no_plan' | 'company_not_found'
  message?: string
  current?: number
  limit?: number
  remaining?: number
  unlimited?: boolean
}

interface UsageStats {
  users: number
  invoices: number
  customers: number
  products: number
  deals: number
  quotes: number
}

interface PlanFeatures {
  max_users: number
  max_invoices: number
  max_customers: number
  max_products: number
  max_deals: number
  max_quotes: number
  max_storage_mb: number
  modules: Record<string, boolean>
}

interface CompanyPlan {
  id: string
  name: string
  display_name: string
  price: number
  currency: string
  features: PlanFeatures
}

const ACTION_TO_RESOURCE_MAP: Record<ActionType, string> = {
  CREATE_INVOICE: 'invoices',
  ADD_USER: 'users',
  ADD_CUSTOMER: 'customers',
  ADD_PRODUCT: 'products',
  ADD_DEAL: 'deals',
  ADD_QUOTE: 'quotes',
}

export function useQuotaGuard() {
  const { companyId } = useTenant()

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['company_usage', companyId],
    queryFn: async () => {
      if (!companyId) return null

      // RPC fonksiyonunu doğrudan çağırmak yerine manuel sorgu yapalım
      const [users, invoices, customers, products, deals, quotes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      ])

      return {
        users: users.count ?? 0,
        invoices: invoices.count ?? 0,
        customers: customers.count ?? 0,
        products: products.count ?? 0,
        deals: deals.count ?? 0,
        quotes: quotes.count ?? 0,
      } as UsageStats
    },
    enabled: !!companyId,
    staleTime: 30_000,
  })

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['company_plan', companyId],
    queryFn: async () => {
      if (!companyId) return null

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(`
          plan_id,
          subscription_status,
          is_trial,
          subscription_plans (
            id,
            name,
            display_name,
            price,
            currency,
            features
          )
        `)
        .eq('id', companyId)
        .single()

      if (companyError) {
        throw companyError
      }

      if (!company?.subscription_plans) {
        return null
      }

      return company.subscription_plans as unknown as CompanyPlan
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

  const canPerformAction = (actionType: ActionType): QuotaCheckResult => {
    if (!companyId) {
      return {
        allowed: false,
        reason: 'company_not_found',
        message: 'Şirket bilgisi bulunamadı',
      }
    }

    if (usageLoading || planLoading) {
      return {
        allowed: true,
      }
    }

    if (!planData) {
      return {
        allowed: false,
        reason: 'no_plan',
        message: 'Lütfen bir abonelik planı seçin',
      }
    }

    const resourceType = ACTION_TO_RESOURCE_MAP[actionType]
    const maxKey = `max_${resourceType}` as keyof PlanFeatures
    const maxLimit = planData.features[maxKey] as number
    const currentCount = usageData?.[resourceType as keyof UsageStats] ?? 0

    if (maxLimit === -1) {
      return {
        allowed: true,
        unlimited: true,
        current: currentCount,
      }
    }

    if (currentCount >= maxLimit) {
      return {
        allowed: false,
        reason: 'quota_exceeded',
        message: `Plan limitinize ulaştınız (${currentCount}/${maxLimit}). Lütfen planınızı yükseltin.`,
        current: currentCount,
        limit: maxLimit,
        remaining: 0,
      }
    }

    return {
      allowed: true,
      current: currentCount,
      limit: maxLimit,
      remaining: maxLimit - currentCount,
    }
  }

  const getUsagePercentage = (resourceType: keyof UsageStats): number => {
    if (!usageData || !planData) return 0

    const maxKey = `max_${resourceType}` as keyof PlanFeatures
    const maxLimit = planData.features[maxKey] as number
    const currentCount = usageData[resourceType] ?? 0

    if (maxLimit === -1) return 0
    if (maxLimit === 0) return 100

    return Math.round((currentCount / maxLimit) * 100)
  }

  return {
    canPerformAction,
    getUsagePercentage,
    usage: usageData,
    plan: planData,
    isLoading: usageLoading || planLoading,
  }
}
