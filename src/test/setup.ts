import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Test her çalıştırıldıktan sonra temizlik yap
afterEach(() => {
  cleanup()
})
