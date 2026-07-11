/**
 * Confirm Intelligence Version API
 *
 * POST - Confirm a draft intelligence version
 *
 * Computes SHA-256 hash from fresh DB read-back and sets status to confirmed.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  runCommand,
  createConfirmIntelligenceVersionCommand,
  getCurrentIntelligenceVersion,
} from '@/lib/commands'
import { resolveTenantContext } from '@/lib/tenancy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  let body: {
    versionId?: string
    expectedVersion?: number
  } = {}

  try {
    body = await request.json()
  } catch {
    // Body is optional - if not provided, confirm current draft
  }

  try {
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // If no versionId provided, get current version
    let versionId = body.versionId
    if (!versionId) {
      const current = await getCurrentIntelligenceVersion(supabase, proposalId, tenantId)
      if (!current) {
        return NextResponse.json(
          { error: 'No intelligence version found for this proposal' },
          { status: 404 }
        )
      }
      if (current.status !== 'draft') {
        return NextResponse.json(
          { error: `Intelligence version is already ${current.status}` },
          { status: 400 }
        )
      }
      versionId = current.versionId
    }

    // Verify version belongs to this proposal
    const { data: version } = await supabase
      .from('intelligence_versions')
      .select('proposal_id')
      .eq('id', versionId)
      .single()

    if (!version || version.proposal_id !== proposalId) {
      return NextResponse.json(
        { error: 'Intelligence version not found for this proposal' },
        { status: 404 }
      )
    }

    const command = createConfirmIntelligenceVersionCommand(supabase)
    const result = await runCommand(supabase, command, {
      versionId,
      expectedVersion: body.expectedVersion,
    })

    if (!result.success) {
      const status =
        result.error?.code === 'NOT_FOUND'
          ? 404
          : result.error?.code === 'INVALID_STATE'
            ? 400
            : result.error?.code === 'STALE_VERSION'
              ? 409
              : 500
      return NextResponse.json({ error: result.error?.message }, { status })
    }

    return NextResponse.json({
      version: {
        id: result.data?.versionId,
        confirmationHash: result.data?.confirmationHash,
        confirmedAt: result.data?.confirmedAt,
        rowVersion: result.data?.rowVersion,
      },
    })
  } catch (error) {
    console.error('[POST /intelligence/confirm] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
