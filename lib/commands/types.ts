/**
 * Command Layer Types
 *
 * Type definitions for the command pattern implementation.
 */

import type { TenantContext, TenantRole } from '@/lib/tenancy'

/**
 * Context passed to every command execution.
 */
export interface CommandContext {
  /** Resolved tenant context with user's membership */
  tenant: TenantContext
  /** Correlation ID for distributed tracing */
  correlationId: string
  /** Actor type for audit events */
  actorType: 'user' | 'system' | 'ai_job'
  /** Actor ID (user ID, 'system', or job ID) */
  actorId: string
}

/**
 * Result returned from command execution.
 */
export interface CommandResult<T = unknown> {
  /** Whether the command succeeded */
  success: boolean
  /** The returned data on success */
  data?: T
  /** Error information on failure */
  error?: CommandError
  /** Audit event ID for tracking */
  auditEventId?: string
}

/**
 * Error information from command execution.
 */
export interface CommandError {
  /** Error code for programmatic handling */
  code: CommandErrorCode
  /** Human-readable message */
  message: string
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Standard error codes for commands.
 */
export type CommandErrorCode =
  | 'UNAUTHORIZED' // User not authenticated
  | 'FORBIDDEN' // User lacks required role
  | 'NOT_FOUND' // Aggregate not found
  | 'STALE_VERSION' // Optimistic concurrency conflict
  | 'VALIDATION_FAILED' // Input validation failed
  | 'INVALID_STATE' // Aggregate in wrong state for operation
  | 'INTERNAL_ERROR' // Unexpected error
  | 'STAFFING_MODEL_UNCLEAR' // Pillar 2: Cannot confirm until staffing model resolved
  | 'CITATION_INCOMPLETE' // Phase 6B: wbs_estimate lines lack requirement links
  | 'CONSERVATION_FAILED' // Phase 6B: cost + fee ≠ total (should never happen)

/**
 * Optimistic concurrency conflict details.
 */
export interface StaleVersionDetails {
  aggregateId: string
  currentVersion: number
  submittedVersion: number
  changedFields?: string[]
}

/**
 * Base interface for all commands.
 */
export interface Command<TInput, TOutput> {
  /** Unique name for this command type */
  readonly name: string
  /** Aggregate type this command operates on */
  readonly aggregateType: string
  /** Roles allowed to execute this command */
  readonly allowedRoles: TenantRole[]
  /** Execute the command */
  execute(context: CommandContext, input: TInput): Promise<CommandResult<TOutput>>
}

/**
 * Audit event record to be persisted.
 */
export interface AuditEventRecord {
  tenantId: string
  actorType: 'user' | 'system' | 'ai_job'
  actorId: string
  commandName: string
  aggregateType: string
  aggregateId: string
  beforeVersion: number | null
  afterVersion: number
  changedFields: Record<string, { old: unknown; new: unknown }> | null
  commandInput: Record<string, unknown> | null
  correlationId: string | null
}

/**
 * Input type with optional version for optimistic concurrency.
 */
export interface VersionedInput {
  /** Expected version of the aggregate (for optimistic concurrency) */
  expectedVersion?: number
}
