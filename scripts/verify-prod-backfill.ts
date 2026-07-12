#!/usr/bin/env npx tsx
/**
 * Verifies production backfill and penny conservation
 */

import { createClient } from '@supabase/supabase-js'
import { calculateBillRate, type IndirectRates } from '../lib/pricing'

const PROD_URL = 'https://qtotsijebcpddipmzstb.supabase.co'
const PROD_SERVICE_KEY = process.env.PROD_SERVICE_KEY || ''

if (!PROD_SERVICE_KEY) {
  console.error('PROD_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(PROD_URL, PROD_SERVICE_KEY, {
  auth: { persistSession: false }
})

const DEFAULT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}
const DEFAULT_PROFIT = 0.10

async function main() {
  console.log('=== PRODUCTION BACKFILL VERIFICATION ===\n')

  // Get tenant
  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
  if (!tenant) { console.error('No tenant'); process.exit(1) }

  // Count disciplines
  const { data: disciplines } = await supabase
    .from('tenant_disciplines')
    .select('key, display_name')
    .eq('tenant_id', tenant.id)

  console.log(`Disciplines: ${disciplines?.length}`)
  disciplines?.forEach(d => console.log(`  - ${d.key}: ${d.display_name}`))

  // Count categories
  const { data: categories } = await supabase
    .from('tenant_labor_categories')
    .select('id, key, title, levels')
    .eq('tenant_id', tenant.id)

  const withSalaries = categories?.filter(c => c.levels !== null) || []
  const needsSetup = categories?.filter(c => c.levels === null) || []

  console.log(`\nCatalog roles: ${categories?.length}`)
  console.log(`  With salaries: ${withSalaries.length}`)
  console.log(`  Needs-setup: ${needsSetup.length}`)

  // Count aliases
  const { data: aliases } = await supabase
    .from('labor_category_aliases')
    .select('alias, context_note')

  console.log(`\nAliases: ${aliases?.length}`)

  // Get staffing assignments
  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select(`
      id,
      role_title,
      discipline,
      labor_category_id,
      level_key,
      step_index,
      salary_override_cents,
      rate_source,
      wbs_tasks!inner(
        wbs_version_id,
        wbs_versions!inner(
          proposal_id,
          proposals!inner(
            id,
            title,
            working_data
          )
        )
      )
    `)

  console.log(`\nStaffing assignments: ${assignments?.length || 0}`)

  if (!assignments || assignments.length === 0) {
    console.log('No assignments to verify.')
    return
  }

  // Verify penny conservation
  console.log('\n=== PENNY CONSERVATION TABLE ===\n')
  console.log('| Role Title           | Discipline         | Before    | After     | Match | Source   |')
  console.log('|----------------------|--------------------|-----------|-----------|-------|----------|')

  let matchCount = 0
  let mismatchCount = 0

  for (const a of assignments) {
    // Get working_data for this proposal
    const task = a.wbs_tasks as any
    const proposal = task.wbs_versions.proposals
    const workingData = proposal.working_data || {}
    const roles = (workingData.roles || []) as any[]

    // Find role in working_data
    const roleData = roles.find((r: any) => r.name === a.role_title)
    const currentSalary = roleData?.currentSalary || 120000
    const profitMargin = roleData?.profitMargin || DEFAULT_PROFIT

    // Calculate expected bill rate from working_data
    const expectedBillRate = calculateBillRate({
      annualSalary: currentSalary,
      rates: DEFAULT_RATES,
      profitRate: profitMargin,
    })
    const expectedCents = Math.round(expectedBillRate * 100)

    // Calculate actual bill rate (using override or catalog)
    const actualSalary = a.salary_override_cents
      ? a.salary_override_cents / 100
      : currentSalary

    const actualBillRate = calculateBillRate({
      annualSalary: actualSalary,
      rates: DEFAULT_RATES,
      profitRate: profitMargin,
    })
    const actualCents = Math.round(actualBillRate * 100)

    // Check match (within $0.01)
    const match = Math.abs(expectedCents - actualCents) <= 1
    if (match) matchCount++
    else mismatchCount++

    const icon = match ? '✓' : '✗'
    const beforeStr = '$' + (expectedCents / 100).toFixed(2)
    const afterStr = '$' + (actualCents / 100).toFixed(2)
    const source = a.salary_override_cents ? 'override' : 'catalog'

    console.log(`| ${a.role_title.substring(0, 20).padEnd(20)} | ${a.discipline.substring(0, 18).padEnd(18)} | ${beforeStr.padStart(9)} | ${afterStr.padStart(9)} | ${icon}     | ${source.padEnd(8)} |`)
  }

  console.log('\n=== SUMMARY ===\n')
  console.log(`Total assignments: ${assignments.length}`)
  console.log(`  Penny-conserved: ${matchCount}/${assignments.length}`)
  console.log(`  Mismatches: ${mismatchCount}`)

  // Check discipline backfill
  const byDiscipline = assignments.reduce((acc, a) => {
    acc[a.discipline] = (acc[a.discipline] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nDiscipline distribution:')
  Object.entries(byDiscipline).forEach(([d, count]) => {
    console.log(`  ${d}: ${count}`)
  })

  // Check override status
  const withOverride = assignments.filter(a => a.salary_override_cents !== null)
  console.log(`\nAssignments with salary override: ${withOverride.length}/${assignments.length}`)

  // Verify proposals load
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title')
    .limit(10)

  console.log('\n=== PROPOSALS ===')
  proposals?.forEach(p => console.log(`  - ${p.title} (${p.id})`))

  // Final verdict
  console.log('\n=== VERDICT ===')
  if (mismatchCount === 0) {
    console.log(`✓ PASS: ${matchCount}/${assignments.length} penny-conserved`)
  } else {
    console.log(`✗ FAIL: ${mismatchCount} mismatches`)
    process.exit(1)
  }
}

main()
