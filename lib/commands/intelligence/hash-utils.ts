/**
 * Intelligence Hash Utilities
 *
 * Canonical serialization and SHA-256 hashing for intelligence versions.
 * CRITICAL: Both confirm-time and guard-time use the same load-and-hash function
 * to ensure consistent type coercion.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IntelligenceVersionRow,
  IntelligencePeriodRow,
  IntelligenceDisciplineRow,
  IntelligenceLaborRequirementRow,
  CoercedPeriod,
  CoercedDiscipline,
  CoercedLaborRequirement,
  CoercedIntelligenceVersion,
  FactsJson,
  SolicitationBrief,
} from './types'

// =============================================================================
// TYPE COERCION FUNCTIONS
// =============================================================================
// These functions convert Postgres types to JavaScript types consistently.
// NUMERIC columns return as strings from Postgres, must be converted to numbers.

function coerceNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

function coerceUuid(value: string): string {
  // UUIDs should be lowercase for consistent hashing
  return value.toLowerCase()
}

export function coercePeriod(row: IntelligencePeriodRow): CoercedPeriod {
  return {
    id: coerceUuid(row.id),
    name: row.name,
    months: coerceNumeric(row.months) ?? 0,
    cumulativeMonthsEnd: coerceNumeric(row.cumulative_months_end) ?? 0,
    gsaRateYear: row.gsa_rate_year,
    sortOrder: row.sort_order,
  }
}

export function coerceDiscipline(row: IntelligenceDisciplineRow): CoercedDiscipline {
  return {
    id: coerceUuid(row.id),
    discipline: row.discipline,
    confidence: row.confidence,
    sourceText: row.source_text,
  }
}

export function coerceLaborRequirement(row: IntelligenceLaborRequirementRow): CoercedLaborRequirement {
  return {
    id: coerceUuid(row.id),
    title: row.title,
    laborCategory: row.labor_category,
    hoursPerMonth: coerceNumeric(row.hours_per_month),
    utilizationPct: coerceNumeric(row.utilization_pct),
    appearsInPeriods: row.appears_in_periods ?? [],
    isPrescribed: row.is_prescribed ?? false,
    confidence: row.confidence,
    sourceText: row.source_text,
    // Phase 5: Catalog match fields
    laborCategoryId: row.labor_category_id,
    matchType: row.match_type,
    matchConfidence: coerceNumeric(row.match_confidence),
  }
}

export function coerceVersion(row: IntelligenceVersionRow): CoercedIntelligenceVersion {
  return {
    id: coerceUuid(row.id),
    tenantId: coerceUuid(row.tenant_id),
    proposalId: coerceUuid(row.proposal_id),
    versionNumber: row.version_number,
    status: row.status,
    confirmationHash: row.confirmation_hash,
    factsJson: row.facts_json,
    contractType: row.contract_type,
    staffingModel: row.staffing_model ?? 'unclear',
    solicitationBrief: row.solicitation_brief ?? null,
    rowVersion: row.row_version,
    extractedAt: row.extracted_at,
    confirmedAt: row.confirmed_at,
    supersededAt: row.superseded_at,
  }
}

// =============================================================================
// CANONICAL SERIALIZATION
// =============================================================================
// Keys must be sorted recursively for deterministic JSON output.
//
// APPEND-ONLY INVARIANT (2026-07-14):
// Canonical serialization is append-only. Existing fields' serialization never
// changes; new fields are omit-when-absent.
//
// Phase 2 field set (frozen forever, nulls included):
//   - periods: id, name, months, cumulativeMonthsEnd, gsaRateYear, sortOrder
//   - disciplines: id, discipline, confidence, sourceText
//   - laborRequirements: id, title, laborCategory, hoursPerMonth, utilizationPct,
//                        appearsInPeriods, confidence, sourceText
//   - factsJson, versionId
//
// Post-Phase-2 fields (omit when absent/default):
//   - laborRequirements: isPrescribed (omit if false), laborCategoryId, matchType,
//                        matchConfidence (omit if null)
//   - solicitationBrief (omit if null)
//
// Any change to this file requires the golden-file test to pass unchanged.

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  if (typeof obj !== 'object') return obj

  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
  }
  return sorted
}

/**
 * Hashable representation of a period (Phase 2 frozen).
 * All fields included exactly as Phase 2 serialized them.
 */
interface HashablePeriod {
  id: string
  name: string
  months: number
  cumulativeMonthsEnd: number
  gsaRateYear: number
  sortOrder: number
}

/**
 * Hashable representation of a discipline (Phase 2 frozen).
 * All fields included exactly as Phase 2 serialized them.
 */
interface HashableDiscipline {
  id: string
  discipline: string
  confidence: string
  sourceText: string | null
}

/**
 * Hashable representation of a labor requirement.
 * Phase 2 fields are always present (nulls included).
 * Post-Phase-2 fields are conditionally added.
 */
interface HashableLaborRequirement {
  id: string
  title: string
  laborCategory: string | null        // Phase 2: always present
  hoursPerMonth: number | null        // Phase 2: always present
  utilizationPct: number | null       // Phase 2: always present
  appearsInPeriods: string[]          // Phase 2: always present
  confidence: string                  // Phase 2: always present
  sourceText: string | null           // Phase 2: always present
  // Post-Phase-2: conditionally present
  isPrescribed?: true                 // Only when true (omit false)
  laborCategoryId?: string            // Only when non-null
  matchType?: string                  // Only when non-null
  matchConfidence?: number            // Only when non-null
}

/**
 * Convert coerced labor requirement to hashable form.
 * Phase 2 fields always included; post-Phase-2 fields omitted when absent/default.
 */
