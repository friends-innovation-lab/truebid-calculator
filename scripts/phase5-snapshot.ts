#!/usr/bin/env npx tsx
/**
 * Phase 5: Pre-Backfill Snapshot
 *
 * Creates a snapshot of current staffing assignment pricing data
 * before migrating to the labor catalog. Used to verify rate conservation.
 *
 * The snapshot computes bill rates INDEPENDENTLY using the current source
 * (working_data.roles + company_roles) to establish ground truth.
 *
 * Usage:
 *   npx tsx scripts/phase5-snapshot.ts
 *   npx tsx scripts/phase5-snapshot.ts --dry-run
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  calculateBillRate,
  type IndirectRates,
} from '../lib/pricing'

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

// =============================================================================
// TYPES
// =============================================================================

interface SalaryLevel {
  level: string
  level_title?: string
  steps: number[]
}

interface CompanyRole {
  title: string
  salary_levels?: SalaryLevel[]
}

interface WorkingDataRole {
  name: string
  currentSalary?: number
  selectedLevel?: string
  selectedStep?: number
  billRateBase?: number
  profitMargin?: number
}

interface SnapshotRow {
  assignment_id: string
  tenant_id: string
  proposal_id: string
  role_title: string
  discipline: string
  current_salary_cents: number
  bill_rate_base_cents: number
  selected_level: string | null
  selected_step: number | null
  profit_margin: number
  resolution_path: string // 'working_data' | 'company_roles' | 'default'
  fringe_rate: number
  overhead_rate: number
  ga_rate: number
}

// Default indirect rates (fallback)
const DEFAULT_INDIRECT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}

// Default salaries by role (IC3 Step 0 from fftc-roles-v2.json)
const DEFAULT_SALARIES: Record<string, number> = {
  'Back-end Developer': 120000,
  'Front-end Developer': 128000,
  'DevOps Engineer': 120000,
  'QA Engineer': 103000,
  'Product Manager': 125000,
  'Product Designer': 118000,
  'UX Researcher': 118000,
  'Content/UX Writer': 95000,
  'Delivery Manager': 125000,
  'Technical Lead': 145000,
  'Design Lead': 138000,
}

const DEFAULT_PROFIT = 0.10

// =============================================================================
// HELPERS
// =============================================================================

async function loadCompanySettings(
  client: SupabaseClient,
  companyId: string
): Promise<IndirectRates> {
  const { data } = await client
    .from('company_settings')
    .select('fringe_rate, overhead_rate, ga_rate')
    .eq('company_id', companyId)
    .single()

  if (!data) return DEFAULT_INDIRECT_RATES

  return {
    fringe: data.fringe_rate ?? DEFAULT_INDIRECT_RATES.fringe,
    overhead: data.overhead_rate ?? DEFAULT_INDIRECT_RATES.overhead,
    ga: data.ga_rate ?? DEFAULT_INDIRECT_RATES.ga,
  }
}

async function loadCompanyRoles(
  client: SupabaseClient,
  companyId: string
): Promise<CompanyRole[]> {
  const { data } = await client
    .from('company_roles')
    .select('title, salary_levels')
    .eq('company_id', companyId)

  return (data || []) as CompanyRole[]
}

function getSalaryFromCompanyRoles(
  roles: CompanyRole[],
  roleTitle: string,
  level: string,
  step: number
): number | null {
  const role = roles.find(r => r.title === roleTitle)
  if (!role?.salary_levels) return null

  const levelData = role.salary_levels.find(l => l.level === level)
  if (!levelData?.steps) return null

  return levelData.steps[step] ?? levelData.steps[0] ?? null
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('Phase 5: Pre-Backfill Snapshot')
  console.log('=' .repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  // 1. Get all staffing assignments with proposal context
  const { data: assignments, error: assignmentsError } = await supabase
    .from('staffing_assignments')
    .select(`
      id,
      tenant_id,
      role_title,
      discipline,
      wbs_tasks!inner(
        wbs_version_id,
        wbs_versions!inner(
          proposal_id,
          proposals!inner(
            id,
            company_id,
            working_data
          )
        )
      )
    `)

  if (assignmentsError) {
    console.error('ERROR: Failed to fetch assignments:', assignmentsError.message)
    process.exit(1)
  }

  console.log(`Found ${assignments?.length ?? 0} staffing assignments`)
  console.log('')

  if (!assignments || assignments.length === 0) {
    console.log('No assignments to snapshot.')
    return
  }

  // 2. Group by proposal for efficient loading
  interface AssignmentWithContext {
    id: string
    tenant_id: string
    role_title: string
    discipline: string
    proposal_id: string
    company_id: string | null
    working_data: Record<string, unknown>
  }

  const assignmentsWithContext: AssignmentWithContext[] = assignments.map(a => {
     
    const task = a.wbs_tasks as any
    const version = task.wbs_versions
    const proposal = version.proposals
    return {
      id: a.id,
      tenant_id: a.tenant_id,
      role_title: a.role_title,
      discipline: a.discipline,
      proposal_id: proposal.id,
      company_id: proposal.company_id,
      working_data: (proposal.working_data || {}) as Record<string, unknown>,
    }
  })

  // Cache company data
  const companyCache = new Map<string, {
    rates: IndirectRates
    roles: CompanyRole[]
  }>()

  // 3. Create snapshots
  const snapshots: SnapshotRow[] = []
  let successCount = 0
  let errorCount = 0

  for (const assignment of assignmentsWithContext) {
    try {
      // Load company data (cached)
      let companyData = companyCache.get(assignment.company_id || '')
      if (!companyData && assignment.company_id) {
        const rates = await loadCompanySettings(supabase, assignment.company_id)
        const roles = await loadCompanyRoles(supabase, assignment.company_id)
        companyData = { rates, roles }
        companyCache.set(assignment.company_id, companyData)
      }

      const rates = companyData?.rates || DEFAULT_INDIRECT_RATES
      const companyRoles = companyData?.roles || []

      // Resolve salary and level from working_data.roles first
      const workingDataRoles = (assignment.working_data.roles || []) as WorkingDataRole[]
      const existingRole = workingDataRoles.find(r => r.name === assignment.role_title)

      let salary: number
      let level: string | null = null
      let step: number | null = null
      let profit: number = DEFAULT_PROFIT
      let resolutionPath: string

      if (existingRole?.currentSalary) {
        // Source: working_data.roles
        salary = existingRole.currentSalary
        level = existingRole.selectedLevel || null
        step = existingRole.selectedStep ?? null
        profit = existingRole.profitMargin ?? DEFAULT_PROFIT
        resolutionPath = 'working_data'
      } else {
        // Try company_roles
        const defaultLevel = 'IC3'
        const defaultStep = 0
        const companySalary = getSalaryFromCompanyRoles(
          companyRoles,
          assignment.role_title,
          defaultLevel,
          defaultStep
        )

        if (companySalary) {
          salary = companySalary
          level = defaultLevel
          step = defaultStep
          resolutionPath = 'company_roles'
        } else {
          // Fallback to hardcoded defaults
          salary = DEFAULT_SALARIES[assignment.role_title] || 120000
          level = 'IC3'
          step = 0
          resolutionPath = 'default'
        }
      }

      // Compute bill rate using pricing engine
      const billRate = calculateBillRate({
        annualSalary: salary,
        rates,
        profitRate: profit,
      })

      const snapshot: SnapshotRow = {
        assignment_id: assignment.id,
        tenant_id: assignment.tenant_id,
        proposal_id: assignment.proposal_id,
        role_title: assignment.role_title,
        discipline: assignment.discipline,
        current_salary_cents: Math.round(salary * 100),
        bill_rate_base_cents: Math.round(billRate * 100),
        selected_level: level,
        selected_step: step,
        profit_margin: profit,
        resolution_path: resolutionPath,
        fringe_rate: rates.fringe,
        overhead_rate: rates.overhead,
        ga_rate: rates.ga,
      }

      snapshots.push(snapshot)

      if (dryRun) {
        console.log(`  [DRY RUN] ${assignment.role_title}: $${salary.toLocaleString()} → $${billRate.toFixed(2)}/hr (${resolutionPath})`)
      }

      successCount++
    } catch (err) {
      console.error(`  ERROR: ${assignment.role_title} (${assignment.id}):`, err)
      errorCount++
    }
  }

  // 4. Write to database (or output JSON in dry-run)
  if (dryRun) {
    console.log('')
    console.log('Snapshot preview (first 10):')
    console.log(JSON.stringify(snapshots.slice(0, 10), null, 2))
  } else {
    // Create table if not exists (idempotent)
    // Note: In production this would be a migration
    console.log('Writing snapshots to backfill_rate_snapshot table...')

    // Clear existing snapshots
    const { error: deleteError } = await supabase
      .from('backfill_rate_snapshot')
      .delete()
      .neq('assignment_id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError && !deleteError.message.includes('does not exist')) {
      console.error('Warning: Could not clear existing snapshots:', deleteError.message)
    }

    // Insert new snapshots
    const { error: insertError } = await supabase
      .from('backfill_rate_snapshot')
      .insert(snapshots)

    if (insertError) {
      console.error('ERROR: Failed to insert snapshots:', insertError.message)
      console.log('')
      console.log('Writing to JSON file instead...')
      const fs = await import('fs')
      fs.writeFileSync(
        'backfill_rate_snapshot.json',
        JSON.stringify(snapshots, null, 2)
      )
      console.log('Snapshot written to: backfill_rate_snapshot.json')
    } else {
      console.log(`Inserted ${snapshots.length} snapshots`)
    }
  }

  // 5. Summary
  console.log('')
  console.log('=' .repeat(60))
  console.log('SUMMARY')
  console.log('')
  console.log(`Total assignments: ${assignmentsWithContext.length}`)
  console.log(`  Snapshotted: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log('')

  // Resolution path breakdown
  const byPath = snapshots.reduce((acc, s) => {
    acc[s.resolution_path] = (acc[s.resolution_path] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('Resolution paths:')
  for (const [path, count] of Object.entries(byPath)) {
    console.log(`  ${path}: ${count}`)
  }

  // Discipline breakdown
  const byDiscipline = snapshots.reduce((acc, s) => {
    acc[s.discipline] = (acc[s.discipline] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('')
  console.log('Disciplines (pre-backfill):')
  for (const [disc, count] of Object.entries(byDiscipline)) {
    console.log(`  ${disc}: ${count}`)
  }
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
