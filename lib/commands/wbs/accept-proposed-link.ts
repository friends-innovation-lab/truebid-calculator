/**
 * AcceptProposedLink Command
 *
 * Accepts an AI-proposed requirement link, making it count toward citation completeness.
 * - Verifies link exists and is in 'proposed' status
 * - Updates status to 'accepted'
 * - Sets resolved_at and resolved_by
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand, writeAuditEvent } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'

// =============================================================================
// TYPES
// =============================================================================

export interface AcceptProposedLinkInput {
  linkId: string
}

export interface AcceptProposedLinkOutput {
  linkId: string
  status: 'accepted'
  resolvedAt: string
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class ProposedLinkNotFoundError extends Error {
  constructor(linkId: string) {
    super(`Requirement link ${linkId} not found`)
    this.name = 'ProposedLinkNotFoundError'
  }
}

export class ProposedLinkNotProposedError extends Error {
  constructor(linkId: string, currentStatus: string) {
    super(`Cannot accept link ${linkId}: current status is ${currentStatus}, not proposed`)
    this.name = 'ProposedLinkNotProposedError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createAcceptProposedLinkCommand(
  supabase: SupabaseClient
): Command<AcceptProposedLinkInput, AcceptProposedLinkOutput> {
  return {
    name: 'AcceptProposedLink',
    aggregateType: 'requirement_link',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: AcceptProposedLinkInput
    ): Promise<CommandResult<AcceptProposedLinkOutput>> {
      const { linkId } = input

      // 1. Load the link
      const { data: link, error: loadError } = await supabase
        .from('requirement_links')
        .select('id, status, requirement_id')
        .eq('id', linkId)
        .single()

      if (loadError || !link) {
        throw new ProposedLinkNotFoundError(linkId)
      }

      // 2. Verify status is 'proposed'
      if (link.status !== 'proposed') {
        throw new ProposedLinkNotProposedError(linkId, link.status)
      }

      // 3. Update to accepted
      const resolvedAt = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('requirement_links')
        .update({
          status: 'accepted',
          resolved_at: resolvedAt,
          resolved_by: context.actorId,
        })
        .eq('id', linkId)
        .eq('status', 'proposed') // Optimistic concurrency

      if (updateError) {
        console.error('[AcceptProposedLink] Update error:', updateError)
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
        commandName: 'AcceptProposedLink',
        aggregateType: 'requirement_link',
        aggregateId: linkId,
        beforeVersion: 1, // requirement_links don't have row_version, use 1 as sentinel
        afterVersion: 1,
        changedFields: {
          status: { old: 'proposed', new: 'accepted' },
        },
        commandInput: { linkId },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          linkId,
          status: 'accepted',
          resolvedAt,
        },
      }
    },
  }
}

/**
 * Execute AcceptProposedLink command with audit logging
 */
export async function acceptProposedLink(
  supabase: SupabaseClient,
  input: AcceptProposedLinkInput
): Promise<AcceptProposedLinkOutput> {
  const command = createAcceptProposedLinkCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
