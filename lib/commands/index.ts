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
