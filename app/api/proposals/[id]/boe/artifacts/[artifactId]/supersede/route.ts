import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveTenantContext } from '@/lib/tenancy'

/**
 * POST /api/proposals/[id]/boe/artifacts/[artifactId]/supersede
 *
 * Manually supersedes a BOE artifact.
 * Note: Supersession typically happens automatically via the partial unique index
 * when a new artifact is generated for the same triple.
 *
 * Auth: service_role + explicit tenant authorization via resolveTenantContext
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const { id: proposalId, artifactId } = await params

  try {
    // Use authenticated client for tenant context resolution
    const supabase = await createClient()

    // Verify authentication and tenant authorization
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve tenant context
    const tenantContext = await resolveTenantContext(supabase)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the artifact exists and belongs to the proposal
    const { data: artifact, error: artifactError } = await supabase
      .from('boe_artifacts')
      .select('id, status, tenant_id')
      .eq('id', artifactId)
      .eq('proposal_id', proposalId)
      .single()

    if (artifactError || !artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    // Verify tenant match
    if (artifact.tenant_id !== tenantContext.tenant.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if already superseded
    if (artifact.status === 'superseded') {
      return NextResponse.json(
        { error: 'Artifact is already superseded' },
        { status: 400 }
      )
    }

    // Use service client for the update (bypasses RLS)
    const serviceClient = createServiceClient()

    const { error: updateError } = await serviceClient
      .from('boe_artifacts')
      .update({
        status: 'superseded',
        superseded_at: new Date().toISOString(),
      })
      .eq('id', artifactId)

    if (updateError) {
      console.error('[BOE Supersede] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to supersede artifact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BOE Supersede] Error:', error)
    return NextResponse.json(
      { error: 'Failed to supersede artifact' },
      { status: 500 }
    )
  }
}
