/**
 * Intelligence Commands
 *
 * Commands for managing versioned contract intelligence.
 */

// Types
export type {
  IntelligenceStatus,
  IntelligenceVersionRow,
  IntelligencePeriodRow,
  IntelligenceDisciplineRow,
  IntelligenceLaborRequirementRow,
  FactsJson,
  ConfidenceValue,
  CoercedPeriod,
  CoercedDiscipline,
  CoercedLaborRequirement,
  CoercedIntelligenceVersion,
  CreateIntelligenceDraftInput,
  CreateIntelligenceDraftOutput,
  UpdateIntelligenceFactsInput,
  UpdateIntelligenceFactsOutput,
  ConfirmIntelligenceVersionInput,
  ConfirmIntelligenceVersionOutput,
  SupersedeIntelligenceVersionInput,
  SupersedeIntelligenceVersionOutput,
  IntelligenceGuardResult,
  IntelligenceGuardError,
  IntelligenceGuardResponse,
} from './types'

// Commands
export { createCreateIntelligenceDraftCommand } from './create-draft'
export { createUpdateIntelligenceFactsCommand } from './update-facts'
export { createConfirmIntelligenceVersionCommand } from './confirm-version'
export { createSupersedeIntelligenceVersionCommand } from './supersede-version'

// Guards
export {
  requireConfirmedIntelligence,
  loadIntelligenceVersion,
  getCurrentIntelligenceVersion,
} from './guards'

// Hash utilities
export {
  loadAndHashIntelligence,
  computeHash,
  canonicalize,
  coercePeriod,
  coerceDiscipline,
  coerceLaborRequirement,
  coerceVersion,
} from './hash-utils'
