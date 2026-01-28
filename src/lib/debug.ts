declare global {
  interface Window {
    __APP_DEBUG?: Record<string, unknown>
  }
}

export function updateDebugState(patch: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.__APP_DEBUG = {
    ...(window.__APP_DEBUG || {}),
    ...patch,
  }
}
