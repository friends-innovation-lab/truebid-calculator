/**
 * CreateProposal Command
 *
 * Creates a new proposal within the tenant.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError } from '../errors'

/**
 * Input for creating a proposal.
 */
export interface CreateProposalInput {
  title: string
  solicitationNumber?: string
  agency?: string
  contractType?: 'tm' | 'fp' | 'cpff' | 'cpif' | 'hybrid'
  dueDate?: string | null
  description?: string
}

/**
 * Output from creating a proposal.
 */
export interface CreateProposalOutput {
  id: string
  title: string
  solicitationNumber: string | null
  agency: string | null
  contractType: string
  status: string
  rowVersion: number
  createdAt: string
}

/**
 * Create the command instance.
 * Requires Supabase client for database operations.
 */
export function createCreateProposalCommand(
  supabase: SupabaseClient
): Command<CreateProposalInput, CreateProposalOutput> {
  return {
    name: 'CreateProposal',
    aggregateType: 'proposal',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: CreateProposalInput
    ): Promise<CommandResult<CreateProposalOutput>> {
      // Validate input
      if (!input.title || input.title.trim().length === 0) {
        throw new ValidationError('Title is required', { title: 'Required field' })
      }

      // Get company ID from tenant (during transition period)
      const companyId = context.tenant.tenant.companyId
      if (!companyId) {
        throw new ValidationError('Tenant has no associated company', {
          tenant: 'No company linked',
        })
      }

      // Insert proposal
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          company_id: companyId,
          title: input.title.trim(),
          solicitation_number: input.solicitationNumber || null,
          agency: input.agency || null,
          contract_type: input.contractType || 'tm',
          due_date: input.dueDate || null,
          description: input.description || null,
          status: 'draft',
          row_version: 1,
          working_data: {},
        })
        .select('id, title, solicitation_number, agency, contract_type, status, row_version, created_at')
        .single()

      if (error) {
        console.error('[CreateProposal] Insert error:', error)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message,
          },
        }
      }

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId: context.tenant.tenant.id,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'CreateProposal',
        aggregateType: 'proposal',
        aggregateId: data.id,
        beforeVersion: null, // Create operation
        afterVersion: 1,
        changedFields: null, // All fields are new
        commandInput: {
          title: input.title,
          solicitationNumber: input.solicitationNumber,
          agency: input.agency,
          contractType: input.contractType,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          id: data.id,
          title: data.title,
          solicitationNumber: data.solicitation_number,
          agency: data.agency,
          contractType: data.contract_type,
          status: data.status,
          rowVersion: data.row_version,
          createdAt: data.created_at,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
