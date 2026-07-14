import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/proposals/[id]/boe/artifacts
 *
 * Lists all BOE artifacts for a proposal.
 *
 * Auth: Authenticated user session + RLS (tenant-scoped via get_user_tenant_ids)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params

  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch artifacts for this proposal
    // RLS ensures only artifacts from user's tenant are returned
    const { data: artifacts, error } = await supabase
      .from('boe_artifacts')
      .select(
        `
        id,
        status,
        content_hash,
        engine_version,
        generated_at,
        generated_by,
        superseded_at,
        intelligence_version_id,
        wbs_version_id,
        pricing_scenario_id
      `
      )
      .eq('proposal_id', proposalId)
      .order('generated_at', { ascending: false })

    if (error) {
      console.error('[BOE Artifacts List] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch artifacts' },
        { status: 500 }
      )
    }

    // Transform to camelCase for client
    const transformedArtifacts = (artifacts ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      contentHash: a.content_hash,
      engineVersion: a.engine_version,
      generatedAt: a.generated_at,
      generatedBy: a.generated_by,
      supersededAt: a.superseded_at,
      intelligenceVersionId: a.intelligence_version_id,
      wbsVersionId: a.wbs_version_id,
      pricingScenarioId: a.pricing_scenario_id,
    }))

    return NextResponse.json({ artifacts: transformedArtifacts })
  } catch (error) {
    console.error('[BOE Artifacts List] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artifacts' },
      { status: 500 }
    )
  }
}
