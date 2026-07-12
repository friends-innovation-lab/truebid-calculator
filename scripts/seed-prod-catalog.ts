#!/usr/bin/env npx tsx
/**
 * Seeds production catalog
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const PROD_URL = 'https://qtotsijebcpddipmzstb.supabase.co'
const PROD_SERVICE_KEY = process.env.PROD_SERVICE_KEY || ''

if (!PROD_SERVICE_KEY) {
  console.error('PROD_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(PROD_URL, PROD_SERVICE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  // Get tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single()

  if (tenantError) {
    console.error('Tenant error:', tenantError)
    process.exit(1)
  }
  console.log('Tenant ID:', tenant.id)

  // Seed FFTC roles
  const rolesJson = JSON.parse(fs.readFileSync('fftc-roles-v2.json', 'utf8'))
  const { data: fftcData, error: fftcError } = await supabase.rpc('seed_fftc_roles_from_json', {
    v_tenant_id: tenant.id,
    v_roles_json: rolesJson
  })
  if (fftcError) {
    console.error('FFTC error:', fftcError)
    process.exit(1)
  }
  console.log('FFTC roles seeded:', fftcData)

  // Seed additional roles
  const { data: addlData, error: addlError } = await supabase.rpc('seed_additional_catalog_roles', {
    v_tenant_id: tenant.id
  })
  if (addlError) {
    console.error('Additional roles error:', addlError)
    process.exit(1)
  }
  console.log('Additional roles seeded:', addlData)

  // Seed aliases
  const { data: aliasData, error: aliasError } = await supabase.rpc('seed_standard_aliases', {
    v_tenant_id: tenant.id
  })
  if (aliasError) {
    console.error('Aliases error:', aliasError)
    process.exit(1)
  }
  console.log('Aliases seeded:', aliasData)

  // Verify counts
  const { data: disciplines } = await supabase
    .from('tenant_disciplines')
    .select('key')
    .eq('tenant_id', tenant.id)

  const { data: categories } = await supabase
    .from('tenant_labor_categories')
    .select('key, title, levels')
    .eq('tenant_id', tenant.id)

  const { data: aliases } = await supabase
    .from('labor_category_aliases')
    .select('alias')

  const withSalaries = categories?.filter(c => c.levels !== null) || []
  const needsSetup = categories?.filter(c => c.levels === null) || []

  console.log('\n=== PRODUCTION CATALOG ===')
  console.log('Disciplines:', disciplines?.length)
  console.log('Categories:', categories?.length)
  console.log('  With salaries:', withSalaries.length)
  console.log('  Needs-setup:', needsSetup.length)
  console.log('Aliases:', aliases?.length)

  console.log('\nCategories with salaries:')
  withSalaries.forEach(c => console.log('  -', c.title))

  console.log('\nNeeds-setup roles:')
  needsSetup.forEach(c => console.log('  -', c.title))
}

main()
