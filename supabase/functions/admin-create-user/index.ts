import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export const config = {
  runtime: 'edge',
  verify_jwt: false,
}

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
  if (error instanceof Error) {
    return error.message
  }
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
      function_name: 'admin-create-user',
      severity: errorCode.startsWith('5') ? 'critical' : errorCode.startsWith('4') ? 'error' : 'warning',
    })
  } catch (logError) {
    console.error('[admin-create-user] Failed to log error:', logError)
  }
}

serve(async (req: Request) => {
  console.log('[admin-create-user] Incoming request', { method: req.method, origin: req.headers.get('origin') })
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[admin-create-user] Missing environment variables')
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
    
    // Decode JWT to get user ID (without verification since we'll check DB directly)
    let userId: string
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub
      console.log('[admin-create-user] Decoded token', { userId, payload })
    } catch (e) {
      console.error('[admin-create-user] Token decode error', e)
      await logSystemError(supabaseAdmin, '401', 'Invalid token format', { error: getErrorMessage(e) })
      return jsonResponse(req, 401, { success: false, error: 'Invalid token format' })
    }

    if (!userId) {
      return jsonResponse(req, 401, { success: false, error: 'User ID not found in token' })
    }

    // Verify user exists and is superadmin by checking profiles table directly
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_blocked, email')
      .eq('id', userId)
      .single()

    console.log('[admin-create-user] Profile lookup', { 
      userId, 
      profile, 
      error: profileError?.message 
    })

    if (profileError || !profile) {
      await logSystemError(supabaseAdmin, '401', 'User profile not found', { userId, error: profileError?.message }, null, userId)
      return jsonResponse(req, 401, { success: false, error: 'User profile not found' })
    }

    if (profile.is_blocked) {
      await logSystemError(supabaseAdmin, '403', 'User account is blocked', { userId, email: profile.email }, null, userId)
      return jsonResponse(req, 403, { success: false, error: 'User account is blocked' })
    }

    if (!['superadmin', 'admin'].includes((profile.role ?? '').toLowerCase())) {
      await logSystemError(supabaseAdmin, '403', 'Insufficient permissions', { userId, role: profile.role, required: 'admin or superadmin' }, null, userId)
      return jsonResponse(req, 403, { 
        success: false, 
        error: `Only superadmins and admins can create users. Your role: ${profile.role}` 
      })
    }

    console.log('[admin-create-user] Authorization successful', { 
      userId, 
      email: profile.email,
      role: profile.role 
    })

    let body: {
      email?: string
      password?: string
      full_name?: string | null
      company_id?: string | null
      role?: string
    }
    try {
      body = await req.json()
    } catch (jsonError) {
      await logSystemError(supabaseAdmin, '400', 'Invalid JSON body', { error: getErrorMessage(jsonError) }, null, userId)
      return jsonResponse(req, 400, { success: false, error: 'Invalid JSON body' })
    }

    const { email, password, full_name, company_id, role } = body

    if (!email || !password) {
      await logSystemError(supabaseAdmin, '400', 'Email and password are required', { hasEmail: !!email, hasPassword: !!password }, company_id, userId)
      return jsonResponse(req, 400, { success: false, error: 'Email and password are required' })
    }

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    })

    if (authError || !authData?.user) {
      await logSystemError(supabaseAdmin, '400', 'Failed to create auth user', { email, error: authError?.message }, company_id, userId)
      return jsonResponse(req, 400, {
        success: false,
        error: authError?.message ?? 'Failed to create auth user',
      })
    }

    const { data: updatedProfile, error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: authData.user.id,
          email,
          full_name: full_name || null,
          company_id: company_id || null,
          role: (role as 'admin' | 'user' | 'superadmin') ?? 'user',
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (upsertError) {
      await logSystemError(supabaseAdmin, '400', 'Failed to update profile', { email, newUserId: authData.user.id, error: upsertError.message }, company_id, userId)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return jsonResponse(req, 400, {
        success: false,
        error: upsertError.message ?? 'Failed to update profile',
      })
    }

    return jsonResponse(req, 200, {
      success: true,
      profile: updatedProfile,
    })
  } catch (error) {
    console.error('[admin-create-user] Unhandled error', error)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
        await logSystemError(supabaseAdmin, '500', 'Unhandled error in admin-create-user', { error: getErrorMessage(error) })
      }
    } catch (logErr) {
      console.error('[admin-create-user] Failed to log unhandled error:', logErr)
    }
    return jsonResponse(req, 500, {
      success: false,
      error: getErrorMessage(error),
    })
  }
})
