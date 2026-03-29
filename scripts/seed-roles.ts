/**
 * Seed company_roles table with FFTC labor categories
 *
 * Usage: npx tsx scripts/seed-roles.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface Role {
  title: string
  base_salary: number
  category: string
  labor_category: string
  notes: string
}

async function seedRoles() {
  console.log('🌱 Starting role seeding...\n')

  // 1. Read the JSON file
  const jsonPath = path.join(process.cwd(), 'fftc-roles.json')
  const roles: Role[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  console.log(`📄 Loaded ${roles.length} roles from fftc-roles.json`)

  // 2. Get FFTC company (first company - assumes single-tenant for now)
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1)
    .single()

  if (companyError || !companies) {
    console.error('❌ Could not find company:', companyError?.message)
    process.exit(1)
  }

  const companyId = companies.id
  console.log(`🏢 Using company: ${companies.name} (${companyId})\n`)

  // 3. Get existing roles to check for duplicates
  const { data: existingRoles } = await supabase
    .from('company_roles')
    .select('title')
    .eq('company_id', companyId)

  const existingTitles = new Set(existingRoles?.map(r => r.title) || [])
  console.log(`📋 Found ${existingTitles.size} existing roles\n`)

  // 4. Insert new roles
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const role of roles) {
    if (existingTitles.has(role.title)) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('company_roles')
      .insert({
        company_id: companyId,
        title: role.title,
        base_salary: role.base_salary,
        category: role.category,
        labor_category: role.labor_category,
        notes: role.notes,
      })

    if (error) {
      errors.push(`${role.title}: ${error.message}`)
    } else {
      inserted++
    }
  }

  // 5. Report results
  console.log('📊 Results:')
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.length}`)
    errors.forEach(e => console.log(`      - ${e}`))
  }

  // 6. Verify by category count
  console.log('\n📈 Roles by category:')
  const { data: categoryCounts } = await supabase
    .from('company_roles')
    .select('category')
    .eq('company_id', companyId)

  const counts: Record<string, number> = {}
  categoryCounts?.forEach(r => {
    counts[r.category] = (counts[r.category] || 0) + 1
  })

  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`)
    })

  console.log(`\n   Total: ${Object.values(counts).reduce((a, b) => a + b, 0)}`)
  console.log('\n✨ Done!')
}

seedRoles().catch(console.error)
