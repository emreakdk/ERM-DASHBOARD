import { supabase } from './supabase'

export type ActivityAction =
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_blocked'
  | 'user_unblocked'
  | 'company_created'
  | 'company_updated'
  | 'company_status_changed'
  | 'password_reset'
  | 'role_changed'
  | 'permission_updated'
  | 'quota_updated'

interface LogActivityParams {
  actorId: string
  actionType: ActivityAction
  description: string
  metadata?: Record<string, any>
}

/**
 * Helper function to log activities to the activity_logs table
 * @param params - Activity log parameters
 * @returns Promise with the created log ID or error
 */
export async function logActivity(params: LogActivityParams): Promise<{ id?: string; error?: Error }> {
  try {
    const { actorId, actionType, description, metadata = {} } = params

    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: actorId,
        actor_id: actorId,
        action_type: actionType,
        description,
        message: description,
        metadata,
      })
      .select('id')
      .single()

    if (error) {
      return { error: new Error(error.message) }
    }

    return { id: data?.id }
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Unknown error') }
  }
}

/**
 * Helper function to log system errors to the system_errors table
 * @param errorCode - HTTP error code or custom error code
 * @param errorMessage - Error message
 * @param errorSource - Source of the error (e.g., 'edge_function', 'frontend')
 * @param requestPath - Optional request path
 * @param userId - Optional user ID
 * @param metadata - Optional additional metadata
 */
export async function logSystemError(
  errorCode: string,
  errorMessage: string,
  errorSource?: string,
  requestPath?: string,
  userId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('system_errors').insert({
      error_code: errorCode,
      error_message: errorMessage,
      error_source: errorSource,
      request_path: requestPath,
      user_id: userId,
      metadata: metadata || {},
    })
  } catch (err) {
    // Silent error handling
  }
}

/**
 * Format activity description with actor name
 * @param actorName - Name of the actor
 * @param action - Action performed
 * @param target - Target of the action
 * @returns Formatted description
 */
export function formatActivityDescription(actorName: string, action: string, target: string): string {
  return `${actorName} ${action} ${target}`
}
