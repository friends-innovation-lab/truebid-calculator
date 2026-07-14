import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/proposals/[id]/boe/artifacts/[artifactId]
 *
 * Fetches a single BOE artifact with its full content and citations.
 * This is the ONE fetch that the artifact viewer uses.
 * No reads of live pricing_lines anywhere in this path.
 *
 * Auth: Authenticated user session + RLS (tenant-scoped via get_user_tenant_ids)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const { id: proposalId, artifactId } = await params

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

    // Fetch the artifact with its full content
    // RLS ensures only artifacts from user's tenant are returned
    const { data: artifact, error: artifactError } = await supabase
      .from('boe_artifacts')
      .select(
        `
        id,
        tenant_id,
        proposal_id,
        intelligence_version_id,
        wbs_version_id,
        pricing_scenario_id,
        status,
        content,
        content_hash,
        engine_version,
        generated_at,
        generated_by,
        superseded_at,
        row_version
      `
      )
      .eq('id', artifactId)
      .eq('proposal_id', proposalId)
      .single()

    if (artifactError) {
      if (artifactError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
      }
      console.error('[BOE Artifact Fetch] Error:', artifactError)
      return NextResponse.json(
        { error: 'Failed to fetch artifact' },
        { status: 500 }
      )
    }

    // Fetch citations for this artifact
    const { data: citations, error: citationsError } = await supabase
      .from('boe_citations')
      .select(
        `
        artifact_line_id,
        citation_target_type,
        requirement_link_id
      `
      )
      .eq('artifact_id', artifactId)

    if (citationsError) {
      console.error('[BOE Artifact Fetch] Citations error:', citationsError)
      // Don't fail the whole request for citations error
    }

    // Fetch intelligence version hash for provenance display
    let intelligenceHash: string | null = null
    if (artifact.intelligence_version_id) {
      const { data: intelVersion } = await supabase
        .from('intelligence_versions')
        .select('confirmation_hash')
        .eq('id', artifact.intelligence_version_id)
        .single()
      intelligenceHash = intelVersion?.confirmation_hash ?? null
    }

    // Get generator user info
    let generatedByName: string | null = null
    if (artifact.generated_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', artifact.generated_by)
        .single()
      generatedByName = profile?.full_name || profile?.email || null
    }

    // Transform to camelCase for client
    const response = {
      artifact: {
        id: artifact.id,
        proposalId: artifact.proposal_id,
        intelligenceVersionId: artifact.intelligence_version_id,
        intelligenceHash,
        wbsVersionId: artifact.wbs_version_id,
        pricingScenarioId: artifact.pricing_scenario_id,
        status: artifact.status,
        content: artifact.content,
        contentHash: artifact.content_hash,
        engineVersion: artifact.engine_version,
        generatedAt: artifact.generated_at,
        generatedBy: artifact.generated_by,
        generatedByName,
        supersededAt: artifact.superseded_at,
        rowVersion: artifact.row_version,
      },
      citations: (citations ?? []).map((c) => ({
        artifactLineId: c.artifact_line_id,
        citationTargetType: c.citation_target_type,
        requirementLinkId: c.requirement_link_id,
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[BOE Artifact Fetch] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artifact' },
      { status: 500 }
    )
  }
}
