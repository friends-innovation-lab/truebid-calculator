/**
 * Intelligence Version API
 *
 * GET  - Load current intelligence version with facts
 * PATCH - Update draft facts (periods, disciplines, labor reqs, facts_json)
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTenantContext } from '@/lib/tenancy'
import {
  runCommand,
  createUpdateIntelligenceFactsCommand,
  getCurrentIntelligenceVersion,
  loadIntelligenceVersion,
} from '@/lib/commands'

export async function GET(
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

  try {
    // Resolve tenant
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // Get current version for this proposal
    const currentVersion = await getCurrentIntelligenceVersion(supabase, proposalId, tenantId)

    if (!currentVersion) {
      return NextResponse.json({
        version: null,
        periods: [],
        disciplines: [],
        laborRequirements: [],
        factsJson: {},
      })
    }

    // Load full version data
    const versionData = await loadIntelligenceVersion(supabase, currentVersion.versionId, tenantId)

    if (!versionData) {
      return NextResponse.json({ error: 'Failed to load intelligence version' }, { status: 500 })
    }

    return NextResponse.json({
      version: {
        id: versionData.version.id,
        versionNumber: versionData.version.versionNumber,
        status: versionData.version.status,
        confirmationHash: versionData.version.confirmationHash,
        contractType: versionData.version.contractType,
        extractedAt: versionData.version.extractedAt,
        confirmedAt: versionData.version.confirmedAt,
        rowVersion: versionData.version.rowVersion,
      },
      periods: versionData.periods,
      disciplines: versionData.disciplines,
      laborRequirements: versionData.laborRequirements,
      factsJson: versionData.version.factsJson,
    })
  } catch (error) {
    console.error('[GET /intelligence] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    versionId: string
    expectedVersion?: number
    factsJson?: Record<string, unknown>
    contractType?: string
    periods?: Array<{
      name: string
      months: number
      cumulativeMonthsEnd: number
      gsaRateYear: number
      sortOrder?: number
    }>
    disciplines?: Array<{
      discipline: string
      confidence: string
      sourceText?: string
    }>
    laborRequirements?: Array<{
      title: string
      laborCategory?: string
      hoursPerMonth?: number
      utilizationPct?: number
      appearsInPeriods?: string[]
      confidence: string
      sourceText?: string
    }>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.versionId) {
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 })
  }

  try {
    // Verify version belongs to this proposal
    const { data: version } = await supabase
      .from('intelligence_versions')
      .select('proposal_id')
      .eq('id', body.versionId)
      .single()

    if (!version || version.proposal_id !== proposalId) {
      return NextResponse.json(
        { error: 'Intelligence version not found for this proposal' },
        { status: 404 }
      )
    }

    const command = createUpdateIntelligenceFactsCommand(supabase)
    const result = await runCommand(supabase, command, {
      versionId: body.versionId,
      expectedVersion: body.expectedVersion,
      factsJson: body.factsJson,
      contractType: body.contractType,
      periods: body.periods,
      disciplines: body.disciplines as Parameters<typeof command.execute>[1]['disciplines'],
      laborRequirements: body.laborRequirements as Parameters<typeof command.execute>[1]['laborRequirements'],
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
        rowVersion: result.data?.rowVersion,
      },
    })
  } catch (error) {
    console.error('[PATCH /intelligence] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
