import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type AdminCompanyRow = Database['public']['Tables']['companies']['Row']
export type AdminCompanyRecord = AdminCompanyRow & {
  userCount: number
  transactionCount: number
  plan?: {
    id: string
    name: string
    display_name: string
    price: number
    currency: string
  } | null
}

export type AdminProfileRow = Database['public']['Tables']['profiles']['Row'] & {
  company?: {
    name?: string | null
  } | null
}

export type AdminActivityLog = Database['public']['Tables']['activity_logs']['Row'] & {
  actor?: {
    full_name?: string | null
    email?: string | null
    role?: string | null
  } | null
}

type CompanyReferenceRow = Pick<Database['public']['Tables']['profiles']['Row'], 'company_id'>
type TransactionReferenceRow = Pick<Database['public']['Tables']['transactions']['Row'], 'company_id'>
type ActivityRow = Database['public']['Tables']['activity_logs']['Row']
type PlanRow = Pick<Database['public']['Tables']['subscription_plans']['Row'], 'id' | 'name' | 'display_name' | 'price' | 'currency'>
type ActorRow = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'email' | 'role'>

type CompanyWithPlan = AdminCompanyRow & {
  subscription_plans: PlanRow | null
}

function buildCountMap(rows?: ReadonlyArray<{ company_id: string | null }> | null) {
  const map = new Map<string, number>()
  rows?.forEach((row) => {
    if (!row.company_id) return
    map.set(row.company_id, (map.get(row.company_id) ?? 0) + 1)
  })
  return map
}

export async function fetchAdminCompanies(): Promise<AdminCompanyRecord[]> {
  const { data, error } = await supabase
    .from('companies')
    .select(`
      id, 
      name, 
      logo_url, 
      is_active, 
      plan_id,
      subscription_status,
      is_trial,
      created_at, 
      updated_at,
      subscription_plans (
        id,
        name,
        display_name,
        price,
        currency
      )
    `)
    .order('created_at', { ascending: false })
    .returns<CompanyWithPlan[]>()

  if (error) {
    throw error
  }

  const [{ data: profileRows, error: profileError }, { data: transactionRows, error: transactionError }] = await Promise.all([
    supabase.from('profiles').select('company_id').returns<CompanyReferenceRow[]>(),
    supabase.from('transactions').select('company_id').returns<TransactionReferenceRow[]>(),
  ])

  if (profileError) {
    throw profileError
  }
  if (transactionError) {
    throw transactionError
  }

  const userCounts = buildCountMap(profileRows)
  const transactionCounts = buildCountMap(transactionRows)

  const safeCompanies = (data ?? []).filter(
    (company) => typeof company.id === 'string' && company.id.trim().length > 0
  )

  return safeCompanies.map((company) => ({
    ...company,
    userCount: userCounts.get(company.id) ?? 0,
    transactionCount: transactionCounts.get(company.id) ?? 0,
    plan: company.subscription_plans ?? null,
  }))
}

export async function fetchAdminProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, company_id, role, is_blocked, created_at, updated_at, company:companies(name)')
    .order('created_at', { ascending: false })
    .returns<AdminProfileRow[]>()

  if (error) {
    throw error
  }

  return data ?? []
}

export async function fetchSystemActivityLogs(limit = 12): Promise<AdminActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, actor_id, action_type, description, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<ActivityRow[]>()

  if (error) {
    throw error
  }

  const logs = (data ?? []).filter(
    (log): log is ActivityRow => typeof log.id === 'string' && log.id.trim().length > 0
  )

  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => log.actor_id || log.user_id)
        .filter((id): id is string => Boolean(id && id.trim().length))
    )
  )

  const actorMap = new Map<string, { full_name?: string | null; email?: string | null; role?: string | null }>()
  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', actorIds)

    if (!actorError) {
      (actors ?? []).forEach((actor: ActorRow) => {
        if (actor.id) {
          actorMap.set(actor.id, { 
            full_name: actor.full_name, 
            email: actor.email,
            role: actor.role 
          })
        }
      })
    }
  }

  return logs.map((log) => {
    const actorId = log.actor_id || log.user_id
    return {
      id: log.id,
      user_id: log.user_id,
      actor_id: log.actor_id,
      action_type: log.action_type,
      description: log.description,
      message: log.message,
      metadata: log.metadata,
      created_at: log.created_at,
      actor: actorId ? actorMap.get(actorId) ?? null : null,
    }
  })
}

export async function fetchSystemUptimeSeconds(): Promise<number | null> {
  const { data: oldestLog, error } = await supabase
    .from('activity_logs')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return null
  }

  if (!oldestLog?.created_at) {
    return null
  }

  const firstTimestamp = new Date(oldestLog.created_at).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - firstTimestamp) / 1000))
}
