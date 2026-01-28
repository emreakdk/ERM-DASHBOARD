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
      function_name: 'admin-delete-user',
      severity: errorCode.startsWith('5') ? 'critical' : errorCode.startsWith('4') ? 'error' : 'warning',
    })
  } catch (logError) {
    console.error('[admin-delete-user] Failed to log error:', logError)
  }
}

serve(async (req: Request) => {
  console.log('[admin-delete-user] Incoming request', { method: req.method, origin: req.headers.get('origin') })
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
      console.log('[admin-delete-user] Decoded token', { userId })
    } catch (e) {
      console.error('[admin-delete-user] Token decode error', e)
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

    console.log('[admin-delete-user] Profile lookup', { userId, profile, error: profileError?.message })

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
      return jsonResponse(req, 403, { success: false, error: `Only superadmins can delete users. Your role: ${profile.role}` })
    }

    console.log('[admin-delete-user] Authorization successful', { userId, email: profile.email, role: profile.role })

    let body: { userId?: string }
    try {
      body = await req.json()
    } catch (jsonError) {
      await logSystemError(supabaseAdmin, '400', 'Invalid JSON body', { error: getErrorMessage(jsonError) }, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'Invalid JSON body' })
    }

    if (!body.userId) {
      await logSystemError(supabaseAdmin, '400', 'User ID is required', {}, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'User ID is required' })
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.userId)

    if (deleteError) {
      await logSystemError(supabaseAdmin, '400', 'Failed to delete user', { targetUserId: body.userId, error: deleteError.message }, null, userId)
      return jsonResponse(req, 400, {
        success: false,
        error: deleteError.message ?? 'Failed to delete user',
      })
    }

    return jsonResponse(req, 200, { success: true })
  } catch (error) {
    console.error('[admin-delete-user] Unhandled error', error)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
        await logSystemError(supabaseAdmin, '500', 'Unhandled error in admin-delete-user', { error: getErrorMessage(error) })
      }
    } catch (logErr) {
      console.error('[admin-delete-user] Failed to log unhandled error:', logErr)
    }
    return jsonResponse(req, 500, { success: false, error: getErrorMessage(error) })
  }
})
