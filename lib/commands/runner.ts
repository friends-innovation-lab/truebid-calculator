/**
 * Command Runner
 *
 * Orchestrates command execution with authentication, authorization,
 * validation, and audit logging.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTenantContext, hasRole } from '@/lib/tenancy'
import type { TenantContext } from '@/lib/tenancy'
import type {
  Command,
  CommandContext,
  CommandResult,
  AuditEventRecord,
} from './types'
import { CommandExecutionError, ForbiddenError } from './errors'

/**
 * Run a command with full lifecycle:
 * 1. Authenticate (via Supabase session)
 * 2. Resolve tenant + membership
 * 3. Authorize against command's allowed roles
 * 4. Execute command
 * 5. Persist audit event
 *
 * @param supabase - Authenticated Supabase client
 * @param command - The command to execute
 * @param input - Command input
 * @param options - Optional execution options
 * @returns Command result
 */
export async function runCommand<TInput, TOutput>(
  supabase: SupabaseClient,
  command: Command<TInput, TOutput>,
  input: TInput,
  options?: {
    correlationId?: string
    actorType?: 'user' | 'system' | 'ai_job'
    actorId?: string
  }
): Promise<CommandResult<TOutput>> {
  const correlationId = options?.correlationId ?? crypto.randomUUID()

  try {
    // Step 1 & 2: Authenticate and resolve tenant
    const tenantContext = await resolveTenantContext(supabase)

    // Step 3: Authorize
    if (!hasRole(tenantContext, command.allowedRoles)) {
      throw new ForbiddenError(
        command.allowedRoles,
        tenantContext.membership.role
      )
    }

    // Build command context
    const context: CommandContext = {
      tenant: tenantContext,
      correlationId,
      actorType: options?.actorType ?? 'user',
      actorId: options?.actorId ?? tenantContext.userId,
    }

    // Step 4: Execute command
    const result = await command.execute(context, input)

    return result
  } catch (error) {
    // Convert known errors to CommandResult
    if (error instanceof CommandExecutionError) {
      return {
        success: false,
        error: error.toCommandError(),
      }
    }

    // Handle auth/tenant errors
    if (error instanceof Error) {
      const code = error.name === 'NoTenantError' ? 'UNAUTHORIZED'
        : error.name === 'TenantSuspendedError' ? 'FORBIDDEN'
        : 'INTERNAL_ERROR'

      return {
        success: false,
        error: {
          code,
          message: error.message,
        },
      }
    }

    // Unknown error
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Write an audit event to the database.
 */
export async function writeAuditEvent(
  supabase: SupabaseClient,
  event: AuditEventRecord
): Promise<string | null> {
  const { data, error } = await supabase
    .from('audit_events')
    .insert({
      tenant_id: event.tenantId,
      actor_type: event.actorType,
      actor_id: event.actorId,
      command_name: event.commandName,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      before_version: event.beforeVersion,
      after_version: event.afterVersion,
      changed_fields: event.changedFields,
      command_input: event.commandInput,
      correlation_id: event.correlationId,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[CommandRunner] Failed to write audit event:', error)
    return null
  }

  return data?.id ?? null
}

/**
 * Helper to detect changed fields between two objects.
 */
export function detectChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const field of fields) {
    const oldVal = before[field]
    const newVal = after[field]

    // Simple equality check (works for primitives, not deep objects)
    if (oldVal !== newVal) {
      changes[field] = { old: oldVal, new: newVal }
    }
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Create a command context for system operations (background jobs, etc).
 */
export function createSystemContext(
  tenant: TenantContext,
  correlationId?: string
): CommandContext {
  return {
    tenant,
    correlationId: correlationId ?? crypto.randomUUID(),
    actorType: 'system',
    actorId: 'system',
  }
}
