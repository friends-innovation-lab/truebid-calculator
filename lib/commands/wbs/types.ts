/**
 * Phase 3: WBS Command Types
 *
 * Type definitions for WBS versioning and staffing commands.
 */

// =============================================================================
// DATABASE TYPES (matching Postgres schema)
// =============================================================================

export type WbsStatus = 'generated_candidate' | 'draft' | 'active' | 'superseded'
export type WbsTaskSource = 'generated' | 'user_added'
export type StaffingSource = 'generated' | 'user_added'
export type PrimeOrSub = 'prime' | 'sub'

export interface WbsVersion {
  id: string
  tenantId: string
  proposalId: string
  intelligenceVersionId: string
  versionNumber: number
  status: WbsStatus
  basedOnWbsVersionId: string | null
  generationJobNote: string | null
  createdAt: string
  activatedAt: string | null
  supersededAt: string | null
  updatedAt: string
  rowVersion: number
}

export interface WbsTask {
  id: string
  tenantId: string
  wbsVersionId: string
  parentTaskId: string | null
  wbsCode: string
  title: string
  description: string | null
  deliverable: string | null
  sowReference: string | null
  startMonth: number | null
  endMonth: number | null
  sortOrder: number
  source: WbsTaskSource
  userModified: boolean
  createdAt: string
  updatedAt: string
  rowVersion: number
}

export interface StaffingAssignment {
  id: string
  tenantId: string
  wbsTaskId: string
  roleTitle: string
  discipline: string
  primeOrSub: PrimeOrSub
  subcontractorName: string | null
  periodLabel: string
  hours: number
  hoursPerMonth: number | null
  rationale: string | null
  source: StaffingSource
  userModified: boolean
  createdAt: string
  updatedAt: string
  rowVersion: number
}

// =============================================================================
// COMMAND INPUT TYPES
// =============================================================================

export interface StaffingInput {
  roleTitle: string
  discipline: string
  primeOrSub: PrimeOrSub
  subcontractorName?: string
  periodLabel: string
  hours: number
  hoursPerMonth?: number
  rationale?: string
}

export interface TaskInput {
  wbsCode: string
  title: string
  description?: string
  deliverable?: string
  sowReference?: string
  startMonth?: number
  endMonth?: number
  parentTaskId?: string
  staffing: StaffingInput[]
}

export interface CreateWbsCandidateInput {
  proposalId: string
  intelligenceVersionId: string
  tasks: TaskInput[]
  generationJobNote?: string
}

export interface AcceptWbsCandidateInput {
  candidateVersionId: string
  conflictResolutions?: ConflictResolution[]
  expectedRowVersion: number
}

export interface ConflictResolution {
  taskId: string
  assignmentId?: string
  resolution: 'keep_user' | 'accept_candidate'
}

export interface DiscardWbsCandidateInput {
  candidateVersionId: string
  expectedRowVersion: number
}

export interface UpdateWbsTaskInput {
  taskId: string
  title?: string
  description?: string
  deliverable?: string
  sowReference?: string
  startMonth?: number | null
  endMonth?: number | null
  expectedRowVersion: number
}

export interface UpdateStaffingAssignmentInput {
  assignmentId: string
  roleTitle?: string
  discipline?: string
  primeOrSub?: PrimeOrSub
  subcontractorName?: string | null
  periodLabel?: string
  hours?: number
  hoursPerMonth?: number | null
  rationale?: string | null
  expectedRowVersion: number
}

export interface AddWbsTaskInput {
  wbsVersionId: string
  wbsCode: string
  title: string
  description?: string
  deliverable?: string
  sowReference?: string
  startMonth?: number
  endMonth?: number
  parentTaskId?: string
  sortOrder?: number
}

export interface AddStaffingAssignmentInput {
  wbsTaskId: string
  roleTitle: string
  discipline: string
  primeOrSub: PrimeOrSub
  subcontractorName?: string
  periodLabel: string
  hours: number
  hoursPerMonth?: number
  rationale?: string
}

export interface RemoveWbsTaskInput {
  taskId: string
  expectedRowVersion: number
}

export interface RemoveStaffingAssignmentInput {
  assignmentId: string
  expectedRowVersion: number
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export type ValidationViolationType =
  | 'invalid_discipline'
  | 'missing_prime_or_sub'
  | 'invalid_period'
  | 'sub_missing_name'

export interface ValidationViolation {
  type: ValidationViolationType
  taskWbsCode: string
  taskTitle: string
  assignmentIndex?: number
  roleTitle?: string
  details: string
}

export interface ValidationResult {
  valid: boolean
  violations: ValidationViolation[]
}

// =============================================================================
// COMMAND RESULT TYPES
// =============================================================================

export interface CreateWbsCandidateResult {
  candidateVersionId: string
  versionNumber: number
  taskCount: number
  assignmentCount: number
  validation: ValidationResult
}

export interface AcceptWbsCandidateResult {
  activeVersionId: string
  supersededVersionId: string | null
  conflictsResolved: number
}

export interface WbsVersionWithDetails extends WbsVersion {
  tasks: WbsTaskWithAssignments[]
}

export interface WbsTaskWithAssignments extends WbsTask {
  assignments: StaffingAssignment[]
}

// =============================================================================
// DIFF TYPES (for candidate review)
// =============================================================================

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged' | 'conflict'

export interface TaskDiff {
  status: DiffStatus
  candidateTask: WbsTask | null
  activeTask: WbsTask | null
  assignmentDiffs: AssignmentDiff[]
  hasUserModifiedConflict: boolean
}

export interface AssignmentDiff {
  status: DiffStatus
  candidateAssignment: StaffingAssignment | null
  activeAssignment: StaffingAssignment | null
  hasUserModifiedConflict: boolean
}

export interface WbsDiff {
  candidateVersionId: string
  activeVersionId: string | null
  taskDiffs: TaskDiff[]
  totalConflicts: number
}
