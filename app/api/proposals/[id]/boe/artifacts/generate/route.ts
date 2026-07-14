import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveTenantContext } from '@/lib/tenancy'
import { runCommand, createGenerateBOEArtifactCommand } from '@/lib/commands'

/**
 * POST /api/proposals/[id]/boe/artifacts/generate
 *
 * Generates a BOE artifact from an approved pricing scenario.
 *
 * Auth: service_role (bypasses RLS) + explicit tenant authorization via resolveTenantContext
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params

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

    // Resolve tenant context - this ensures user has access to the proposal
    const tenantContext = await resolveTenantContext(supabase)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { pricingScenarioId } = body

    if (!pricingScenarioId) {
      return NextResponse.json(
        { error: 'pricingScenarioId is required' },
        { status: 400 }
      )
    }

    // Verify the proposal belongs to user's tenant
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, company_id')
      .eq('id', proposalId)
      .single()

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Verify company matches tenant
    const { data: company } = await supabase
      .from('companies')
      .select('tenant_id')
      .eq('id', proposal.company_id)
      .single()

    if (!company || company.tenant_id !== tenantContext.tenant.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service client for the command (bypasses RLS)
    const serviceClient = createServiceClient()
    const command = createGenerateBOEArtifactCommand(serviceClient)

    const result = await runCommand(serviceClient, command, {
      proposalId,
      pricingScenarioId,
    })

    if (!result.success) {
      // Return structured error for CITATION_INCOMPLETE
      if (result.error?.code === 'CITATION_INCOMPLETE') {
        return NextResponse.json(
          {
            error: result.error.message,
            code: result.error.code,
            details: result.error.details,
          },
          { status: 422 }
        )
      }

      return NextResponse.json(
        { error: result.error?.message || 'Failed to generate artifact' },
        { status: 500 }
      )
    }

    const data = result.data!
    return NextResponse.json({
      artifactId: data.artifactId,
      contentHash: data.contentHash,
      engineVersion: data.engineVersion,
      lineCount: data.lineCount,
      citationCount: data.citationCount,
      totals: data.totals,
      conservation: data.conservation,
      generatedAt: data.generatedAt,
    })
  } catch (error) {
    console.error('[BOE Generate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate artifact' },
      { status: 500 }
    )
  }
}
