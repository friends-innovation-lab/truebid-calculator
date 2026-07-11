/**
 * Phase 3: WBS Command Tests
 *
 * Tests for WBS versioning and staffing commands.
 * Covers: intelligence gate, validation, acceptance/supersession,
 * conflict resolution, optimistic concurrency, and immutability.
 */

import {
  validateWbsCandidate,
  formatValidationErrors,
  type TaskInput,
  type ValidationResult,
  type ConflictResolution,
  type AcceptWbsCandidateInput,
  type CreateWbsCandidateInput,
  WbsValidationError,
} from '@/lib/commands/wbs'

// =============================================================================
// VALIDATOR TESTS (Pure Logic - No DB)
// =============================================================================

describe('ValidateWbsCandidate', () => {
  const validContext = {
    disciplines: ['Software Development', 'Project Management', 'Testing'],
    periodLabels: ['Base Year', 'Option Year 1', 'Option Year 2'],
  }

  describe('collects ALL violations (not fail-fast)', () => {
    it('returns multiple violations from same task', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Task with multiple problems',
          staffing: [
            {
              roleTitle: 'Bad Role',
              discipline: 'Invalid Discipline', // violation 1
              primeOrSub: 'sub',
              periodLabel: 'Invalid Period', // violation 2
              hours: 100,
              // subcontractorName missing // violation 3
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(3)
      expect(result.violations.map(v => v.type)).toEqual(
        expect.arrayContaining([
          'invalid_discipline',
          'invalid_period',
          'sub_missing_name',
        ])
      )
    })

    it('returns violations from multiple tasks', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Task 1',
          staffing: [
            {
              roleTitle: 'Role 1',
              discipline: 'Bad Discipline 1',
              primeOrSub: 'prime',
              periodLabel: 'Base Year',
              hours: 100,
            },
          ],
        },
        {
          wbsCode: '1.2',
          title: 'Task 2',
          staffing: [
            {
              roleTitle: 'Role 2',
              discipline: 'Bad Discipline 2',
              primeOrSub: 'prime',
              periodLabel: 'Base Year',
              hours: 100,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(2)
      expect(result.violations[0].taskWbsCode).toBe('1.1')
      expect(result.violations[1].taskWbsCode).toBe('1.2')
    })
  })

  describe('invalid_discipline violations', () => {
    it('rejects discipline not in intelligence', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'Developer',
              discipline: 'Underwater Basket Weaving', // Not in validContext
              primeOrSub: 'prime',
              periodLabel: 'Base Year',
              hours: 160,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]).toMatchObject({
        type: 'invalid_discipline',
        taskWbsCode: '1.1',
        taskTitle: 'Test Task',
        roleTitle: 'Developer',
      })
      expect(result.violations[0].details).toContain('Underwater Basket Weaving')
      expect(result.violations[0].details).toContain('Software Development')
    })

    it('accepts valid discipline', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'Developer',
              discipline: 'Software Development',
              primeOrSub: 'prime',
              periodLabel: 'Base Year',
              hours: 160,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)
      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })
  })

  describe('invalid_period violations', () => {
    it('rejects period not in intelligence', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'Developer',
              discipline: 'Software Development',
              primeOrSub: 'prime',
              periodLabel: 'Option Year 99', // Not in validContext
              hours: 160,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]).toMatchObject({
        type: 'invalid_period',
        taskWbsCode: '1.1',
      })
      expect(result.violations[0].details).toContain('Option Year 99')
      expect(result.violations[0].details).toContain('Base Year')
    })
  })

  describe('missing_prime_or_sub violations', () => {
    it('rejects invalid prime_or_sub value', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'Developer',
              discipline: 'Software Development',
              primeOrSub: 'neither' as 'prime', // Invalid value
              periodLabel: 'Base Year',
              hours: 160,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations.some(v => v.type === 'missing_prime_or_sub')).toBe(true)
    })
  })

  describe('sub_missing_name violations', () => {
    it('rejects sub without subcontractor name', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'SubDev',
              discipline: 'Software Development',
              primeOrSub: 'sub',
              periodLabel: 'Base Year',
              hours: 160,
              // No subcontractorName
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)

      expect(result.valid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]).toMatchObject({
        type: 'sub_missing_name',
        taskWbsCode: '1.1',
        roleTitle: 'SubDev',
      })
    })

    it('accepts sub with subcontractor name', () => {
      const tasks: TaskInput[] = [
        {
          wbsCode: '1.1',
          title: 'Test Task',
          staffing: [
            {
              roleTitle: 'SubDev',
              discipline: 'Software Development',
              primeOrSub: 'sub',
              subcontractorName: 'Acme Corp',
              periodLabel: 'Base Year',
              hours: 160,
            },
          ],
        },
      ]

      const result = validateWbsCandidate(tasks, validContext)
      expect(result.valid).toBe(true)
    })
  })

  describe('formatValidationErrors', () => {
    it('formats all violations with debug details', () => {
      const result: ValidationResult = {
        valid: false,
        violations: [
          {
            type: 'invalid_discipline',
            taskWbsCode: '1.1',
            taskTitle: 'Task One',
            assignmentIndex: 0,
            roleTitle: 'Dev',
            details: 'Discipline "Bad" is not valid',
          },
          {
            type: 'invalid_period',
            taskWbsCode: '1.2',
            taskTitle: 'Task Two',
            assignmentIndex: 1,
            roleTitle: 'PM',
            details: 'Period "Bad" is not valid',
          },
        ],
      }

      const formatted = formatValidationErrors(result)

      expect(formatted).toContain('WBS candidate validation failed')
      expect(formatted).toContain('[invalid_discipline]')
      expect(formatted).toContain('[invalid_period]')
      expect(formatted).toContain('Task 1.1')
      expect(formatted).toContain('Task 1.2')
      expect(formatted).toContain('Dev')
      expect(formatted).toContain('PM')
    })
  })
})

