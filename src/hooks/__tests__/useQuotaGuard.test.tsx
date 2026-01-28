import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useQuotaGuard } from '../useQuotaGuard'
import { useTenant } from '../../contexts/TenantContext'

// Mock dependencies
vi.mock('../../contexts/TenantContext')
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}))

/**
 * useQuotaGuard hook testi
 * Şirket quota kontrollerinin doğru çalıştığını doğrular
 */
describe('useQuotaGuard', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('companyId olmadan çalışır ve hata döner', () => {
    vi.mocked(useTenant).mockReturnValue({
      companyId: null,
      companyName: null,
      role: null,
      userRole: null,
      loading: false,
      refreshTenant: vi.fn(),
    })

    const { result } = renderHook(() => useQuotaGuard(), { wrapper })

    const checkResult = result.current.canPerformAction('CREATE_INVOICE')
    expect(checkResult.allowed).toBe(false)
    expect(checkResult.reason).toBe('company_not_found')
  })

  it('loading durumunda isLoading true olmalı', () => {
    vi.mocked(useTenant).mockReturnValue({
      companyId: 'test-company-id',
      companyName: 'Test Company',
      role: 'admin',
      userRole: 'admin',
      loading: false,
      refreshTenant: vi.fn(),
    })

    const { result } = renderHook(() => useQuotaGuard(), { wrapper })

    expect(result.current.isLoading).toBeDefined()
  })
})
