/**
 * Intelligence Guards
 *
 * Guard functions for validating intelligence versions before dependent operations.
 * Used by generate-wbs to ensure intelligence is confirmed and hash-verified.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAndHashIntelligence } from './hash-utils'
import type {
  IntelligenceGuardResponse,
  IntelligenceVersionRow,
} from './types'

/**
 * Require a confirmed intelligence version before proceeding.
 *
 * Verifies:
 * 1. Version exists
 * 2. Version belongs to the specified proposal and tenant
 * 3. Status is 'confirmed'
 * 4. Version is the active version for the proposal
 * 5. Hash recomputes correctly (tamper detection)
 *
 * @param supabase - Authenticated Supabase client
 * @param proposalId - The proposal ID
 * @param versionId - The intelligence version ID to verify
 * @param tenantId - The tenant ID for access control
 * @returns Guard result with version data if valid, or error details if invalid
 */
export async function requireConfirmedIntelligence(
  supabase: SupabaseClient,
  proposalId: string,
  versionId: string,
  tenantId: string
): Promise<IntelligenceGuardResponse> {
  // Load version
  const { data: version, error: versionError } = await supabase
    .from('intelligence_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (versionError || !version) {
    return {
      valid: false,
      code: 'NOT_FOUND',
      message: `Intelligence version not found: ${versionId}`,
    }
  }

  const versionRow = version as IntelligenceVersionRow

  // Verify tenant
  if (versionRow.tenant_id !== tenantId) {
    return {
      valid: false,
      code: 'NOT_FOUND',
      message: `Intelligence version not found: ${versionId}`,
    }
  }

  // Verify proposal
  if (versionRow.proposal_id !== proposalId) {
    return {
      valid: false,
      code: 'WRONG_PROPOSAL',
      message: `Intelligence version ${versionId} does not belong to proposal ${proposalId}`,
    }
  }

  // Verify status is confirmed
  if (versionRow.status !== 'confirmed') {
    return {
      valid: false,
      code: 'NOT_CONFIRMED',
      message: `Intelligence version ${versionId} is not confirmed (status: ${versionRow.status})`,
    }
  }

  // Verify this is the active version for the proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('active_intelligence_version_id')
    .eq('id', proposalId)
    .single()

  if (proposal?.active_intelligence_version_id !== versionId) {
    return {
      valid: false,
      code: 'NOT_ACTIVE',
      message: `Intelligence version ${versionId} is not the active version for proposal ${proposalId}`,
    }
  }

  // Load and recompute hash
  const hashResult = await loadAndHashIntelligence(supabase, versionId)

  if (!hashResult) {
    return {
      valid: false,
      code: 'NOT_FOUND',
      message: `Failed to load intelligence version data: ${versionId}`,
    }
  }

  // Verify hash matches
  if (hashResult.hash !== versionRow.confirmation_hash) {
    console.error(
      '[requireConfirmedIntelligence] Hash mismatch!',
      `Expected: ${versionRow.confirmation_hash}`,
      `Computed: ${hashResult.hash}`
    )
    return {
      valid: false,
      code: 'HASH_MISMATCH',
      message: `Intelligence version ${versionId} hash verification failed - data may have been tampered`,
    }
  }

  return {
    valid: true,
    version: hashResult.version,
    periods: hashResult.periods,
    disciplines: hashResult.disciplines,
    laborRequirements: hashResult.laborRequirements,
  }
}

/**
 * Load intelligence version without guard checks.
 * Used for reading intelligence data without requiring confirmation.
 *
 * @param supabase - Authenticated Supabase client
 * @param versionId - The intelligence version ID to load
 * @param tenantId - The tenant ID for access control
 * @returns Version data if found, null otherwise
 */
export async function loadIntelligenceVersion(
  supabase: SupabaseClient,
  versionId: string,
  tenantId: string
): Promise<Awaited<ReturnType<typeof loadAndHashIntelligence>> | null> {
  // Load version first to check tenant
  const { data: version, error: versionError } = await supabase
    .from('intelligence_versions')
    .select('tenant_id')
    .eq('id', versionId)
    .single()

  if (versionError || !version) {
    return null
  }

  // Verify tenant
  if ((version as { tenant_id: string }).tenant_id !== tenantId) {
    return null
  }

  return loadAndHashIntelligence(supabase, versionId)
}

/**
 * Get the current intelligence version for a proposal.
 * Returns the active confirmed version if one exists, otherwise the latest draft.
 *
 * @param supabase - Authenticated Supabase client
 * @param proposalId - The proposal ID
 * @param tenantId - The tenant ID for access control
 * @returns Version ID and status, or null if no versions exist
 */
export async function getCurrentIntelligenceVersion(
  supabase: SupabaseClient,
  proposalId: string,
  tenantId: string
): Promise<{ versionId: string; status: 'draft' | 'confirmed' | 'superseded' } | null> {
  // First check for active version on proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('active_intelligence_version_id')
    .eq('id', proposalId)
    .single()

  if (proposal?.active_intelligence_version_id) {
    return {
      versionId: proposal.active_intelligence_version_id,
      status: 'confirmed',
    }
  }

  // Otherwise, get the latest version
  const { data: latestVersion } = await supabase
    .from('intelligence_versions')
    .select('id, status, tenant_id')
    .eq('proposal_id', proposalId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (!latestVersion) {
    return null
  }

  // Verify tenant
  if ((latestVersion as { tenant_id: string }).tenant_id !== tenantId) {
    return null
  }

  return {
    versionId: latestVersion.id,
    status: latestVersion.status as 'draft' | 'confirmed' | 'superseded',
  }
}
