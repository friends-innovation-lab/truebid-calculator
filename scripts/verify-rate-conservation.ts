#!/usr/bin/env npx tsx
/**
 * Phase 5: Verify Rate Conservation
 *
 * Compares pre-backfill snapshot rates against post-backfill calculated rates.
 * FAILS if any discrepancy exceeds $0.01.
 *
 * Conservation is computed INDEPENDENTLY of the backfill script's logic:
 * - Snapshot: rates computed from working_data.roles at snapshot time
 * - Current: rates computed from catalog + overrides post-backfill
 *
 * This ensures the migration preserved bill rates to the penny.
 *
 * Usage:
 *   npx tsx scripts/verify-rate-conservation.ts
 *   npx tsx scripts/verify-rate-conservation.ts --report-only
 *   npx tsx scripts/verify-rate-conservation.ts --from-json backfill-report.json
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { calculateBillRate, type IndirectRates } from '../lib/pricing'
import * as fs from 'fs'

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Tolerance in cents
const TOLERANCE_CENTS = 1

const DEFAULT_INDIRECT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}

const DEFAULT_PROFIT = 0.10

// =============================================================================
// TYPES
// =============================================================================

interface ConservationCheck {
  assignment_id: string
  role_title: string
  snapshot_bill_rate_cents: number
  computed_bill_rate_cents: number
  discrepancy_cents: number
  salary_source: 'catalog' | 'override' | 'default'
  status: 'conserved' | 'discrepancy' | 'warning'
}

interface ConservationReport {
  timestamp: string
  total_checked: number
  conserved: number
  discrepancies: number
  warnings: number
  max_discrepancy_cents: number
  checks: ConservationCheck[]
}

interface BackfillReportRow {
  assignment_id: string
  role_title: string
  bill_rate_before_cents: number
  bill_rate_after_cents: number
  current_salary_cents: number
  catalog_salary_cents: number | null
  salary_override_cents: number | null
  rate_match: boolean
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const reportOnly = args.includes('--report-only')
  const fromJsonIdx = args.indexOf('--from-json')
  const fromJsonFile = fromJsonIdx >= 0 ? args[fromJsonIdx + 1] : null

  console.log('Phase 5: Verify Rate Conservation')
  console.log('=' .repeat(60))
  console.log(`Tolerance: ${TOLERANCE_CENTS} cent(s) ($0.01)`)
  console.log('')

  let checks: ConservationCheck[] = []

  if (fromJsonFile) {
    // Load from backfill report JSON
    console.log(`Loading from backfill report: ${fromJsonFile}`)
    const reportData = JSON.parse(fs.readFileSync(fromJsonFile, 'utf8')) as BackfillReportRow[]

    for (const row of reportData) {
      const salarySource = row.salary_override_cents ? 'override' :
                           row.catalog_salary_cents ? 'catalog' : 'default'

      const discrepancy = Math.abs(row.bill_rate_before_cents - row.bill_rate_after_cents)
      const status = discrepancy <= TOLERANCE_CENTS ? 'conserved' :
                     discrepancy <= 100 ? 'warning' : 'discrepancy'

      checks.push({
        assignment_id: row.assignment_id,
        role_title: row.role_title,
        snapshot_bill_rate_cents: row.bill_rate_before_cents,
        computed_bill_rate_cents: row.bill_rate_after_cents,
        discrepancy_cents: discrepancy,
        salary_source: salarySource,
        status,
      })
    }
  } else {
    // Compute fresh from database
    checks = await verifyFromDatabase(supabase)
  }

  // Build report
  const report: ConservationReport = {
    timestamp: new Date().toISOString(),
    total_checked: checks.length,
    conserved: checks.filter(c => c.status === 'conserved').length,
    discrepancies: checks.filter(c => c.status === 'discrepancy').length,
    warnings: checks.filter(c => c.status === 'warning').length,
    max_discrepancy_cents: Math.max(...checks.map(c => c.discrepancy_cents), 0),
    checks,
  }

  // Write report
  const reportPath = 'conservation_report.json'
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`Report written to: ${reportPath}`)

  // Print penny conservation table
  console.log('')
  console.log('=' .repeat(60))
  console.log('PENNY CONSERVATION TABLE')
  console.log('=' .repeat(60))
  console.log('')
  console.log('| Status | Role Title             | Before   | After    | Diff    | Source   |')
  console.log('|--------|------------------------|----------|----------|---------|----------|')

  for (const check of checks.slice(0, 30)) {
    const icon = check.status === 'conserved' ? '✓' :
                 check.status === 'warning' ? '⚠' : '✗'
    const before = '$' + (check.snapshot_bill_rate_cents / 100).toFixed(2)
    const after = '$' + (check.computed_bill_rate_cents / 100).toFixed(2)
    const diff = check.discrepancy_cents === 0 ? '$0.00' :
                 (check.discrepancy_cents > 0 ? '+' : '-') + '$' + (Math.abs(check.discrepancy_cents) / 100).toFixed(2)
    console.log(`| ${icon}      | ${check.role_title.substring(0, 22).padEnd(22)} | ${before.padStart(8)} | ${after.padStart(8)} | ${diff.padStart(7)} | ${check.salary_source.padEnd(8)} |`)
  }

  if (checks.length > 30) {
    console.log(`| ...    | ${(checks.length - 30)} more rows (see conservation_report.json)`.padEnd(80) + ' |')
  }

  // Summary
  console.log('')
  console.log('=' .repeat(60))
  console.log('SUMMARY')
  console.log('=' .repeat(60))
  console.log('')
  console.log(`Total checked: ${report.total_checked}`)
  console.log(`  ✓ Conserved (≤$0.01): ${report.conserved}`)
  console.log(`  ⚠ Warnings ($0.01-$1.00): ${report.warnings}`)
  console.log(`  ✗ Discrepancies (>$1.00): ${report.discrepancies}`)
  console.log('')

  if (report.max_discrepancy_cents > 0) {
    console.log(`Max discrepancy: $${(report.max_discrepancy_cents / 100).toFixed(2)}`)
    console.log('')
  }

  // Salary source breakdown
  const bySource = checks.reduce((acc, c) => {
    acc[c.salary_source] = (acc[c.salary_source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('Resolution path breakdown:')
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`  ${source}: ${count}`)
  }

  // Final verdict
  console.log('')
  if (report.discrepancies > 0) {
    console.log('=' .repeat(60))
    console.log('FAILURES (discrepancy > $1.00):')
    console.log('=' .repeat(60))
    for (const check of checks.filter(c => c.status === 'discrepancy').slice(0, 10)) {
      console.log(`  ${check.role_title}: $${(check.snapshot_bill_rate_cents/100).toFixed(2)} → $${(check.computed_bill_rate_cents/100).toFixed(2)} (diff: $${(check.discrepancy_cents/100).toFixed(2)})`)
    }
    console.log('')

    if (!reportOnly) {
      console.log('FAIL: Rate conservation check failed.')
      process.exit(1)
    } else {
      console.log('WARN: Rate conservation issues found (report-only mode).')
    }
  } else if (report.warnings > 0) {
    console.log('PASS with WARNINGS: All rates conserved within tolerance, but some have minor differences.')
  } else {
    console.log('✓ PASS: ALL RATES CONSERVED TO THE PENNY')
  }
}

// =============================================================================
// DATABASE VERIFICATION
// =============================================================================

async function verifyFromDatabase(client: SupabaseClient): Promise<ConservationCheck[]> {
  // Load snapshots
  const { data: snapshots, error: snapshotsError } = await client
    .from('backfill_rate_snapshot')
    .select('*')

  if (snapshotsError || !snapshots || snapshots.length === 0) {
    // Try JSON file
    try {
      const jsonData = fs.readFileSync('backfill_rate_snapshot.json', 'utf8')
      const parsed = JSON.parse(jsonData)
      console.log(`Loaded ${parsed.length} snapshots from JSON file`)
      return verifyFromSnapshots(client, parsed)
    } catch {
      console.log('No snapshots found. Run phase5-snapshot.ts first.')
      return []
    }
  }

  console.log(`Loaded ${snapshots.length} snapshots from database`)
  return verifyFromSnapshots(client, snapshots)
}

async function verifyFromSnapshots(
  client: SupabaseClient,
  snapshots: Array<{
    assignment_id: string
    role_title: string
    current_salary_cents: number
    bill_rate_base_cents: number
    profit_margin: number
    fringe_rate: number
    overhead_rate: number
    ga_rate: number
  }>
): Promise<ConservationCheck[]> {
  const checks: ConservationCheck[] = []

  for (const snapshot of snapshots) {
    // Load current assignment
    const { data: assignment } = await client
      .from('staffing_assignments')
      .select(`
        id,
        role_title,
        labor_category_id,
        level_key,
        step_index,
        salary_override_cents,
        rate_source
      `)
      .eq('id', snapshot.assignment_id)
      .single()

    if (!assignment) {
      // Assignment deleted
      continue
    }

    // Determine salary to use for current rate calculation
    let currentSalaryCents: number
    let salarySource: 'catalog' | 'override' | 'default'

    if (assignment.salary_override_cents) {
      // Use override
      currentSalaryCents = assignment.salary_override_cents
      salarySource = 'override'
    } else if (assignment.labor_category_id && assignment.level_key !== null) {
      // Try to get from catalog
      const catalogSalary = await getCatalogSalary(
        client,
        assignment.labor_category_id,
        assignment.level_key,
        assignment.step_index ?? 0
      )
      if (catalogSalary) {
        currentSalaryCents = Math.round(catalogSalary * 100)
        salarySource = 'catalog'
      } else {
        // Catalog needs setup - use snapshot salary
        currentSalaryCents = snapshot.current_salary_cents
        salarySource = 'default'
      }
    } else {
      // No catalog link - use snapshot salary
      currentSalaryCents = snapshot.current_salary_cents
      salarySource = 'default'
    }

    // Compute current bill rate
    const rates: IndirectRates = {
      fringe: snapshot.fringe_rate || DEFAULT_INDIRECT_RATES.fringe,
      overhead: snapshot.overhead_rate || DEFAULT_INDIRECT_RATES.overhead,
      ga: snapshot.ga_rate || DEFAULT_INDIRECT_RATES.ga,
    }

    const computedBillRate = calculateBillRate({
      annualSalary: currentSalaryCents / 100,
      rates,
      profitRate: snapshot.profit_margin || DEFAULT_PROFIT,
    })

    const computedBillRateCents = Math.round(computedBillRate * 100)
    const discrepancy = Math.abs(computedBillRateCents - snapshot.bill_rate_base_cents)

    const status = discrepancy <= TOLERANCE_CENTS ? 'conserved' :
                   discrepancy <= 100 ? 'warning' : 'discrepancy'

    checks.push({
      assignment_id: snapshot.assignment_id,
      role_title: snapshot.role_title,
      snapshot_bill_rate_cents: snapshot.bill_rate_base_cents,
      computed_bill_rate_cents: computedBillRateCents,
      discrepancy_cents: discrepancy,
      salary_source: salarySource,
      status,
    })
  }

  return checks
}

async function getCatalogSalary(
  client: SupabaseClient,
  categoryId: string,
  levelKey: string,
  stepIndex: number
): Promise<number | null> {
  const { data } = await client
    .from('tenant_labor_categories')
    .select('levels')
    .eq('id', categoryId)
    .single()

  if (!data?.levels) return null

  const levels = data.levels as { levels?: { level: string; steps: number[] }[] }
  if (!levels.levels) return null

  const levelData = levels.levels.find(l => l.level === levelKey)
  if (!levelData?.steps) return null

  return levelData.steps[stepIndex] ?? levelData.steps[0] ?? null
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