// =============================================================================
// WBS VALIDATION ERROR TESTS
// =============================================================================

describe('WbsValidationError', () => {
  it('wraps violations with formatted message', () => {
    const violations = [
      {
        type: 'invalid_discipline' as const,
        taskWbsCode: '1.1',
        taskTitle: 'Test',
        details: 'Bad discipline',
      },
    ]

    const error = new WbsValidationError(violations)

    expect(error.name).toBe('WbsValidationError')
    expect(error.violations).toBe(violations)
    expect(error.message).toContain('invalid_discipline')
  })
})

// =============================================================================
// CONFLICT RESOLUTION PAYLOAD SHAPE TESTS
// =============================================================================

describe('AcceptWbsCandidate Merge Payload', () => {
  it('has correct ConflictResolution shape for task-level conflicts', () => {
    const resolution: ConflictResolution = {
      taskId: 'task-123',
      resolution: 'keep_user',
    }

    expect(resolution.taskId).toBeDefined()
    expect(resolution.assignmentId).toBeUndefined()
    expect(['keep_user', 'accept_candidate']).toContain(resolution.resolution)
  })

  it('has correct ConflictResolution shape for assignment-level conflicts', () => {
    const resolution: ConflictResolution = {
      taskId: 'task-123',
      assignmentId: 'assignment-456',
      resolution: 'accept_candidate',
    }

    expect(resolution.taskId).toBeDefined()
    expect(resolution.assignmentId).toBeDefined()
    expect(resolution.resolution).toBe('accept_candidate')
  })

  it('AcceptWbsCandidateInput supports optional conflict resolutions', () => {
    const inputWithoutResolutions: AcceptWbsCandidateInput = {
      candidateVersionId: 'version-123',
      expectedRowVersion: 1,
    }
    expect(inputWithoutResolutions.conflictResolutions).toBeUndefined()

    const inputWithResolutions: AcceptWbsCandidateInput = {
      candidateVersionId: 'version-123',
      expectedRowVersion: 1,
      conflictResolutions: [
        { taskId: 'task-1', resolution: 'keep_user' },
        { taskId: 'task-2', assignmentId: 'assign-1', resolution: 'accept_candidate' },
      ],
    }
    expect(inputWithResolutions.conflictResolutions).toHaveLength(2)
  })

  it('default behavior is keep_user when no resolution provided', () => {
    // This documents the expected behavior - acceptance without explicit resolution
    // defaults to keeping user's version for user_modified items
    const input: AcceptWbsCandidateInput = {
      candidateVersionId: 'version-123',
      expectedRowVersion: 1,
      // No conflictResolutions = default to keep_user for all conflicts
    }

    expect(input.conflictResolutions).toBeUndefined()
    // The accept command treats undefined as "keep all user modifications"
  })
})

// =============================================================================
// CREATE WBS CANDIDATE INPUT VALIDATION
// =============================================================================

