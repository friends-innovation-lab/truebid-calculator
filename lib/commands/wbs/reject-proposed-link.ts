/**
 * RejectProposedLink Command
 *
 * Rejects an AI-proposed requirement link, marking it as not applicable.
 * - Verifies link exists and is in 'proposed' status
 * - Updates status to 'rejected'
 * - Sets resolved_at and resolved_by
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand, writeAuditEvent } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'

// =============================================================================
// TYPES
// =============================================================================

export interface RejectProposedLinkInput {
  linkId: string
}

export interface RejectProposedLinkOutput {
  linkId: string
  status: 'rejected'
  resolvedAt: string
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class RejectLinkNotFoundError extends Error {
  constructor(linkId: string) {
    super(`Requirement link ${linkId} not found`)
    this.name = 'RejectLinkNotFoundError'
  }
}

export class RejectLinkNotProposedError extends Error {
  constructor(linkId: string, currentStatus: string) {
    super(`Cannot reject link ${linkId}: current status is ${currentStatus}, not proposed`)
    this.name = 'RejectLinkNotProposedError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createRejectProposedLinkCommand(
  supabase: SupabaseClient
): Command<RejectProposedLinkInput, RejectProposedLinkOutput> {
  return {
    name: 'RejectProposedLink',
    aggregateType: 'requirement_link',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: RejectProposedLinkInput
    ): Promise<CommandResult<RejectProposedLinkOutput>> {
      const { linkId } = input

      // 1. Load the link
      const { data: link, error: loadError } = await supabase
        .from('requirement_links')
        .select('id, status, requirement_id')
        .eq('id', linkId)
        .single()

      if (loadError || !link) {
        throw new RejectLinkNotFoundError(linkId)
      }

      // 2. Verify status is 'proposed'
      if (link.status !== 'proposed') {
        throw new RejectLinkNotProposedError(linkId, link.status)
      }

      // 3. Update to rejected
      const resolvedAt = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('requirement_links')
        .update({
          status: 'rejected',
          resolved_at: resolvedAt,
          resolved_by: context.actorId,
        })
        .eq('id', linkId)
        .eq('status', 'proposed') // Optimistic concurrency

      if (updateError) {
        console.error('[RejectProposedLink] Update error:', updateError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: updateError.message,
          },
        }
      }

      // 4. Write audit event
      await writeAuditEvent(supabase, {
        tenantId: context.tenant.tenant.id,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'RejectProposedLink',
        aggregateType: 'requirement_link',
        aggregateId: linkId,
        beforeVersion: 1, // requirement_links don't have row_version, use 1 as sentinel
        afterVersion: 1,
        changedFields: {
          status: { old: 'proposed', new: 'rejected' },
        },
        commandInput: { linkId },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          linkId,
          status: 'rejected',
          resolvedAt,
        },
      }
    },
  }
}

/**
 * Execute RejectProposedLink command with audit logging
 */
export async function rejectProposedLink(
  supabase: SupabaseClient,
  input: RejectProposedLinkInput
): Promise<RejectProposedLinkOutput> {
  const command = createRejectProposedLinkCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
