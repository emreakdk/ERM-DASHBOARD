import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const getCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
})

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Unknown error'
}

const logSystemError = async (
  supabaseAdmin: SupabaseClient,
  errorCode: string,
  errorMessage: string,
  details: Record<string, unknown>,
  companyId?: string | null,
  userId?: string | null
) => {
  try {
    await supabaseAdmin.from('system_errors').insert({
      company_id: companyId,
      user_id: userId,
      error_code: errorCode,
      error_message: errorMessage,
      error_details: details,
      source: 'edge_function',
      function_name: 'admin-reset-password',
      severity: errorCode.startsWith('5') ? 'critical' : errorCode.startsWith('4') ? 'error' : 'warning',
    })
  } catch (logError) {
    console.error('[admin-reset-password] Failed to log error:', logError)
  }
}

serve(async (req: Request) => {
  console.log('[admin-reset-password] Incoming request', { method: req.method, origin: req.headers.get('origin') })
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, 500, { success: false, error: 'Supabase environment variables missing' })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const authHeader = req.headers.get('Authorization') ?? ''
    const tokenMatch = authHeader.match(/^Bearer (.*)$/i)

    if (!tokenMatch) {
      await logSystemError(supabaseAdmin, '401', 'Authorization header missing', { origin: req.headers.get('origin') })
      return jsonResponse(req, 401, { success: false, error: 'Authorization header missing' })
    }

    const token = tokenMatch[1]
    
    let userId: string
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub
      console.log('[admin-reset-password] Decoded token', { userId })
    } catch (e) {
      console.error('[admin-reset-password] Token decode error', e)
      await logSystemError(supabaseAdmin, '401', 'Invalid token format', { error: getErrorMessage(e) })
      return jsonResponse(req, 401, { success: false, error: 'Invalid token format' })
    }

    if (!userId) {
      return jsonResponse(req, 401, { success: false, error: 'User ID not found in token' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_blocked, email')
      .eq('id', userId)
      .single()

    console.log('[admin-reset-password] Profile lookup', { userId, profile, error: profileError?.message })

    if (profileError || !profile) {
      await logSystemError(supabaseAdmin, '401', 'User profile not found', { userId, error: profileError?.message }, null, userId)
      return jsonResponse(req, 401, { success: false, error: 'User profile not found' })
    }

    if (profile.is_blocked) {
      await logSystemError(supabaseAdmin, '403', 'User account is blocked', { userId, email: profile.email }, null, userId)
      return jsonResponse(req, 403, { success: false, error: 'User account is blocked' })
    }

    if ((profile.role ?? '').toLowerCase() !== 'superadmin') {
      await logSystemError(supabaseAdmin, '403', 'Insufficient permissions', { userId, role: profile.role, required: 'superadmin' }, null, userId)
      return jsonResponse(req, 403, { success: false, error: `Only superadmins can reset passwords. Your role: ${profile.role}` })
    }

    console.log('[admin-reset-password] Authorization successful', { userId, email: profile.email, role: profile.role })

    let body: { userId?: string; newPassword?: string }
    try {
      body = await req.json()
    } catch (jsonError) {
      await logSystemError(supabaseAdmin, '400', 'Invalid JSON body', { error: getErrorMessage(jsonError) }, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'Invalid JSON body' })
    }

    const { userId: targetUserId, newPassword } = body

    if (!targetUserId || !newPassword) {
      await logSystemError(supabaseAdmin, '400', 'User ID and new password are required', { hasUserId: !!targetUserId, hasPassword: !!newPassword }, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'User ID and new password are required' })
    }

    if (newPassword.length < 6) {
      await logSystemError(supabaseAdmin, '400', 'Password must be at least 6 characters', { passwordLength: newPassword.length }, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'Password must be at least 6 characters' })
    }

    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })

    if (resetError) {
      await logSystemError(supabaseAdmin, '400', 'Failed to reset password', { targetUserId, error: resetError.message }, null, userId)
      return jsonResponse(req, 400, {
        success: false,
        error: resetError.message ?? 'Failed to reset password',
      })
    }

    return jsonResponse(req, 200, { success: true })
  } catch (error) {
    console.error('[admin-reset-password] Unhandled error', error)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
        await logSystemError(supabaseAdmin, '500', 'Unhandled error in admin-reset-password', { error: getErrorMessage(error) })
      }
    } catch (logErr) {
      console.error('[admin-reset-password] Failed to log unhandled error:', logErr)
    }
    return jsonResponse(req, 500, { success: false, error: getErrorMessage(error) })
  }
})
