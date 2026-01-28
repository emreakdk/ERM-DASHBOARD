import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../AuthContext'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}))

vi.mock('../../lib/debug', () => ({
  updateDebugState: vi.fn(),
}))

/**
 * AuthContext smoke test
 * Temel auth state yönetiminin çalıştığını doğrular
 */
describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => {
    return <AuthProvider>{children}</AuthProvider>
  }

  it('başlangıçta loading true olmalı', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    expect(result.current.loading).toBe(true)
  })

  it('useAuth hook AuthProvider dışında hata fırlatmalı', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth hook AuthProvider içinde kullanılmalı')
  })
})
