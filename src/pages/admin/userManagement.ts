import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']

export type CreateUserPayload = {
  email: string
  password: string
  full_name: string
  company_id: string | null
  role: 'admin' | 'user'
}

export type UpdateUserPayload = {
  full_name?: string
  company_id?: string | null
  role?: 'admin' | 'user' | 'superadmin'
  is_blocked?: boolean
}

async function invokeEdgeFunction<T>(name: string, payload: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload ?? {}),
  })

  let parsedBody: unknown = null
  try {
    parsedBody = await response.json()
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    const errorMessage = extractEdgeError(parsedBody) ?? `Edge function ${name} hata döndürdü`
    throw new Error(errorMessage)
  }

  if (parsedBody === null || typeof parsedBody === 'undefined') {
    throw new Error(`Edge function ${name} geçersiz yanıt döndürdü`)
  }

  return parsedBody as T
}

function extractEdgeError(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  if ('error' in value) {
    const error = (value as { error?: unknown }).error
    if (typeof error === 'string') {
      return error
    }
  }

  if ('message' in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  return undefined
}

export async function createUser(payload: CreateUserPayload): Promise<ProfileRow> {
  const data = await invokeEdgeFunction<{ profile: ProfileRow }>('admin-create-user', {
    email: payload.email,
    password: payload.password,
    full_name: payload.full_name,
    company_id: payload.company_id,
    role: payload.role,
  })

  if (!data?.profile) {
    throw new Error('Profil bilgisi alınamadı')
  }

  return data.profile
}

export async function updateUserProfile(userId: string, payload: UpdateUserPayload): Promise<void> {
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)

  if (error) {
    throw error
  }
}

export async function deleteUser(userId: string): Promise<void> {
  await invokeEdgeFunction('admin-delete-user', { userId })
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await invokeEdgeFunction('admin-reset-password', { userId, newPassword })
}