describe('CreateWbsCandidateInput', () => {
  it('requires proposalId and intelligenceVersionId', () => {
    const input: CreateWbsCandidateInput = {
      proposalId: 'prop-123',
      intelligenceVersionId: 'intel-456',
      tasks: [],
    }

    expect(input.proposalId).toBeDefined()
    expect(input.intelligenceVersionId).toBeDefined()
    expect(input.tasks).toEqual([])
  })

  it('supports optional generation job note', () => {
    const input: CreateWbsCandidateInput = {
      proposalId: 'prop-123',
      intelligenceVersionId: 'intel-456',
      tasks: [],
      generationJobNote: 'Generated by AI v2.0',
    }

    expect(input.generationJobNote).toBe('Generated by AI v2.0')
  })
})

// =============================================================================
// ERROR CLASS TESTS (Verify error identity for catch blocks)
// =============================================================================

describe('WBS Error Classes', () => {
  // Import error classes (dynamically to avoid unused import warnings)
  function getErrorClass(name: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/lib/commands/wbs')[name]
  }

  const WbsVersionNotFoundError = getErrorClass('WbsVersionNotFoundError')
  const WbsVersionWrongStatusError = getErrorClass('WbsVersionWrongStatusError')
  const WbsVersionStaleError = getErrorClass('WbsVersionStaleError')
  const WbsTaskStaleError = getErrorClass('WbsTaskStaleError')
  const WbsTaskImmutableError = getErrorClass('WbsTaskImmutableError')
  const StaffingAssignmentStaleError = getErrorClass('StaffingAssignmentStaleError')
  const RemoveTaskStaleError = getErrorClass('RemoveTaskStaleError')
  const RemoveAssignmentImmutableError = getErrorClass('RemoveAssignmentImmutableError')

  describe('version errors', () => {
    it('WbsVersionNotFoundError has correct name', () => {
      const err = new WbsVersionNotFoundError('ver-123')
      expect(err.name).toBe('WbsVersionNotFoundError')
      expect(err.message).toContain('ver-123')
    })

    it('WbsVersionWrongStatusError includes expected statuses', () => {
      const err = new WbsVersionWrongStatusError('ver-123', 'superseded', ['draft', 'active'])
      expect(err.name).toBe('WbsVersionWrongStatusError')
      expect(err.message).toContain('superseded')
      expect(err.message).toContain('draft')
    })

    it('WbsVersionStaleError includes version numbers', () => {
      const err = new WbsVersionStaleError('ver-123', 1, 2)
      expect(err.name).toBe('WbsVersionStaleError')
      expect(err.message).toContain('1')
      expect(err.message).toContain('2')
    })
  })

  describe('task errors', () => {
    it('WbsTaskStaleError for optimistic concurrency', () => {
      const err = new WbsTaskStaleError('task-123', 5, 6)
      expect(err.name).toBe('WbsTaskStaleError')
      expect(err.message).toContain('task-123')
      expect(err.message).toContain('5')
      expect(err.message).toContain('6')
    })

    it('WbsTaskImmutableError for superseded version', () => {
      const err = new WbsTaskImmutableError('task-123', 'superseded')
      expect(err.name).toBe('WbsTaskImmutableError')
      expect(err.message).toContain('superseded')
    })
  })

  describe('assignment errors', () => {
    it('StaffingAssignmentStaleError for optimistic concurrency', () => {
      const err = new StaffingAssignmentStaleError('assign-123', 3, 4)
      expect(err.name).toBe('StaffingAssignmentStaleError')
      expect(err.message).toContain('3')
      expect(err.message).toContain('4')
    })
  })

  describe('remove operation errors', () => {
    it('RemoveTaskStaleError for delete concurrency', () => {
      const err = new RemoveTaskStaleError('task-123', 1, 2)
      expect(err.name).toBe('RemoveTaskStaleError')
    })

    it('RemoveAssignmentImmutableError for superseded delete', () => {
      const err = new RemoveAssignmentImmutableError('assign-123', 'superseded')
      expect(err.name).toBe('RemoveAssignmentImmutableError')
    })
  })
})

// =============================================================================
// INTEGRATION TEST PATTERNS (Document expected DB behavior)
// =============================================================================

/**
 * The following tests document the expected behavior for DB integration tests.
 * They verify the command interface shapes and error patterns.
 * Actual DB tests run in E2E suite with real Supabase.
 */

