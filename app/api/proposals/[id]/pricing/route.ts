/**
 * Pricing Scenarios API
 *
 * GET - List all pricing scenarios for a proposal with summary data
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

interface PricingLineRow {
  extended_cost: number
}

export async function GET(
  _request: Request,
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
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // Load all scenarios for proposal
    const { data: scenarios, error: scenariosError } = await supabase
      .from('pricing_scenarios')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('tenant_id', tenantId)
      .order('computed_at', { ascending: false })

    if (scenariosError) {
      console.error('[GET /pricing] Failed to load scenarios:', scenariosError)
      return NextResponse.json(
        { error: 'Failed to load pricing scenarios' },
        { status: 500 }
      )
    }

    const scenarioRows = (scenarios || []) as ScenarioRow[]

    // Get active WBS version to check for staleness
    const { data: activeWbs } = await supabase
      .from('wbs_versions')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('status', 'active')
      .single()

    const activeWbsVersionId = activeWbs?.id || null

    // Check for confirmed intelligence
    const { data: proposal } = await supabase
      .from('proposals')
      .select('active_intelligence_version_id')
      .eq('id', proposalId)
      .single()

    let hasConfirmedIntelligence = false
    if (proposal?.active_intelligence_version_id) {
      const { data: intelligenceVersion } = await supabase
        .from('intelligence_versions')
        .select('status')
        .eq('id', proposal.active_intelligence_version_id)
        .single()
      hasConfirmedIntelligence = intelligenceVersion?.status === 'confirmed'
    }

    // For each scenario, get line count and total from lines
    const summaries = await Promise.all(
      scenarioRows.map(async (scenario) => {
        const { data: lines } = await supabase
          .from('pricing_lines')
          .select('extended_cost')
          .eq('pricing_scenario_id', scenario.id)

        const lineRows = (lines || []) as PricingLineRow[]
        const totalCost = lineRows.reduce((sum, line) => sum + line.extended_cost, 0)

        return {
          id: scenario.id,
          proposalId: scenario.proposal_id,
          wbsVersionId: scenario.wbs_version_id,
          label: scenario.label,
          status: scenario.status,
          engineVersion: scenario.engine_version,
          computedAt: scenario.computed_at,
          totalCost: Number(totalCost.toFixed(2)),
          lineCount: lineRows.length,
          isStale: activeWbsVersionId !== null && scenario.wbs_version_id !== activeWbsVersionId,
        }
      })
    )

    // Find approved scenario
    const approved = summaries.find((s) => s.status === 'approved') || null

    return NextResponse.json({
      scenarios: summaries,
      approved,
      hasConfirmedIntelligence,
      hasActiveWBS: activeWbsVersionId !== null,
    })
  } catch (error) {
    console.error('[GET /pricing] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
