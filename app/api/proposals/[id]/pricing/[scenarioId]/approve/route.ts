/**
 * Approve Pricing Scenario API
 *
 * POST - Approve a draft pricing scenario
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  runCommand,
  createApprovePricingScenarioCommand,
} from '@/lib/commands'
import { resolveTenantContext } from '@/lib/tenancy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, scenarioId } = await params

  let body: { expectedVersion?: number } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  try {
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // Verify scenario belongs to proposal
    const { data: scenario, error: scenarioError } = await supabase
      .from('pricing_scenarios')
      .select('id, proposal_id')
      .eq('id', scenarioId)
      .eq('proposal_id', proposalId)
      .eq('tenant_id', tenantId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json(
        { error: 'Pricing scenario not found' },
        { status: 404 }
      )
    }

    const command = createApprovePricingScenarioCommand(supabase)
    const result = await runCommand(supabase, command, {
      scenarioId,
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
      approved: result.data?.approved,
      scenarioId: result.data?.scenarioId,
      supersededId: result.data?.supersededId,
      newRowVersion: result.data?.newRowVersion,
    })
  } catch (error) {
    console.error('[POST /pricing/[scenarioId]/approve] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
