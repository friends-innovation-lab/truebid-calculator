/**
 * Pricing Scenario Detail API
 *
 * GET - Get a single pricing scenario with metadata
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTenantContext } from '@/lib/tenancy'
import type { PricingScenarioStatus, RateConfigSnapshot } from '@/lib/commands'

interface ScenarioRow {
  id: string
  proposal_id: string
  wbs_version_id: string
  label: string
  status: PricingScenarioStatus
  engine_version: string
  computed_at: string
  rate_config_snapshot: RateConfigSnapshot
  created_by: string | null
  row_version: number
}

export async function GET(
  _request: Request,
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

  try {
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // Load scenario
    const { data: scenario, error: scenarioError } = await supabase
      .from('pricing_scenarios')
      .select('*')
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

    const scenarioRow = scenario as ScenarioRow

    // Get active WBS to check staleness
    const { data: activeWbs } = await supabase
      .from('wbs_versions')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('status', 'active')
      .single()

    // Get approver info if approved
    let approvedBy: string | null = null
    if (scenarioRow.status === 'approved' && scenarioRow.created_by) {
      const { data: approver } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', scenarioRow.created_by)
        .single()

      if (approver) {
        approvedBy = approver.full_name || approver.email
      }
    }

    return NextResponse.json({
      scenario: {
        id: scenarioRow.id,
        proposalId: scenarioRow.proposal_id,
        wbsVersionId: scenarioRow.wbs_version_id,
        label: scenarioRow.label,
        status: scenarioRow.status,
        engineVersion: scenarioRow.engine_version,
        computedAt: scenarioRow.computed_at,
        rateConfig: scenarioRow.rate_config_snapshot,
        rowVersion: scenarioRow.row_version,
        isStale: activeWbs?.id !== scenarioRow.wbs_version_id,
        approvedBy,
      },
    })
  } catch (error) {
    console.error('[GET /pricing/[scenarioId]] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
