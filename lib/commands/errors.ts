/**
 * Command Layer Errors
 *
 * Typed errors for command execution.
 */

import type { CommandError, CommandErrorCode, StaleVersionDetails } from './types'

/**
 * Base error class for command failures.
 */
export class CommandExecutionError extends Error {
  constructor(
    public readonly code: CommandErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'CommandExecutionError'
  }

  toCommandError(): CommandError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

/**
 * Thrown when optimistic concurrency check fails.
 */
export class StaleVersionError extends CommandExecutionError {
  constructor(
    public readonly conflict: StaleVersionDetails
  ) {
    super(
      'STALE_VERSION',
      `Version conflict: expected ${conflict.submittedVersion}, current is ${conflict.currentVersion}`,
      conflict as unknown as Record<string, unknown>
    )
    this.name = 'StaleVersionError'
  }
}

/**
 * Thrown when user lacks required role.
 */
export class ForbiddenError extends CommandExecutionError {
  constructor(
    requiredRoles: string[],
    actualRole: string
  ) {
    super(
      'FORBIDDEN',
      `Requires one of [${requiredRoles.join(', ')}], user has [${actualRole}]`,
      { requiredRoles, actualRole }
    )
    this.name = 'ForbiddenError'
  }
}

/**
 * Thrown when aggregate is not found.
 */
export class NotFoundError extends CommandExecutionError {
  constructor(
    aggregateType: string,
    aggregateId: string
  ) {
    super(
      'NOT_FOUND',
      `${aggregateType} ${aggregateId} not found`,
      { aggregateType, aggregateId }
    )
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when input validation fails.
 */
export class ValidationError extends CommandExecutionError {
  constructor(
    message: string,
    public readonly violations: Record<string, string>
  ) {
    super(
      'VALIDATION_FAILED',
      message,
      { violations }
    )
    this.name = 'ValidationError'
  }
}

/**
 * Thrown when aggregate is in wrong state for the operation.
 */
export class InvalidStateError extends CommandExecutionError {
  constructor(
    message: string,
    currentState?: string,
    requiredState?: string
  ) {
    super(
      'INVALID_STATE',
      message,
      { currentState, requiredState }
    )
    this.name = 'InvalidStateError'
  }
}
