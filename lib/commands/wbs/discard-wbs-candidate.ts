/**
 * Phase 3: DiscardWbsCandidate Command
 *
 * Discards a WBS candidate (deletes it and its tasks/assignments).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { requireWbsVersionWithRowVersion } from './guards'
import type { DiscardWbsCandidateInput } from './types'

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createDiscardWbsCandidateCommand(
  supabase: SupabaseClient
): Command<DiscardWbsCandidateInput, { discarded: true }> {
  return {
    name: 'DiscardWbsCandidate',
    aggregateType: 'wbs_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: DiscardWbsCandidateInput
    ): Promise<CommandResult<{ discarded: true }>> {
      // 1. Verify candidate exists and is discardable
      await requireWbsVersionWithRowVersion(
        supabase,
        input.candidateVersionId,
        input.expectedRowVersion,
        ['generated_candidate', 'draft']
      )

      // 2. Delete the version (cascades to tasks and assignments)
      const { error } = await supabase
        .from('wbs_versions')
        .delete()
        .eq('id', input.candidateVersionId)

      if (error) {
        throw new Error(`Failed to discard candidate: ${error.message}`)
      }

      return { success: true, data: { discarded: true } }
    },
  }
}

/**
 * Execute DiscardWbsCandidate command with audit logging
 */
export async function discardWbsCandidate(
  supabase: SupabaseClient,
  input: DiscardWbsCandidateInput
): Promise<{ discarded: true }> {
  const command = createDiscardWbsCandidateCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
