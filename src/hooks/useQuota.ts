import { useTenant } from '../contexts/TenantContext'
import { useCheckCompanyQuota, useCompanyUsageStats } from './useSubscription'

/**
 * Quota enforcement hook - Şirketin belirli bir kaynak için kota durumunu kontrol eder
 * Envato Market standardında profesyonel kota yönetimi
 */
export function useQuota(resourceType: 'users' | 'invoices' | 'customers' | 'products' | 'deals' | 'quotes') {
  const { companyId } = useTenant()
  
  const quotaQuery = useCheckCompanyQuota(companyId, resourceType)
  const usageQuery = useCompanyUsageStats(companyId)

  return {
    // Kaynak eklenebilir mi?
    canAdd: quotaQuery.data?.allowed ?? true,
    
    // Kota aşıldı mı?
    isQuotaExceeded: quotaQuery.data?.allowed === false && quotaQuery.data?.reason === 'quota_exceeded',
    
    // Plan yok mu?
    hasNoPlan: quotaQuery.data?.allowed === false && quotaQuery.data?.reason === 'no_plan',
    
    // Sınırsız mı?
    isUnlimited: quotaQuery.data?.unlimited ?? false,
    
    // Mevcut kullanım
    current: quotaQuery.data?.current ?? 0,
    
    // Maksimum limit
    limit: quotaQuery.data?.limit ?? 0,
    
    // Kalan kota
    remaining: quotaQuery.data?.remaining ?? 0,
    
    // Hata mesajı
    message: quotaQuery.data?.message,
    
    // Yükleniyor mu?
    isLoading: quotaQuery.isLoading || usageQuery.isLoading,
    
    // Tüm kullanım istatistikleri
    usage: usageQuery.data,
    
    // Yüzde olarak kullanım
    usagePercentage: quotaQuery.data?.limit && quotaQuery.data?.limit > 0 && quotaQuery.data?.current
      ? Math.round((quotaQuery.data.current / quotaQuery.data.limit) * 100)
      : 0,
  }
}

/**
 * Tüm kaynaklar için kota durumunu kontrol eder
 */
export function useAllQuotas() {
  const { companyId } = useTenant()
  const usageQuery = useCompanyUsageStats(companyId)

  const users = useQuota('users')
  const invoices = useQuota('invoices')
  const customers = useQuota('customers')
  const products = useQuota('products')
  const deals = useQuota('deals')
  const quotes = useQuota('quotes')

  return {
    users,
    invoices,
    customers,
    products,
    deals,
    quotes,
    usage: usageQuery.data,
    isLoading: usageQuery.isLoading,
    
    // Herhangi bir kota aşıldı mı?
    hasAnyQuotaExceeded: [users, invoices, customers, products, deals, quotes].some(
      (q) => q.isQuotaExceeded
    ),
    
    // Herhangi bir kaynak eklenebilir mi?
    canAddAny: {
      users: users.canAdd,
      invoices: invoices.canAdd,
      customers: customers.canAdd,
      products: products.canAdd,
      deals: deals.canAdd,
      quotes: quotes.canAdd,
    },
  }
}

/**
 * Quota aşıldığında gösterilecek standart mesaj
 */
export function getQuotaExceededMessage(resourceType: string, limit: number): string {
  const resourceNames: Record<string, string> = {
    users: 'kullanıcı',
    invoices: 'fatura',
    customers: 'müşteri',
    products: 'ürün',
    deals: 'fırsat',
    quotes: 'teklif',
  }

  const name = resourceNames[resourceType] || resourceType
  return `Planınızın ${name} limiti (${limit}) doldu. Daha fazla ${name} eklemek için planınızı yükseltin.`
}

/**
 * Quota durumuna göre buton tooltip'i
 */
export function getQuotaTooltip(quota: ReturnType<typeof useQuota>): string | undefined {
  if (quota.isLoading) return 'Yükleniyor...'
  if (quota.hasNoPlan) return 'Lütfen bir abonelik planı seçin'
  if (quota.isQuotaExceeded) return quota.message || 'Plan limitinize ulaştınız'
  if (quota.isUnlimited) return undefined
  return `${quota.current} / ${quota.limit} kullanıldı (${quota.remaining} kaldı)`
}
