import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/proposals/[id]/boe/preconditions
 *
 * Returns the four gate conditions for BOE generation:
 * 1. Intelligence confirmed
 * 2. WBS active
 * 3. Scenario approved
 * 4. Citation coverage (all wbs_estimate lines have accepted requirement links)
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

    // 1. Check for confirmed intelligence version
    const { data: intelVersions } = await supabase
      .from('intelligence_versions')
      .select('id, status')
      .eq('proposal_id', proposalId)
      .eq('status', 'confirmed')
      .limit(1)

    const intelligenceConfirmed = (intelVersions?.length ?? 0) > 0
    const confirmedIntelVersionId = intelVersions?.[0]?.id

    // 2. Check for active WBS version
    let wbsActive = false
    let activeWbsVersionId: string | null = null

    if (confirmedIntelVersionId) {
      const { data: wbsVersions } = await supabase
        .from('wbs_versions')
        .select('id, status')
        .eq('intelligence_version_id', confirmedIntelVersionId)
        .eq('status', 'active')
        .limit(1)

      wbsActive = (wbsVersions?.length ?? 0) > 0
      activeWbsVersionId = wbsVersions?.[0]?.id ?? null
    }

    // 3. Check for approved pricing scenario
    let scenarioApproved = false
    let approvedScenarioId: string | null = null

    if (activeWbsVersionId) {
      const { data: scenarios } = await supabase
        .from('pricing_scenarios')
        .select('id, status')
        .eq('wbs_version_id', activeWbsVersionId)
        .eq('status', 'approved')
        .limit(1)

      scenarioApproved = (scenarios?.length ?? 0) > 0
      approvedScenarioId = scenarios?.[0]?.id ?? null
    }

    // 4. Check citation coverage (only if scenario approved)
    const citationCoverage = await computeCitationCoverage(supabase, approvedScenarioId)

    return NextResponse.json({
      intelligenceConfirmed,
      wbsActive,
      scenarioApproved,
      citationCoverage,
      // IDs for navigation/generation
      confirmedIntelVersionId,
      activeWbsVersionId,
      approvedScenarioId,
    })
  } catch (error) {
    console.error('[BOE Preconditions] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check preconditions' },
      { status: 500 }
    )
  }
}

/**
 * Compute citation coverage for a pricing scenario.
 */
async function computeCitationCoverage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  approvedScenarioId: string | null
): Promise<{ total: number; cited: number; allCited: boolean }> {
  if (!approvedScenarioId) {
    return { total: 0, cited: 0, allCited: false }
  }

  // Get all wbs_estimate lines for the scenario
  const { data: lines } = await supabase
    .from('pricing_lines')
    .select('id, staffing_assignment_id')
    .eq('pricing_scenario_id', approvedScenarioId)
    .eq('line_type', 'wbs_estimate')

  const totalLines = lines?.length ?? 0

  if (totalLines === 0 || !lines) {
    return { total: 0, cited: 0, allCited: false }
  }

  // Get staffing assignments and their WBS tasks
  const assignmentIds = lines
    .map((l) => l.staffing_assignment_id)
    .filter((id): id is string => id !== null)

  if (assignmentIds.length === 0) {
    return { total: totalLines, cited: 0, allCited: false }
  }

  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select('id, wbs_task_id')
    .in('id', assignmentIds)

  const taskIds = [
    ...new Set(
      (assignments ?? [])
        .map((a) => a.wbs_task_id)
        .filter((id): id is string => id !== null)
    ),
  ]

  if (taskIds.length === 0) {
    return { total: totalLines, cited: 0, allCited: false }
  }

  // Get tasks with accepted requirement links
  const { data: reqLinks } = await supabase
    .from('requirement_links')
    .select('wbs_task_id')
    .in('wbs_task_id', taskIds)
    .eq('status', 'accepted')

  const tasksWithLinks = new Set((reqLinks ?? []).map((l) => l.wbs_task_id))

  // Count how many lines have cited tasks
  const taskIdByAssignment = new Map<string, string>()
  for (const a of assignments ?? []) {
    if (a.wbs_task_id) {
      taskIdByAssignment.set(a.id, a.wbs_task_id)
    }
  }

  let citedCount = 0
  for (const line of lines) {
    if (line.staffing_assignment_id) {
      const taskId = taskIdByAssignment.get(line.staffing_assignment_id)
      if (taskId && tasksWithLinks.has(taskId)) {
        citedCount++
      }
    }
  }

  return {
    total: totalLines,
    cited: citedCount,
    allCited: totalLines > 0 && citedCount === totalLines,
  }
}
