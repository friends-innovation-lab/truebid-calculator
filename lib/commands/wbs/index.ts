/**
 * Phase 3: WBS Commands
 *
 * Command layer for WBS versioning and staffing operations.
 */

// Types
export * from './types'

// Guards
export {
  requireWbsVersion,
  requireWbsVersionForProposal,
  requireWbsVersionWithRowVersion,
  getActiveWbsVersion,
  getNextVersionNumber,
  WbsVersionNotFoundError,
  WbsVersionWrongStatusError,
  WbsVersionWrongProposalError,
  WbsVersionStaleError,
} from './guards'

// Validation
export {
  loadIntelligenceContext,
  validateWbsCandidate,
  formatValidationErrors,
  resolveRolesAgainstCatalog,
} from './validate-wbs-candidate'

// Commands
export {
  createWbsCandidate,
  createCreateWbsCandidateCommand,
  WbsValidationError,
} from './create-wbs-candidate'

export {
  acceptWbsCandidate,
  createAcceptWbsCandidateCommand,
} from './accept-wbs-candidate'

export {
  discardWbsCandidate,
  createDiscardWbsCandidateCommand,
} from './discard-wbs-candidate'

export {
  updateWbsTask,
  createUpdateWbsTaskCommand,
  WbsTaskNotFoundError,
  WbsTaskStaleError,
  WbsTaskImmutableError,
} from './update-wbs-task'

export {
  updateStaffingAssignment,
  createUpdateStaffingAssignmentCommand,
  StaffingAssignmentNotFoundError,
  StaffingAssignmentStaleError,
  StaffingAssignmentImmutableError,
} from './update-staffing-assignment'

export {
  addWbsTask,
  createAddWbsTaskCommand,
} from './add-wbs-task'

export {
  addStaffingAssignment,
  createAddStaffingAssignmentCommand,
  TaskNotFoundError,
  TaskImmutableError,
} from './add-staffing-assignment'

export {
  removeWbsTask,
  createRemoveWbsTaskCommand,
  RemoveTaskNotFoundError,
  RemoveTaskStaleError,
  RemoveTaskImmutableError,
} from './remove-wbs-task'

export {
  removeStaffingAssignment,
  createRemoveStaffingAssignmentCommand,
  RemoveAssignmentNotFoundError,
  RemoveAssignmentStaleError,
  RemoveAssignmentImmutableError,
} from './remove-staffing-assignment'

// Diff utility
export { computeWbsDiff } from './compute-diff'