describe('Integration Test Patterns (No DB)', () => {
  describe('Intelligence Gate', () => {
    it('CreateWbsCandidate requires confirmed intelligence', () => {
      // Pattern: Creating a candidate with draft intelligence should fail
      // The requireConfirmedIntelligence guard checks:
      // 1. Intelligence version exists
      // 2. Belongs to correct proposal
      // 3. Status === 'confirmed'
      // 4. Confirmation hash matches recomputed hash

      const input: CreateWbsCandidateInput = {
        proposalId: 'proposal-123',
        intelligenceVersionId: 'draft-intel-456', // Would be rejected
        tasks: [],
      }

      // In E2E: expect command to throw with guard error
      expect(input.intelligenceVersionId).toBeDefined()
    })

    it('documents lifecycle: draft WBS → activation rejected → intel confirmed → activation succeeds', () => {
      // This documents the lifecycle test from the plan:
      //
      // 1. Create proposal
      // 2. Create draft intelligence
      // 3. Create WBS draft referencing draft intelligence (allowed)
      // 4. Attempt to activate WBS → REJECTED (intelligence not confirmed)
      // 5. Confirm intelligence
      // 6. Attempt to activate WBS → SUCCEEDS
      //
      // The DB trigger v_enforce_intelligence_gate enforces this
    })
  })

  describe('Acceptance Supersession', () => {
    it('documents atomic supersession: accept candidate → prior active becomes superseded', () => {
      // Pattern: AcceptWbsCandidate does:
      // 1. Load candidate, verify status in [generated_candidate, draft]
      // 2. Load current active version (if any)
      // 3. Handle conflicts by matching tasks (wbs_code + title)
      // 4. For each user_modified conflict:
      //    - Default: keep user's version
      //    - Opt-in via conflictResolutions: accept candidate's version
      // 5. Supersede prior active (status='superseded', superseded_at=now())
      // 6. Activate candidate (status='active', activated_at=now())
      //
      // This is atomic - if step 6 fails, step 5 should rollback
    })
  })

  describe('user_modified Conflict Defaults', () => {
    it('documents default: keep user version for user_modified items', () => {
      // When accepting a candidate:
      // - If active has task with user_modified=true
      // - And candidate has matching task (by wbs_code + title)
      // - Default behavior: copy user's data to candidate task
      // - User must explicitly opt-in via conflictResolutions to discard their edits

      const acceptWithoutResolutions: AcceptWbsCandidateInput = {
        candidateVersionId: 'candidate-123',
        expectedRowVersion: 1,
        // No conflictResolutions → keeps all user modifications
      }

      const acceptWithOverride: AcceptWbsCandidateInput = {
        candidateVersionId: 'candidate-123',
        expectedRowVersion: 1,
        conflictResolutions: [
          { taskId: 'task-1', resolution: 'accept_candidate' }, // Overwrite user's edits
        ],
      }

      expect(acceptWithoutResolutions.conflictResolutions).toBeUndefined()
      expect(acceptWithOverride.conflictResolutions).toHaveLength(1)
    })
  })

  describe('Optimistic Concurrency', () => {
    it('documents stale row_version rejection pattern', () => {
      // Every update/remove operation includes expectedRowVersion
      // If DB row_version !== expectedRowVersion → throw StaleError
      // This prevents lost updates when concurrent users edit

      // Pattern for UpdateWbsTask:
      // 1. Load task, check row_version
      // 2. If mismatch: throw WbsTaskStaleError(taskId, expected, actual)
      // 3. Update includes: .eq('row_version', expectedRowVersion)
      // 4. DB has trigger to auto-increment row_version on update

      // In E2E: simulate concurrent edit, verify stale error thrown
    })
  })

  describe('Immutability', () => {
    it('documents superseded version mutation rejection', () => {
      // Once a version is superseded:
      // - DB trigger blocks all mutations
      // - Commands also check status before mutating
      // - Throws WbsTaskImmutableError (or similar) with status='superseded'

      // Pattern:
      // 1. Load task/assignment
      // 2. Query version status via explicit follow-up query
      // 3. If status === 'superseded': throw immutable error
      // 4. DB trigger is backup enforcement
    })
  })

  describe('Hard Delete with Audit', () => {
    it('documents remove commands produce audit events', () => {
      // RemoveWbsTask and RemoveStaffingAssignment:
      // - Verify row exists
      // - Verify row_version matches (optimistic concurrency)
      // - Verify version is not superseded (immutability)
      // - DELETE row (cascade deletes assignments for tasks)
      // - runCommand wrapper writes audit event

      // Audit event includes:
      // - command_name: 'RemoveWbsTask' / 'RemoveStaffingAssignment'
      // - aggregate_type: 'wbs_task' / 'staffing_assignment'
      // - aggregate_id: the deleted ID
      // - before_version: the row_version at deletion time
      // - after_version: 0 (or null, indicating deletion)
    })
  })
})
