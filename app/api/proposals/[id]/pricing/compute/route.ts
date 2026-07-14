/**
 * Compute Pricing Scenario API
 *
 * POST - Compute a new pricing scenario from active WBS + confirmed intelligence
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  runCommand,
  createComputePricingScenarioCommand,
} from '@/lib/commands'

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

  let body: { label?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  try {
    const command = createComputePricingScenarioCommand(supabase)
    const result = await runCommand(supabase, command, {
      proposalId,
      label: body.label,
    })

    if (!result.success) {
      const status =
        result.error?.code === 'NOT_FOUND'
          ? 404
          : result.error?.code === 'VALIDATION_FAILED'
            ? 400
            : 500
      return NextResponse.json({ error: result.error?.message }, { status })
    }

    return NextResponse.json({
      scenario: {
        id: result.data?.scenarioId,
        label: result.data?.label,
        engineVersion: result.data?.engineVersion,
        totalCost: result.data?.totalCost,
        lineCount: result.data?.lineCount,
        wbsEstimateTotalCost: result.data?.wbsEstimateTotalCost,
        wbsEstimateLineCount: result.data?.wbsEstimateLineCount,
        laborLoadingTotalCost: result.data?.laborLoadingTotalCost,
        laborLoadingLineCount: result.data?.laborLoadingLineCount,
        computedAt: result.data?.computedAt,
        needsUtilizationBackfill: result.data?.needsUtilizationBackfill,
      },
    })
  } catch (error) {
    console.error('[POST /pricing/compute] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
