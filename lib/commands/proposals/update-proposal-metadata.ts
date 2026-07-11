/**
 * UpdateProposalMetadata Command
 *
 * Updates basic proposal metadata (title, solicitation number, agency).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult, VersionedInput } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent, detectChanges } from '../runner'
import { NotFoundError, StaleVersionError, ValidationError } from '../errors'

/**
 * Input for updating proposal metadata.
 */
export interface UpdateProposalMetadataInput extends VersionedInput {
  proposalId: string
  title?: string
  solicitationNumber?: string
  agency?: string
  contractType?: 'tm' | 'fp' | 'cpff' | 'cpif' | 'hybrid'
  dueDate?: string | null
}

/**
 * Output from updating proposal metadata.
 */
export interface UpdateProposalMetadataOutput {
  id: string
  title: string
  solicitationNumber: string | null
  agency: string | null
  contractType: string
  dueDate: string | null
  rowVersion: number
}

/**
 * Create the command instance.
 */
export function createUpdateProposalMetadataCommand(
  supabase: SupabaseClient
): Command<UpdateProposalMetadataInput, UpdateProposalMetadataOutput> {
  return {
    name: 'UpdateProposalMetadata',
    aggregateType: 'proposal',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: UpdateProposalMetadataInput
    ): Promise<CommandResult<UpdateProposalMetadataOutput>> {
      // Validate input
      if (!input.proposalId) {
        throw new ValidationError('Proposal ID is required', { proposalId: 'Required field' })
      }

      // At least one field must be provided
      const hasUpdate = input.title !== undefined ||
        input.solicitationNumber !== undefined ||
        input.agency !== undefined ||
        input.contractType !== undefined ||
        input.dueDate !== undefined

      if (!hasUpdate) {
        throw new ValidationError('At least one field must be provided', {
          input: 'No fields to update',
        })
      }

      const companyId = context.tenant.tenant.companyId
      if (!companyId) {
        throw new ValidationError('Tenant has no associated company', {
          tenant: 'No company linked',
        })
      }

      // Load current proposal
      const { data: current, error: loadError } = await supabase
        .from('proposals')
        .select('id, title, solicitation_number, agency, contract_type, due_date, row_version, company_id')
        .eq('id', input.proposalId)
        .single()

      if (loadError || !current) {
        throw new NotFoundError('proposal', input.proposalId)
      }

      // Verify ownership
      if (current.company_id !== companyId) {
        throw new NotFoundError('proposal', input.proposalId)
      }

      // Check version if provided
      if (input.expectedVersion !== undefined && current.row_version !== input.expectedVersion) {
        throw new StaleVersionError({
          aggregateId: input.proposalId,
          currentVersion: current.row_version,
          submittedVersion: input.expectedVersion,
          changedFields: ['title', 'solicitation_number', 'agency', 'contract_type', 'due_date'].filter(
            f => input[f as keyof UpdateProposalMetadataInput] !== undefined
          ),
        })
      }

      // Build update object
      const updateData: Record<string, unknown> = {}
      if (input.title !== undefined) {
        if (input.title.trim().length === 0) {
          throw new ValidationError('Title cannot be empty', { title: 'Cannot be empty' })
        }
        updateData.title = input.title.trim()
      }
      if (input.solicitationNumber !== undefined) {
        updateData.solicitation_number = input.solicitationNumber || null
      }
      if (input.agency !== undefined) {
        updateData.agency = input.agency || null
      }
      if (input.contractType !== undefined) {
        updateData.contract_type = input.contractType
      }
      if (input.dueDate !== undefined) {
        updateData.due_date = input.dueDate
      }

      // Update proposal with optimistic lock
      const { data: updated, error: updateError } = await supabase
        .from('proposals')
        .update(updateData)
        .eq('id', input.proposalId)
        .eq('row_version', current.row_version)
        .select('id, title, solicitation_number, agency, contract_type, due_date, row_version')
        .single()

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          const { data: refetched } = await supabase
            .from('proposals')
            .select('row_version')
            .eq('id', input.proposalId)
            .single()

          throw new StaleVersionError({
            aggregateId: input.proposalId,
            currentVersion: refetched?.row_version ?? current.row_version + 1,
            submittedVersion: current.row_version,
            changedFields: Object.keys(updateData),
          })
        }

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: updateError.message,
          },
        }
      }

      // Detect changes for audit
      const beforeState: Record<string, unknown> = {
        title: current.title,
        solicitation_number: current.solicitation_number,
        agency: current.agency,
        contract_type: current.contract_type,
        due_date: current.due_date,
      }
      const afterState: Record<string, unknown> = {
        title: updated.title,
        solicitation_number: updated.solicitation_number,
        agency: updated.agency,
        contract_type: updated.contract_type,
        due_date: updated.due_date,
      }

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId: context.tenant.tenant.id,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'UpdateProposalMetadata',
        aggregateType: 'proposal',
        aggregateId: input.proposalId,
        beforeVersion: current.row_version,
        afterVersion: updated.row_version,
        changedFields: detectChanges(beforeState, afterState, Object.keys(updateData)),
        commandInput: {
          proposalId: input.proposalId,
          ...Object.fromEntries(
            Object.entries(input).filter(([k]) => k !== 'expectedVersion' && k !== 'proposalId')
          ),
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          id: updated.id,
          title: updated.title,
          solicitationNumber: updated.solicitation_number,
          agency: updated.agency,
          contractType: updated.contract_type,
          dueDate: updated.due_date,
          rowVersion: updated.row_version,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
