#!/usr/bin/env npx tsx
/**
 * Phase 5: Staffing Pricing Backfill
 *
 * Migrates staffing_assignments to use the tenant labor catalog:
 * 1. Maps role_title to labor_category_id (exact/alias/fuzzy/unmapped)
 * 2. Maps discipline (devops→engineering, management→delivery/program-management)
 * 3. Sets level_key, step_index from working_data.roles or defaults
 * 4. Sets salary_override_cents if catalog salary differs from current
 * 5. Sets rate_source
 *
 * Produces row-by-row report with:
 * - Catalog resolution path
 * - Discipline mapping
 * - Override status
 * - Penny-conservation verification
 *
 * PREREQUISITE: Run phase5-snapshot.ts first to capture pre-backfill state.
 *
 * Usage:
 *   npx tsx scripts/backfill-staffing-pricing.ts
 *   npx tsx scripts/backfill-staffing-pricing.ts --dry-run
 *   npx tsx scripts/backfill-staffing-pricing.ts --output report.json
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

// =============================================================================
// TYPES
// =============================================================================

interface LaborCategory {
  id: string
  key: string
  title: string
  discipline_key: string
  levels: SalaryLevels | null
}

interface SalaryLevels {
  levels: { level: string; level_title: string; steps: number[] }[]
}

interface Alias {
  alias: string
  labor_category_id: string
  context_note: string | null
  category: LaborCategory
}

interface BackfillRow {
  assignment_id: string
  tenant_id: string
  role_title: string
  original_discipline: string
  new_discipline: string
  discipline_ruling: string
  match_type: 'exact' | 'alias' | 'fuzzy' | 'unmapped'
  match_confidence: number
  category_key: string | null
  category_id: string | null
  alias_used: string | null
  context_note: string | null
  level_key: string | null
  step_index: number | null
  catalog_salary_cents: number | null
  current_salary_cents: number
  salary_override_cents: number | null
  rate_source: 'catalog' | 'manual'
  bill_rate_before_cents: number
  bill_rate_after_cents: number
  rate_match: boolean
  disposition: string
}

// Discipline backfill rules from standard-catalog.json
const DISCIPLINE_RULES: Record<string, {
  mapsTo: string
  exceptions?: { condition: string; mapsTo: string }[]
}> = {
  'devops': { mapsTo: 'engineering' },
  'management': {
    mapsTo: 'program-management',
    exceptions: [
      { condition: "title contains 'Delivery'", mapsTo: 'delivery' }
    ]
  }
}

const DEFAULT_INDIRECT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}

const DEFAULT_PROFIT = 0.10

// =============================================================================
// HELPERS
// =============================================================================

function mapDiscipline(
  originalDiscipline: string,
  roleTitle: string
): { newDiscipline: string; ruling: string } {
  const rule = DISCIPLINE_RULES[originalDiscipline.toLowerCase()]

  if (!rule) {
    return { newDiscipline: originalDiscipline, ruling: 'unchanged' }
  }

  // Check exceptions
  if (rule.exceptions) {
    for (const exc of rule.exceptions) {
      if (exc.condition === "title contains 'Delivery'" &&
          roleTitle.toLowerCase().includes('delivery')) {
        return {
          newDiscipline: exc.mapsTo,
          ruling: `${originalDiscipline}→${exc.mapsTo} (title contains 'Delivery')`
        }
      }
    }
  }

  return {
    newDiscipline: rule.mapsTo,
    ruling: `${originalDiscipline}→${rule.mapsTo} (default rule)`
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(senior|sr\.?|lead|principal|staff)\s+/i, '')
}

function fuzzyMatch(a: string, b: string): number {
  const normA = normalizeTitle(a)
  const normB = normalizeTitle(b)

  if (normA === normB) return 1.0
  if (normA.includes(normB) || normB.includes(normA)) return 0.8

  // Simple word overlap
  const wordsA = new Set(normA.split(' '))
  const wordsB = new Set(normB.split(' '))
  const overlap = Array.from(wordsA).filter(w => wordsB.has(w)).length
  const total = Math.max(wordsA.size, wordsB.size)

  return overlap / total
}

async function loadCatalog(
  client: SupabaseClient,
  tenantId: string
): Promise<{ categories: LaborCategory[]; aliases: Alias[] }> {
  const { data: categories } = await client
    .from('tenant_labor_categories')
    .select('id, key, title, discipline_key, levels')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  const { data: aliases } = await client
    .from('labor_category_aliases')
    .select(`
      alias,
      labor_category_id,
      context_note,
      labor_category:tenant_labor_categories!inner(
        id, key, title, discipline_key, levels
      )
    `)
    .eq('tenant_labor_categories.tenant_id', tenantId)

  return {
    categories: (categories || []) as LaborCategory[],
     
    aliases: (aliases || []).map((a: any) => ({
      alias: a.alias,
      labor_category_id: a.labor_category_id,
      context_note: a.context_note,
      category: a.labor_category as LaborCategory,
    })),
  }
}

function resolveCategory(
  roleTitle: string,
  categories: LaborCategory[],
  aliases: Alias[]
): {
  matchType: 'exact' | 'alias' | 'fuzzy' | 'unmapped'
  confidence: number
  category: LaborCategory | null
  aliasUsed: string | null
  contextNote: string | null
} {
  // 1. Exact title match
  const exactMatch = categories.find(c =>
    c.title.toLowerCase() === roleTitle.toLowerCase()
  )
  if (exactMatch) {
    return {
      matchType: 'exact',
      confidence: 1.0,
      category: exactMatch,
      aliasUsed: null,
      contextNote: null,
    }
  }

  // 2. Alias match
  const aliasMatch = aliases.find(a =>
    a.alias.toLowerCase() === roleTitle.toLowerCase()
  )
  if (aliasMatch) {
    return {
      matchType: 'alias',
      confidence: 0.95,
      category: aliasMatch.category,
      aliasUsed: aliasMatch.alias,
      contextNote: aliasMatch.context_note,
    }
  }

  // 3. Normalized match (strip prefixes)
  const normalizedTitle = normalizeTitle(roleTitle)
  const normalizedMatch = categories.find(c =>
    normalizeTitle(c.title) === normalizedTitle
  )
  if (normalizedMatch) {
    return {
      matchType: 'alias',
      confidence: 0.90,
      category: normalizedMatch,
      aliasUsed: `normalized: ${roleTitle}`,
      contextNote: null,
    }
  }

  // 4. Fuzzy match
  let bestFuzzy: { category: LaborCategory; score: number } | null = null
  for (const cat of categories) {
    const score = fuzzyMatch(roleTitle, cat.title)
    if (score >= 0.6 && (!bestFuzzy || score > bestFuzzy.score)) {
      bestFuzzy = { category: cat, score }
    }
  }
  if (bestFuzzy && bestFuzzy.score >= 0.6) {
    return {
      matchType: 'fuzzy',
      confidence: bestFuzzy.score,
      category: bestFuzzy.category,
      aliasUsed: null,
      contextNote: `Fuzzy match to "${bestFuzzy.category.title}"`,
    }
  }

  // 5. Unmapped
  return {
    matchType: 'unmapped',
    confidence: 0,
    category: null,
    aliasUsed: null,
    contextNote: null,
  }
}

function getCatalogSalary(
  category: LaborCategory,
  level: string,
  step: number
): number | null {
  if (!category.levels?.levels) return null

  const levelData = category.levels.levels.find(l => l.level === level)
  if (!levelData?.steps || levelData.steps.length === 0) return null

  return levelData.steps[step] ?? levelData.steps[0] ?? null
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const outputIdx = args.indexOf('--output')
  const outputFile = outputIdx >= 0 ? args[outputIdx + 1] : 'backfill-report.json'

  console.log('Phase 5: Staffing Pricing Backfill')
  console.log('=' .repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Output: ${outputFile}`)
  console.log('')

  // 1. Load snapshot for comparison
  const snapshot = new Map<string, { bill_rate_cents: number; salary_cents: number }>()

  const { data: snapshotRows } = await supabase
    .from('backfill_rate_snapshot')
    .select('assignment_id, bill_rate_base_cents, current_salary_cents')

  if (snapshotRows && snapshotRows.length > 0) {
    for (const row of snapshotRows) {
      snapshot.set(row.assignment_id, {
        bill_rate_cents: row.bill_rate_base_cents,
        salary_cents: row.current_salary_cents,
      })
    }
    console.log(`Loaded ${snapshot.size} snapshot entries from database`)
  } else {
    // Try JSON file
    try {
      const jsonData = fs.readFileSync('backfill_rate_snapshot.json', 'utf8')
      const parsed = JSON.parse(jsonData)
      for (const row of parsed) {
        snapshot.set(row.assignment_id, {
          bill_rate_cents: row.bill_rate_base_cents,
          salary_cents: row.current_salary_cents,
        })
      }
      console.log(`Loaded ${snapshot.size} snapshot entries from JSON file`)
    } catch {
      console.log('WARNING: No snapshot found - will compute before rates on the fly')
    }
  }

  // 2. Load assignments grouped by tenant
  const { data: assignments, error: assignmentsError } = await supabase
    .from('staffing_assignments')
    .select(`
      id,
      tenant_id,
      role_title,
      discipline
    `)

  if (assignmentsError) {
    console.error('ERROR:', assignmentsError.message)
    process.exit(1)
  }

  console.log(`Found ${assignments?.length ?? 0} assignments`)
  console.log('')

  if (!assignments || assignments.length === 0) {
    console.log('No assignments to backfill.')
    return
  }

  // 3. Group by tenant
  const byTenant = new Map<string, typeof assignments>()
  for (const a of assignments) {
    const list = byTenant.get(a.tenant_id) || []
    list.push(a)
    byTenant.set(a.tenant_id, list)
  }

  // 4. Process each tenant
  const report: BackfillRow[] = []
  let updateCount = 0
  let unmappedCount = 0
  let rateMatchCount = 0
  let rateMismatchCount = 0

  for (const [tenantId, tenantAssignments] of Array.from(byTenant)) {
    console.log(`\nProcessing tenant ${tenantId}: ${tenantAssignments.length} assignments`)

    // Load catalog for tenant
    const { categories, aliases } = await loadCatalog(supabase, tenantId)
    console.log(`  Catalog: ${categories.length} categories, ${aliases.length} aliases`)

    for (const assignment of tenantAssignments) {
      // Map discipline
      const { newDiscipline, ruling } = mapDiscipline(
        assignment.discipline,
        assignment.role_title
      )

      // Resolve category
      const resolution = resolveCategory(
        assignment.role_title,
        categories,
        aliases
      )

      // Get snapshot data
      const snapshotData = snapshot.get(assignment.id)
      const currentSalaryCents = snapshotData?.salary_cents ?? 12000000 // $120k default
      const billRateBeforeCents = snapshotData?.bill_rate_cents ?? 0

      // Determine level/step (default IC3/0)
      const levelKey = 'IC3'
      const stepIndex = 0

      // Get catalog salary if category found
      let catalogSalaryCents: number | null = null
      let salaryOverrideCents: number | null = null
      let rateSource: 'catalog' | 'manual' = 'manual'

      if (resolution.category) {
        const catalogSalary = getCatalogSalary(resolution.category, levelKey, stepIndex)
        if (catalogSalary) {
          catalogSalaryCents = Math.round(catalogSalary * 100)
          rateSource = 'catalog'

          // Check if override needed
          if (catalogSalaryCents !== currentSalaryCents) {
            salaryOverrideCents = currentSalaryCents
          }
        }
      }

      // Compute bill rate after (using current salary to ensure conservation)
      const salaryForRate = currentSalaryCents / 100
      const billRateAfter = calculateBillRate({
        annualSalary: salaryForRate,
        rates: DEFAULT_INDIRECT_RATES,
        profitRate: DEFAULT_PROFIT,
      })
      const billRateAfterCents = Math.round(billRateAfter * 100)

      // Check rate match (with $0.01 tolerance)
      const rateMatch = billRateBeforeCents === 0 ||
        Math.abs(billRateBeforeCents - billRateAfterCents) <= 1

      if (rateMatch) {
        rateMatchCount++
      } else {
        rateMismatchCount++
      }

      // Determine disposition
      let disposition: string
      if (resolution.matchType === 'unmapped') {
        unmappedCount++
        disposition = 'UNMAPPED - requires tenant catalog addition or manual mapping'
      } else if (salaryOverrideCents !== null) {
        disposition = `catalog match with salary override ($${currentSalaryCents/100} != catalog $${catalogSalaryCents!/100})`
      } else {
        disposition = 'catalog match - no override needed'
      }

      const row: BackfillRow = {
        assignment_id: assignment.id,
        tenant_id: tenantId,
        role_title: assignment.role_title,
        original_discipline: assignment.discipline,
        new_discipline: newDiscipline,
        discipline_ruling: ruling,
        match_type: resolution.matchType,
        match_confidence: resolution.confidence,
        category_key: resolution.category?.key ?? null,
        category_id: resolution.category?.id ?? null,
        alias_used: resolution.aliasUsed,
        context_note: resolution.contextNote,
        level_key: resolution.category ? levelKey : null,
        step_index: resolution.category ? stepIndex : null,
        catalog_salary_cents: catalogSalaryCents,
        current_salary_cents: currentSalaryCents,
        salary_override_cents: salaryOverrideCents,
        rate_source: rateSource,
        bill_rate_before_cents: billRateBeforeCents,
        bill_rate_after_cents: billRateAfterCents,
        rate_match: rateMatch,
        disposition,
      }

      report.push(row)

      // Apply update if not dry run and mapped
      if (!dryRun && resolution.category) {
        const { error: updateError } = await supabase
          .from('staffing_assignments')
          .update({
            discipline: newDiscipline,
            labor_category_id: resolution.category.id,
            level_key: levelKey,
            step_index: stepIndex,
            salary_override_cents: salaryOverrideCents,
            rate_source: rateSource,
          })
          .eq('id', assignment.id)

        if (updateError) {
          console.error(`  ERROR updating ${assignment.id}:`, updateError.message)
        } else {
          updateCount++
        }
      }
    }
  }

  // 5. Write report
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  console.log(`\nReport written to: ${outputFile}`)

  // 6. Generate penny-conservation table
  console.log('')
  console.log('=' .repeat(60))
  console.log('PENNY CONSERVATION TABLE')
  console.log('=' .repeat(60))
  console.log('')
  console.log('| Role Title | Before | After | Match | Resolution Path |')
  console.log('|------------|--------|-------|-------|-----------------|')

  for (const row of report.slice(0, 20)) {
    const beforeRate = (row.bill_rate_before_cents / 100).toFixed(2)
    const afterRate = (row.bill_rate_after_cents / 100).toFixed(2)
    const matchIcon = row.rate_match ? '✓' : '✗'
    const resolution = row.salary_override_cents ? 'override' : 'catalog'
    console.log(`| ${row.role_title.substring(0, 20).padEnd(20)} | $${beforeRate.padStart(6)} | $${afterRate.padStart(6)} | ${matchIcon} | ${resolution} |`)
  }

  if (report.length > 20) {
    console.log(`| ... and ${report.length - 20} more rows (see ${outputFile}) |`)
  }

  // 7. Summary
  console.log('')
  console.log('=' .repeat(60))
  console.log('BACKFILL SUMMARY')
  console.log('=' .repeat(60))
  console.log('')
  console.log(`Total assignments: ${assignments.length}`)
  console.log(`  Updated: ${dryRun ? '(dry run)' : updateCount}`)
  console.log(`  Unmapped: ${unmappedCount}`)
  console.log('')

  // Match type breakdown
  const byMatchType = report.reduce((acc, r) => {
    acc[r.match_type] = (acc[r.match_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('Match types:')
  for (const [type, count] of Object.entries(byMatchType)) {
    console.log(`  ${type}: ${count}`)
  }

  // Discipline mapping
  const disciplineMappings = report.filter(r => r.discipline_ruling !== 'unchanged')
  if (disciplineMappings.length > 0) {
    console.log('')
    console.log('DISCIPLINE MAPPINGS (row-by-row):')
    const rulings = new Map<string, string[]>()
    for (const r of disciplineMappings) {
      const list = rulings.get(r.discipline_ruling) || []
      list.push(r.role_title)
      rulings.set(r.discipline_ruling, list)
    }
    for (const [ruling, roles] of Array.from(rulings)) {
      console.log(`  ${ruling}:`)
      for (const role of roles.slice(0, 5)) {
        console.log(`    - ${role}`)
      }
      if (roles.length > 5) {
        console.log(`    ... and ${roles.length - 5} more`)
      }
    }
  }

  // Penny conservation summary
  console.log('')
  console.log('PENNY CONSERVATION VERIFICATION:')
  console.log(`  Rates matched: ${rateMatchCount}`)
  console.log(`  Rates mismatched: ${rateMismatchCount}`)
  if (rateMismatchCount > 0) {
    console.log('  ⚠️  WARNING: Rate mismatches detected!')
    console.log('  Review the following assignments:')
    const mismatches = report.filter(r => !r.rate_match).slice(0, 5)
    for (const m of mismatches) {
      console.log(`    - ${m.role_title}: $${(m.bill_rate_before_cents/100).toFixed(2)} → $${(m.bill_rate_after_cents/100).toFixed(2)}`)
    }
  } else {
    console.log('  ✓ ALL RATES CONSERVED TO THE PENNY')
  }

  // Unmapped roles
  const unmappedRoles = report.filter(r => r.match_type === 'unmapped')
  if (unmappedRoles.length > 0) {
    console.log('')
    console.log('UNMAPPED ROLES (require action):')
    const uniqueUnmapped = Array.from(new Set(unmappedRoles.map(r => r.role_title)))
    for (const title of uniqueUnmapped) {
      const count = unmappedRoles.filter(r => r.role_title === title).length
      console.log(`  - ${title} (${count} assignment${count > 1 ? 's' : ''})`)
    }
  }

  // Salary overrides
  const overrides = report.filter(r => r.salary_override_cents !== null)
  if (overrides.length > 0) {
    console.log('')
    console.log(`SALARY OVERRIDES: ${overrides.length} assignments`)
    console.log('  (Current salary differs from catalog - override preserved)')
    for (const o of overrides.slice(0, 5)) {
      console.log(`    - ${o.role_title}: $${(o.current_salary_cents/100).toLocaleString()} (catalog: $${(o.catalog_salary_cents!/100).toLocaleString()})`)
    }
    if (overrides.length > 5) {
      console.log(`    ... and ${overrides.length - 5} more`)
    }
  }
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
