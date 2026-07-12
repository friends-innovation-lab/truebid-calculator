/**
 * Command Layer
 *
 * Command pattern implementation for TrueBid.
 * All state mutations should go through commands.
 *
 * @example
 * import { runCommand, createCreateProposalCommand } from '@/lib/commands'
 *
 * const command = createCreateProposalCommand(supabase)
 * const result = await runCommand(supabase, command, {
 *   title: 'New Proposal',
 *   agency: 'DOD',
 * })
 */

// Re-export types
export {
  type CommandContext,
  type CommandResult,
  type CommandError,
  type CommandErrorCode,
  type StaleVersionDetails,
  type Command,
  type AuditEventRecord,
  type VersionedInput,
} from './types'

// Re-export errors
export {
  CommandExecutionError,
  StaleVersionError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  InvalidStateError,
} from './errors'

// Re-export runner
export {
  runCommand,
  writeAuditEvent,
  detectChanges,
  createSystemContext,
} from './runner'

// Re-export proposal commands
export {
  createCreateProposalCommand,
  type CreateProposalInput,
  type CreateProposalOutput,
} from './proposals/create-proposal'

export {
  createArchiveProposalCommand,
  type ArchiveProposalInput,
  type ArchiveProposalOutput,
} from './proposals/archive-proposal'

export {
  createUpdateProposalMetadataCommand,
  type UpdateProposalMetadataInput,
  type UpdateProposalMetadataOutput,
} from './proposals/update-proposal-metadata'

// Re-export intelligence commands
export {
  // Commands
  createCreateIntelligenceDraftCommand,
  createUpdateIntelligenceFactsCommand,
  createConfirmIntelligenceVersionCommand,
  createSupersedeIntelligenceVersionCommand,
  // Guards
  requireConfirmedIntelligence,
  loadIntelligenceVersion,
  getCurrentIntelligenceVersion,
  getConfirmedIntelligenceVersion,
  // Hash utilities
  loadAndHashIntelligence,
  computeHash,
  canonicalize,
  // Types
  type IntelligenceProjectionResult,
  type IntelligenceStatus,
  type IntelligenceVersionRow,
  type IntelligencePeriodRow,
  type IntelligenceDisciplineRow,
  type IntelligenceLaborRequirementRow,
  type FactsJson,
  type ConfidenceValue,
  type CoercedPeriod,
  type CoercedDiscipline,
  type CoercedLaborRequirement,
  type CoercedIntelligenceVersion,
  type CreateIntelligenceDraftInput,
  type CreateIntelligenceDraftOutput,
  type UpdateIntelligenceFactsInput,
  type UpdateIntelligenceFactsOutput,
  type ConfirmIntelligenceVersionInput,
  type ConfirmIntelligenceVersionOutput,
  type SupersedeIntelligenceVersionInput,
  type SupersedeIntelligenceVersionOutput,
  type IntelligenceGuardResult,
  type IntelligenceGuardError,
  type IntelligenceGuardResponse,
} from './intelligence'

// Re-export WBS commands
export {
  // Commands
  createWbsCandidate,
  createCreateWbsCandidateCommand,
  acceptWbsCandidate,
  createAcceptWbsCandidateCommand,
  discardWbsCandidate,
  createDiscardWbsCandidateCommand,
  updateWbsTask,
  createUpdateWbsTaskCommand,
  updateStaffingAssignment,
  createUpdateStaffingAssignmentCommand,
  addWbsTask,
  createAddWbsTaskCommand,
  addStaffingAssignment,
  createAddStaffingAssignmentCommand,
  removeWbsTask,
  createRemoveWbsTaskCommand,
  removeStaffingAssignment,
  createRemoveStaffingAssignmentCommand,
  // Diff utility
  computeWbsDiff,
  // Guards
  requireWbsVersion,
  requireWbsVersionForProposal,
  requireWbsVersionWithRowVersion,
  getActiveWbsVersion,
  getNextVersionNumber,
  // Validation
  loadIntelligenceContext,
  validateWbsCandidate,
  formatValidationErrors,
  // Errors
  WbsValidationError,
  WbsVersionNotFoundError,
  WbsVersionWrongStatusError,
  WbsVersionWrongProposalError,
  WbsVersionStaleError,
  WbsTaskNotFoundError,
  WbsTaskStaleError,
  WbsTaskImmutableError,
  StaffingAssignmentNotFoundError,
  StaffingAssignmentStaleError,
  StaffingAssignmentImmutableError,
  TaskNotFoundError,
  TaskImmutableError,
  RemoveTaskNotFoundError,
  RemoveTaskStaleError,
  RemoveTaskImmutableError,
  RemoveAssignmentNotFoundError,
  RemoveAssignmentStaleError,
  RemoveAssignmentImmutableError,
  // Types
  type WbsStatus,
  type WbsTaskSource,
  type StaffingSource,
  type PrimeOrSub,
  type WbsVersion,
  type WbsTask,
  type StaffingAssignment,
  type StaffingInput,
  type TaskInput,
  type CreateWbsCandidateInput,
  type CreateWbsCandidateResult,
  type AcceptWbsCandidateInput,
  type AcceptWbsCandidateResult,
  type ConflictResolution,
  type DiscardWbsCandidateInput,
  type UpdateWbsTaskInput,
  type UpdateStaffingAssignmentInput,
  type AddWbsTaskInput,
  type AddStaffingAssignmentInput,
  type RemoveWbsTaskInput,
  type RemoveStaffingAssignmentInput,
  type ValidationResult,
  type ValidationViolation,
  type ValidationViolationType,
  type WbsVersionWithDetails,
  type WbsTaskWithAssignments,
  type WbsDiff,
  type TaskDiff,
  type AssignmentDiff,
  type DiffStatus,
} from './wbs'

// Re-export pricing commands
export {
  // Commands
  createComputePricingScenarioCommand,
  createApprovePricingScenarioCommand,
  createUpdateChargeCodesCommand,
  // Types
  type RateConfigSnapshot,
  type PricingScenarioStatus,
  type SalarySource,
  type ProfitSource,
  type PricingScenarioSummary,
  type PricingLine,
  type ScenarioTotals,
  type ComputePricingScenarioInput,
  type ComputePricingScenarioOutput,
  type ApprovePricingScenarioInput,
  type ApprovePricingScenarioOutput,
  type ChargeCodeEntry,
  type UpdateChargeCodesInput,
  type UpdateChargeCodesOutput,
} from './pricing'
