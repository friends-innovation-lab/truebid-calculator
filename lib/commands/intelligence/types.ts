/**
 * Intelligence Command Types
 *
 * Type definitions for versioned contract intelligence commands.
 */

import type { Confidence, Discipline, RateSource } from '@/lib/types/contract-intelligence'

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

export type IntelligenceStatus = 'draft' | 'confirmed' | 'superseded'

export interface IntelligenceVersionRow {
  id: string
  tenant_id: string
  proposal_id: string
  version_number: number
  status: IntelligenceStatus
  confirmation_hash: string | null
  facts_json: FactsJson
  contract_type: string | null
  row_version: number
  extracted_at: string
  confirmed_at: string | null
  superseded_at: string | null
  created_at: string
  updated_at: string
}

export interface IntelligencePeriodRow {
  id: string
  version_id: string
  name: string
  months: string // NUMERIC comes as string from Postgres
  cumulative_months_end: string // NUMERIC comes as string from Postgres
  gsa_rate_year: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface IntelligenceDisciplineRow {
  id: string
  version_id: string
  discipline: Discipline
  confidence: Confidence
  source_text: string | null
  created_at: string
}

export interface IntelligenceLaborRequirementRow {
  id: string
  version_id: string
  title: string
  labor_category: string | null
  hours_per_month: string | null // NUMERIC comes as string from Postgres
  utilization_pct: string | null // NUMERIC comes as string from Postgres
  appears_in_periods: string[]
  confidence: Confidence
  source_text: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// FACTS JSON STRUCTURE
// =============================================================================

export interface ConfidenceValue<T> {
  value: T
  confidence: Confidence
}

export interface FactsJson {
  documentType?: ConfidenceValue<'RFP' | 'RFQ' | 'SOO' | 'PWS' | 'SOW' | 'task_order' | 'unknown'>
  vehicle?: ConfidenceValue<string | null>
  contractType?: ConfidenceValue<'FFP' | 'T&M' | 'IDIQ' | 'BPA' | 'CPFF' | 'unknown'>
  setAside?: ConfidenceValue<'8(a)' | 'WOSB' | 'SDVOSB' | 'small_business' | 'none' | 'unknown'>
  rateSource?: ConfidenceValue<RateSource>
}

// =============================================================================
// COERCED TYPES (after type coercion from DB)
// =============================================================================

export interface CoercedPeriod {
  id: string
  name: string
  months: number // Coerced from NUMERIC string
  cumulativeMonthsEnd: number // Coerced from NUMERIC string
  gsaRateYear: number
  sortOrder: number
}

export interface CoercedDiscipline {
  id: string
  discipline: Discipline
  confidence: Confidence
  sourceText: string | null
}

export interface CoercedLaborRequirement {
  id: string
  title: string
  laborCategory: string | null
  hoursPerMonth: number | null // Coerced from NUMERIC string
  utilizationPct: number | null // Coerced from NUMERIC string
  appearsInPeriods: string[]
  confidence: Confidence
  sourceText: string | null
}

export interface CoercedIntelligenceVersion {
  id: string
  tenantId: string
  proposalId: string
  versionNumber: number
  status: IntelligenceStatus
  confirmationHash: string | null
  factsJson: FactsJson
  contractType: string | null
  rowVersion: number
  extractedAt: string
  confirmedAt: string | null
  supersededAt: string | null
}

// =============================================================================
// COMMAND INPUT/OUTPUT TYPES
// =============================================================================

export interface CreateIntelligenceDraftInput {
  proposalId: string
  factsJson?: FactsJson
  contractType?: string
  periods?: Array<{
    name: string
    months: number
    cumulativeMonthsEnd: number
    gsaRateYear: number
    sortOrder?: number
  }>
  disciplines?: Array<{
    discipline: Discipline
    confidence: Confidence
    sourceText?: string
  }>
  laborRequirements?: Array<{
    title: string
    laborCategory?: string
    hoursPerMonth?: number
    utilizationPct?: number
    appearsInPeriods?: string[]
    confidence: Confidence
    sourceText?: string
  }>
}

export interface CreateIntelligenceDraftOutput {
  versionId: string
  versionNumber: number
  status: IntelligenceStatus
}

export interface UpdateIntelligenceFactsInput {
  versionId: string
  expectedVersion?: number
  factsJson?: FactsJson
  contractType?: string
  periods?: Array<{
    name: string
    months: number
    cumulativeMonthsEnd: number
    gsaRateYear: number
    sortOrder?: number
  }>
  disciplines?: Array<{
    discipline: Discipline
    confidence: Confidence
    sourceText?: string
  }>
  laborRequirements?: Array<{
    title: string
    laborCategory?: string
    hoursPerMonth?: number
    utilizationPct?: number
    appearsInPeriods?: string[]
    confidence: Confidence
    sourceText?: string
  }>
}

export interface UpdateIntelligenceFactsOutput {
  versionId: string
  rowVersion: number
}

export interface ConfirmIntelligenceVersionInput {
  versionId: string
  expectedVersion?: number
}

export interface ConfirmIntelligenceVersionOutput {
  versionId: string
  confirmationHash: string
  confirmedAt: string
  rowVersion: number
}

export interface SupersedeIntelligenceVersionInput {
  proposalId: string
}

export interface SupersedeIntelligenceVersionOutput {
  newVersionId: string
  newVersionNumber: number
  supersededVersionId: string
}

// =============================================================================
// GUARD TYPES
// =============================================================================

export interface IntelligenceGuardResult {
  valid: true
  version: CoercedIntelligenceVersion
  periods: CoercedPeriod[]
  disciplines: CoercedDiscipline[]
  laborRequirements: CoercedLaborRequirement[]
}

export interface IntelligenceGuardError {
  valid: false
  code: 'NOT_FOUND' | 'NOT_CONFIRMED' | 'NOT_ACTIVE' | 'HASH_MISMATCH' | 'WRONG_PROPOSAL'
  message: string
}

export type IntelligenceGuardResponse = IntelligenceGuardResult | IntelligenceGuardError