function toHashableLaborRequirement(lr: CoercedLaborRequirement): HashableLaborRequirement {
  // Phase 2 frozen field set (always present, nulls included)
  const hashable: HashableLaborRequirement = {
    id: lr.id,
    title: lr.title,
    laborCategory: lr.laborCategory,
    hoursPerMonth: lr.hoursPerMonth,
    utilizationPct: lr.utilizationPct,
    appearsInPeriods: lr.appearsInPeriods,
    confidence: lr.confidence,
    sourceText: lr.sourceText,
  }

  // Post-Phase-2 fields: only add when meaningful
  if (lr.isPrescribed === true) {
    hashable.isPrescribed = true
  }
  if (lr.laborCategoryId != null) {
    hashable.laborCategoryId = lr.laborCategoryId
  }
  if (lr.matchType != null) {
    hashable.matchType = lr.matchType
  }
  if (lr.matchConfidence != null) {
    hashable.matchConfidence = lr.matchConfidence
  }

  return hashable
}

interface HashableData {
  versionId: string
  factsJson: FactsJson
  periods: CoercedPeriod[]
  disciplines: CoercedDiscipline[]
  laborRequirements: CoercedLaborRequirement[]
  solicitationBrief: SolicitationBrief | null
}

export function canonicalize(data: HashableData): string {
  // Sort arrays for deterministic output
  const sortedPeriods = [...data.periods].sort((a, b) => a.sortOrder - b.sortOrder)
  const sortedDisciplines = [...data.disciplines].sort((a, b) =>
    a.discipline.localeCompare(b.discipline)
  )
  const sortedLaborReqs = [...data.laborRequirements].sort((a, b) =>
    a.title.localeCompare(b.title)
  )

  // Convert to hashable forms
  const hashablePeriods: HashablePeriod[] = sortedPeriods.map((p) => ({
    id: p.id,
    name: p.name,
    months: p.months,
    cumulativeMonthsEnd: p.cumulativeMonthsEnd,
    gsaRateYear: p.gsaRateYear,
    sortOrder: p.sortOrder,
  }))

  const hashableDisciplines: HashableDiscipline[] = sortedDisciplines.map((d) => ({
    id: d.id,
    discipline: d.discipline,
    confidence: d.confidence,
    sourceText: d.sourceText,
  }))

  const hashableLaborReqs = sortedLaborReqs.map(toHashableLaborRequirement)

  // Assemble canonical object
  // Phase 2 fields always present; post-Phase-2 fields conditionally added
  const canonical: Record<string, unknown> = {
    disciplines: hashableDisciplines,
    factsJson: data.factsJson,
    laborRequirements: hashableLaborReqs,
    periods: hashablePeriods,
    versionId: data.versionId,
  }

  // Post-Phase-2: solicitationBrief only when present
  if (data.solicitationBrief != null) {
    canonical.solicitationBrief = data.solicitationBrief
  }

  return JSON.stringify(sortObjectKeys(canonical))
}

// =============================================================================
// HASH COMPUTATION
// =============================================================================

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeHash(data: HashableData): Promise<string> {
  const canonical = canonicalize(data)
  return sha256(canonical)
}

// =============================================================================
// LOAD AND HASH (SINGLE CODE PATH)
// =============================================================================
// This function is used by BOTH confirm-time and guard-time hashing.
// It loads data fresh from the DB and computes the hash.
// This ensures type coercion is consistent.

export interface LoadAndHashResult {
  hash: string
  version: CoercedIntelligenceVersion
  periods: CoercedPeriod[]
  disciplines: CoercedDiscipline[]
  laborRequirements: CoercedLaborRequirement[]
}

export async function loadAndHashIntelligence(
  supabase: SupabaseClient,
  versionId: string
): Promise<LoadAndHashResult | null> {
  // Load version
  const { data: versionRow, error: versionError } = await supabase
    .from('intelligence_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (versionError || !versionRow) {
    console.error('[loadAndHashIntelligence] Version not found:', versionId)
    return null
  }

  // Load periods
  const { data: periodRows, error: periodsError } = await supabase
    .from('intelligence_periods')
    .select('*')
    .eq('version_id', versionId)
    .order('sort_order')

  if (periodsError) {
    console.error('[loadAndHashIntelligence] Failed to load periods:', periodsError)
    return null
  }

  // Load disciplines
  const { data: disciplineRows, error: disciplinesError } = await supabase
    .from('intelligence_disciplines')
    .select('*')
    .eq('version_id', versionId)

  if (disciplinesError) {
    console.error('[loadAndHashIntelligence] Failed to load disciplines:', disciplinesError)
    return null
  }

  // Load labor requirements
  const { data: laborReqRows, error: laborReqsError } = await supabase
    .from('intelligence_labor_requirements')
    .select('*')
    .eq('version_id', versionId)

  if (laborReqsError) {
    console.error('[loadAndHashIntelligence] Failed to load labor requirements:', laborReqsError)
    return null
  }

  // Coerce types
  const version = coerceVersion(versionRow as IntelligenceVersionRow)
  const periods = (periodRows as IntelligencePeriodRow[]).map(coercePeriod)
  const disciplines = (disciplineRows as IntelligenceDisciplineRow[]).map(coerceDiscipline)
  const laborRequirements = (laborReqRows as IntelligenceLaborRequirementRow[]).map(
    coerceLaborRequirement
  )

  // Compute hash
  const hash = await computeHash({
    versionId: version.id,
    factsJson: version.factsJson,
    periods,
    disciplines,
    laborRequirements,
    solicitationBrief: version.solicitationBrief,
  })

  return {
    hash,
    version,
    periods,
    disciplines,
    laborRequirements,
  }
}
