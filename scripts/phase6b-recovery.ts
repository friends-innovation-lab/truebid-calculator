#!/usr/bin/env npx tsx
/**
 * Phase 6B Recovery Script
 *
 * Purpose:
 * 1. Discard the mangled intelligence draft (v2) that predates the copy-forward fix
 * 2. Verify all 28 staffing assignments match the approved pricing scenario
 * 3. Report any discrepancies for manual recovery
 *
 * Run: npx tsx scripts/phase6b-recovery.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY and database URL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface RecoveryReport {
  intelligenceDraftDiscarded: boolean
  staffingAssignmentCount: number
  pricingLineCount: number
  discrepancies: string[]
  recoveryActions: string[]
}

async function runRecovery(): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    intelligenceDraftDiscarded: false,
    staffingAssignmentCount: 0,
    pricingLineCount: 0,
    discrepancies: [],
    recoveryActions: [],
  }

  console.log('\n=== Phase 6B Recovery Script ===\n')

  // Step 1: Find the proposal and its intelligence versions
  console.log('Step 1: Identifying proposal and intelligence versions...')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, active_intelligence_version_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!proposals || proposals.length === 0) {
    console.error('No proposals found')
    return report
  }

  console.log('Recent proposals:')
  for (const p of proposals) {
    console.log(`  - ${p.title} (${p.id.substring(0, 8)}...) active_iv: ${p.active_intelligence_version_id?.substring(0, 8) || 'null'}`)
  }

  // For now, work with the first proposal (most recent)
  const targetProposal = proposals[0]
  console.log(`\nTarget: ${targetProposal.title}`)

  // Step 2: List all intelligence versions for this proposal
  console.log('\nStep 2: Listing intelligence versions...')

  const { data: intelligenceVersions } = await supabase
    .from('intelligence_versions')
    .select('id, version_number, status, staffing_model, created_at')
    .eq('proposal_id', targetProposal.id)
    .order('version_number', { ascending: false })

  if (!intelligenceVersions) {
    console.error('Failed to load intelligence versions')
    return report
  }

  console.log('Intelligence versions:')
  for (const iv of intelligenceVersions) {
    const isActive = iv.id === targetProposal.active_intelligence_version_id
    console.log(`  - v${iv.version_number} (${iv.status}) staffing_model=${iv.staffing_model} ${isActive ? '[ACTIVE]' : ''}`)
  }

  // Step 3: Find the draft version (the one to discard)
  const draftVersion = intelligenceVersions.find(iv => iv.status === 'draft')

  if (draftVersion) {
    console.log(`\nStep 3: Found draft intelligence version v${draftVersion.version_number} to discard`)
    console.log('  This draft predates the copy-forward fix and has mangled data.')

    // Check what's in the draft
    const { data: draftLaborReqs } = await supabase
      .from('intelligence_labor_requirements')
      .select('id, title, is_prescribed')
      .eq('version_id', draftVersion.id)

    console.log(`  Draft has ${draftLaborReqs?.length || 0} labor requirements`)

    // DELETE THE DRAFT
    console.log('\n  DISCARDING DRAFT...')

    // Delete labor requirements first (FK constraint)
    const { error: deleteLaborReqsError } = await supabase
      .from('intelligence_labor_requirements')
      .delete()
      .eq('version_id', draftVersion.id)

    if (deleteLaborReqsError) {
      console.error('  Failed to delete labor requirements:', deleteLaborReqsError.message)
    }

    // Delete disciplines
    const { error: deleteDiscError } = await supabase
      .from('intelligence_disciplines')
      .delete()
      .eq('version_id', draftVersion.id)

    if (deleteDiscError) {
      console.error('  Failed to delete disciplines:', deleteDiscError.message)
    }

    // Delete periods
    const { error: deletePeriodsError } = await supabase
      .from('intelligence_periods')
      .delete()
      .eq('version_id', draftVersion.id)

    if (deletePeriodsError) {
      console.error('  Failed to delete periods:', deletePeriodsError.message)
    }

    // Delete the version itself
    const { error: deleteVersionError } = await supabase
      .from('intelligence_versions')
      .delete()
      .eq('id', draftVersion.id)

    if (deleteVersionError) {
      console.error('  Failed to delete version:', deleteVersionError.message)
    } else {
      console.log('  ✓ Draft intelligence version discarded')
      report.intelligenceDraftDiscarded = true
      report.recoveryActions.push(`Discarded intelligence draft v${draftVersion.version_number}`)
    }
  } else {
    console.log('\nStep 3: No draft intelligence version found to discard')
  }

  // Step 4: Verify WBS and staffing assignments
  console.log('\nStep 4: Verifying WBS and staffing assignments...')

  const { data: wbsVersions } = await supabase
    .from('wbs_versions')
    .select('id, version_number, status, is_current')
    .eq('proposal_id', targetProposal.id)
    .order('version_number', { ascending: false })

  console.log('WBS versions:')
  for (const wbs of wbsVersions || []) {
    console.log(`  - v${wbs.version_number} (${wbs.status}) is_current=${wbs.is_current}`)
  }

  const activeWbs = wbsVersions?.find(w => w.is_current === true)

  if (activeWbs) {
    // Count staffing assignments
    const { data: assignments, count } = await supabase
      .from('staffing_assignments')
      .select('id, role_title, period_label, hours', { count: 'exact' })
      .in('wbs_task_id', await getTaskIdsForWbs(activeWbs.id))

    report.staffingAssignmentCount = count || 0
    console.log(`\nActive WBS v${activeWbs.version_number} has ${count} staffing assignments`)

    // Group by role
    const roleGroups = new Map<string, number>()
    for (const a of assignments || []) {
      roleGroups.set(a.role_title, (roleGroups.get(a.role_title) || 0) + 1)
    }
    console.log('Assignments by role:')
    for (const [role, cnt] of roleGroups) {
      console.log(`  - ${role}: ${cnt}`)
    }
  }

  // Step 5: Verify against pricing scenario
  console.log('\nStep 5: Verifying against approved pricing scenario...')

  const { data: scenarios } = await supabase
    .from('pricing_scenarios')
    .select('id, status, line_count, total_cost_cents')
    .eq('proposal_id', targetProposal.id)
    .order('created_at', { ascending: false })

  const approvedScenario = scenarios?.find(s => s.status === 'approved')

  if (approvedScenario) {
    console.log(`Approved scenario has ${approvedScenario.line_count} lines`)

    const { count: lineCount } = await supabase
      .from('pricing_lines')
      .select('id', { count: 'exact' })
      .eq('scenario_id', approvedScenario.id)

    report.pricingLineCount = lineCount || 0
    console.log(`Pricing lines count: ${lineCount}`)

    // Compare counts
    if (report.staffingAssignmentCount !== (lineCount || 0)) {
      const discrepancy = `Assignment count (${report.staffingAssignmentCount}) != pricing line count (${lineCount})`
      report.discrepancies.push(discrepancy)
      console.log(`⚠️ DISCREPANCY: ${discrepancy}`)
    } else {
      console.log('✓ Assignment count matches pricing line count')
    }
  } else {
    console.log('No approved pricing scenario found')
  }

  // Step 6: Summary
  console.log('\n=== Recovery Summary ===')
  console.log(`Intelligence draft discarded: ${report.intelligenceDraftDiscarded}`)
  console.log(`Staffing assignments: ${report.staffingAssignmentCount}`)
  console.log(`Pricing lines: ${report.pricingLineCount}`)
  console.log(`Discrepancies: ${report.discrepancies.length}`)

  if (report.discrepancies.length > 0) {
    console.log('\nDiscrepancies found:')
    for (const d of report.discrepancies) {
      console.log(`  - ${d}`)
    }
  }

  console.log('\nRecovery actions taken:')
  for (const a of report.recoveryActions) {
    console.log(`  ✓ ${a}`)
  }

  return report
}

async function getTaskIdsForWbs(wbsVersionId: string): Promise<string[]> {
  const { data: tasks } = await supabase
    .from('wbs_tasks')
    .select('id')
    .eq('wbs_version_id', wbsVersionId)

  return tasks?.map(t => t.id) || []
}

// Run the recovery
runRecovery()
  .then(report => {
    console.log('\n=== Recovery Complete ===')
    process.exit(report.discrepancies.length > 0 ? 1 : 0)
  })
  .catch(error => {
    console.error('Recovery failed:', error)
    process.exit(1)
  })
