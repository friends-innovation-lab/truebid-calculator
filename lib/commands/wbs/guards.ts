/**
 * Phase 3: WBS Guards
 *
 * Guard functions for WBS operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { WbsVersion, WbsStatus } from './types'

// Re-export intelligence guard from Phase 2
export { requireConfirmedIntelligence } from '../intelligence/guards'

// =============================================================================
// GUARD RESULT TYPES
// =============================================================================

export interface WbsVersionGuardResult {
  version: WbsVersion
  tenantId: string
}

// =============================================================================
// GUARD ERRORS
// =============================================================================

export class WbsVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`WBS version ${versionId} not found`)
    this.name = 'WbsVersionNotFoundError'
  }
}

export class WbsVersionWrongStatusError extends Error {
  constructor(versionId: string, actualStatus: WbsStatus, expectedStatuses: WbsStatus[]) {
    super(
      `WBS version ${versionId} has status "${actualStatus}", expected one of: ${expectedStatuses.join(', ')}`
    )
    this.name = 'WbsVersionWrongStatusError'
  }
}

export class WbsVersionWrongProposalError extends Error {
  constructor(versionId: string, expectedProposalId: string) {
    super(`WBS version ${versionId} does not belong to proposal ${expectedProposalId}`)
    this.name = 'WbsVersionWrongProposalError'
  }
}

export class WbsVersionStaleError extends Error {
  constructor(versionId: string, expectedVersion: number, actualVersion: number) {
    super(
      `WBS version ${versionId} has been modified. Expected row_version ${expectedVersion}, got ${actualVersion}`
    )
    this.name = 'WbsVersionStaleError'
  }
}

// =============================================================================
// GUARD FUNCTIONS
// =============================================================================

/**
 * Require a WBS version exists with one of the allowed statuses
 */
export async function requireWbsVersion(
  supabase: SupabaseClient,
  versionId: string,
  allowedStatuses: WbsStatus[]
): Promise<WbsVersionGuardResult> {
  const { data, error } = await supabase
    .from('wbs_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (error || !data) {
    throw new WbsVersionNotFoundError(versionId)
  }

  const version: WbsVersion = {
    id: data.id,
    tenantId: data.tenant_id,
    proposalId: data.proposal_id,
    intelligenceVersionId: data.intelligence_version_id,
    versionNumber: data.version_number,
    status: data.status,
    basedOnWbsVersionId: data.based_on_wbs_version_id,
    generationJobNote: data.generation_job_note,
    createdAt: data.created_at,
    activatedAt: data.activated_at,
    supersededAt: data.superseded_at,
    updatedAt: data.updated_at,
    rowVersion: data.row_version,
  }

  if (!allowedStatuses.includes(version.status)) {
    throw new WbsVersionWrongStatusError(versionId, version.status, allowedStatuses)
  }

  return { version, tenantId: version.tenantId }
}

/**
 * Require a WBS version belongs to a specific proposal
 */
export async function requireWbsVersionForProposal(
  supabase: SupabaseClient,
  versionId: string,
  proposalId: string,
  allowedStatuses: WbsStatus[]
): Promise<WbsVersionGuardResult> {
  const result = await requireWbsVersion(supabase, versionId, allowedStatuses)

  if (result.version.proposalId !== proposalId) {
    throw new WbsVersionWrongProposalError(versionId, proposalId)
  }

  return result
}

/**
 * Require a WBS version with optimistic concurrency check
 */
export async function requireWbsVersionWithRowVersion(
  supabase: SupabaseClient,
  versionId: string,
  expectedRowVersion: number,
  allowedStatuses: WbsStatus[]
): Promise<WbsVersionGuardResult> {
  const result = await requireWbsVersion(supabase, versionId, allowedStatuses)

  if (result.version.rowVersion !== expectedRowVersion) {
    throw new WbsVersionStaleError(versionId, expectedRowVersion, result.version.rowVersion)
  }

  return result
}

/**
 * Get the active WBS version for a proposal (if any)
 */
export async function getActiveWbsVersion(
  supabase: SupabaseClient,
  proposalId: string
): Promise<WbsVersion | null> {
  const { data, error } = await supabase
    .from('wbs_versions')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    proposalId: data.proposal_id,
    intelligenceVersionId: data.intelligence_version_id,
    versionNumber: data.version_number,
    status: data.status,
    basedOnWbsVersionId: data.based_on_wbs_version_id,
    generationJobNote: data.generation_job_note,
    createdAt: data.created_at,
    activatedAt: data.activated_at,
    supersededAt: data.superseded_at,
    updatedAt: data.updated_at,
    rowVersion: data.row_version,
  }
}

/**
 * Get the next version number for a proposal
 */
export async function getNextVersionNumber(
  supabase: SupabaseClient,
  proposalId: string
): Promise<number> {
  const { data } = await supabase
    .from('wbs_versions')
    .select('version_number')
    .eq('proposal_id', proposalId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  return (data?.version_number ?? 0) + 1
}
