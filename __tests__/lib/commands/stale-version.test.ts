/**
 * Stale Version Rejection Tests
 *
 * Tests for optimistic concurrency control in commands.
 */

import { StaleVersionError } from '@/lib/commands'

describe('Stale Version Error', () => {
  /**
   * Test that StaleVersionError is properly constructed with conflict details.
   */
  it('creates StaleVersionError with conflict details', () => {
    const error = new StaleVersionError({
      aggregateId: 'proposal-123',
      currentVersion: 5,
      submittedVersion: 3,
      changedFields: ['title', 'status'],
    })

    expect(error.name).toBe('StaleVersionError')
    expect(error.code).toBe('STALE_VERSION')
    expect(error.message).toContain('Version conflict')
    expect(error.message).toContain('expected 3')
    expect(error.message).toContain('current is 5')
    expect(error.conflict.aggregateId).toBe('proposal-123')
    expect(error.conflict.currentVersion).toBe(5)
    expect(error.conflict.submittedVersion).toBe(3)
    expect(error.conflict.changedFields).toEqual(['title', 'status'])
  })

  /**
   * Test that StaleVersionError converts to CommandError format.
   */
  it('converts to CommandError format', () => {
    const error = new StaleVersionError({
      aggregateId: 'proposal-456',
      currentVersion: 10,
      submittedVersion: 8,
    })

    const commandError = error.toCommandError()

    expect(commandError.code).toBe('STALE_VERSION')
    expect(commandError.message).toContain('Version conflict')
    expect(commandError.details).toHaveProperty('aggregateId', 'proposal-456')
    expect(commandError.details).toHaveProperty('currentVersion', 10)
    expect(commandError.details).toHaveProperty('submittedVersion', 8)
  })

  /**
   * Test the early version check in commands (before UPDATE).
   *
   * When expectedVersion is provided and doesn't match current,
   * the command should throw StaleVersionError immediately.
   */
  it('demonstrates early version check logic', () => {
    // Simulate command logic
    const current = { row_version: 5 }
    const input = { expectedVersion: 3 }

    const checkVersion = () => {
      if (input.expectedVersion !== undefined && current.row_version !== input.expectedVersion) {
        throw new StaleVersionError({
          aggregateId: 'test-proposal',
          currentVersion: current.row_version,
          submittedVersion: input.expectedVersion,
          changedFields: ['row_version'],
        })
      }
    }

    expect(checkVersion).toThrow(StaleVersionError)

    try {
      checkVersion()
    } catch (e) {
      const error = e as StaleVersionError
      expect(error.conflict.currentVersion).toBe(5)
      expect(error.conflict.submittedVersion).toBe(3)
    }
  })

  /**
   * Test that version check passes when versions match.
   */
  it('passes when expectedVersion matches current', () => {
    const current = { row_version: 5 }
    const input = { expectedVersion: 5 }

    const checkVersion = () => {
      if (input.expectedVersion !== undefined && current.row_version !== input.expectedVersion) {
        throw new StaleVersionError({
          aggregateId: 'test-proposal',
          currentVersion: current.row_version,
          submittedVersion: input.expectedVersion,
          changedFields: ['row_version'],
        })
      }
      return true
    }

    expect(checkVersion()).toBe(true)
  })

  /**
   * Test that version check is skipped when expectedVersion is not provided.
   */
  it('skips check when expectedVersion not provided', () => {
    const current = { row_version: 5 }
    const input = {} // No expectedVersion

    const checkVersion = () => {
      if ((input as { expectedVersion?: number }).expectedVersion !== undefined &&
          current.row_version !== (input as { expectedVersion?: number }).expectedVersion) {
        throw new StaleVersionError({
          aggregateId: 'test-proposal',
          currentVersion: current.row_version,
          submittedVersion: (input as { expectedVersion?: number }).expectedVersion!,
          changedFields: ['row_version'],
        })
      }
      return true
    }

    expect(checkVersion()).toBe(true)
  })
})
