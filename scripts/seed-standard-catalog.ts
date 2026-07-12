#!/usr/bin/env npx tsx
/**
 * Phase 5: Seed Standard Catalog
 *
 * Seeds the standard labor catalog for all existing tenants.
 * FFTC roles come from fftc-roles-v2.json with salary data.
 * Additional roles are seeded with NULL levels (needs-setup).
 *
 * REVIEW GATE: This script should only run after Lapedra approves the catalog.
 *
 * Usage:
 *   npx tsx scripts/seed-standard-catalog.ts
 *   npx tsx scripts/seed-standard-catalog.ts --tenant <tenant-id>
 *   npx tsx scripts/seed-standard-catalog.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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
  level_title: string
  steps: number[]
}

interface FftcRole {
  title: string
  labor_category: string
  description: string
  soc_code: string
  education: string
  salary_levels: SalaryLevel[]
}

interface SeedResult {
  tenantId: string
  tenantName: string
  disciplines: number
  fftcRoles: number
  additionalRoles: number
  aliases: number
  errors: string[]
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const tenantIdArg = args.indexOf('--tenant')
  const specificTenantId = tenantIdArg !== -1 ? args[tenantIdArg + 1] : null

  console.log('Phase 5: Seed Standard Catalog')
  console.log('=' .repeat(50))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  // Load FFTC roles
  const fftcRolesPath = path.join(process.cwd(), 'fftc-roles-v2.json')
  if (!fs.existsSync(fftcRolesPath)) {
    console.error('ERROR: fftc-roles-v2.json not found')
    process.exit(1)
  }

  const fftcRoles: FftcRole[] = JSON.parse(fs.readFileSync(fftcRolesPath, 'utf-8'))
  console.log(`Loaded ${fftcRoles.length} FFTC roles from fftc-roles-v2.json`)
  console.log('')

  // Get tenants
  let tenantsQuery = supabase
    .from('tenants')
    .select('id, name')
    .eq('status', 'active')

  if (specificTenantId) {
    tenantsQuery = tenantsQuery.eq('id', specificTenantId)
  }

  const { data: tenants, error: tenantsError } = await tenantsQuery

  if (tenantsError) {
    console.error('ERROR: Failed to fetch tenants:', tenantsError.message)
    process.exit(1)
  }

  if (!tenants || tenants.length === 0) {
    console.log('No tenants found.')
    process.exit(0)
  }

  console.log(`Found ${tenants.length} tenant(s) to seed`)
  console.log('')

  // Seed each tenant
  const results: SeedResult[] = []

  for (const tenant of tenants) {
    console.log(`Seeding tenant: ${tenant.name} (${tenant.id})`)

    if (dryRun) {
      console.log('  [DRY RUN] Would seed disciplines, roles, and aliases')
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        disciplines: 10,
        fftcRoles: 11,
        additionalRoles: 23,
        aliases: 0,
        errors: [],
      })
      continue
    }

    const result = await seedTenant(tenant.id, tenant.name, fftcRoles)
    results.push(result)

    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join(', ')}`)
    } else {
      console.log(`  Success: ${result.disciplines} disciplines, ${result.fftcRoles} FFTC roles, ${result.additionalRoles} additional roles, ${result.aliases} aliases`)
    }
    console.log('')
  }

  // Summary
  console.log('=' .repeat(50))
  console.log('SUMMARY')
  console.log('')

  const successCount = results.filter(r => r.errors.length === 0).length
  const errorCount = results.filter(r => r.errors.length > 0).length

  console.log(`Tenants processed: ${results.length}`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)

  if (errorCount > 0) {
    console.log('')
    console.log('Tenants with errors:')
    for (const result of results.filter(r => r.errors.length > 0)) {
      console.log(`  ${result.tenantName}: ${result.errors.join(', ')}`)
    }
  }
}

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedTenant(
  tenantId: string,
  tenantName: string,
  fftcRoles: FftcRole[]
): Promise<SeedResult> {
  const result: SeedResult = {
    tenantId,
    tenantName,
    disciplines: 0,
    fftcRoles: 0,
    additionalRoles: 0,
    aliases: 0,
    errors: [],
  }

  try {
    // 1. Seed disciplines
    const { error: disciplineError } = await supabase.rpc('seed_tenant_disciplines', {
      v_tenant_id: tenantId,
    })

    if (disciplineError) {
      result.errors.push(`disciplines: ${disciplineError.message}`)
    } else {
      result.disciplines = 10
    }

    // 2. Seed FFTC roles with salary data
    const fftcJson = JSON.stringify(fftcRoles)
    const { data: fftcCount, error: fftcError } = await supabase.rpc('seed_fftc_roles_from_json', {
      v_tenant_id: tenantId,
      v_roles_json: fftcJson,
    })

    if (fftcError) {
      result.errors.push(`fftc_roles: ${fftcError.message}`)
    } else {
      result.fftcRoles = fftcCount ?? 0
    }

    // 3. Seed additional roles (NULL salaries)
    const { data: additionalCount, error: additionalError } = await supabase.rpc('seed_additional_catalog_roles', {
      v_tenant_id: tenantId,
    })

    if (additionalError) {
      result.errors.push(`additional_roles: ${additionalError.message}`)
    } else {
      result.additionalRoles = additionalCount ?? 0
    }

    // 4. Seed aliases
    const { data: aliasCount, error: aliasError } = await supabase.rpc('seed_standard_aliases', {
      v_tenant_id: tenantId,
    })

    if (aliasError) {
      result.errors.push(`aliases: ${aliasError.message}`)
    } else {
      result.aliases = aliasCount ?? 0
    }

  } catch (error) {
    result.errors.push(`unexpected: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
