/**
 * Seed company_roles table with FFTC IC labor categories (v2 format)
 * 8 roles with nested salary_levels structure
 *
 * Usage: npx tsx scripts/seed-roles-v2.ts
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

interface SalaryLevel {
  level: string
  level_title: string
  steps: number[]
}

interface RoleV2 {
  title: string
  labor_category: string
  description: string
  soc_code: string
  bls_occupation_title: string
  education: string
  experience_substitution: string
  certifications: string[]
  salary_levels: SalaryLevel[]
}

async function seedRolesV2() {
  console.log('🌱 Starting role seeding (v2 format)...\n')

  // 1. Read the JSON file
  const jsonPath = path.join(process.cwd(), 'fftc-roles-v2.json')
  const roles: RoleV2[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  console.log(`📄 Loaded ${roles.length} roles from fftc-roles-v2.json`)

  // 2. Get FFTC company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1)
    .single()

  if (companyError || !company) {
    console.error('❌ Could not find company:', companyError?.message)
    process.exit(1)
  }

  const companyId = company.id
  console.log(`🏢 Using company: ${company.name} (${companyId})\n`)

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
    const roleData = {
      company_id: companyId,
      title: role.title,
      labor_category: role.labor_category,
      description: role.description,
      soc_code: role.soc_code,
      soc_title: role.bls_occupation_title,
      education: role.education,
      functional_responsibilities: role.experience_substitution,
      certifications: role.certifications,
      salary_levels: role.salary_levels,
    }

    let error: { message: string } | null = null

    if (existingTitles.has(role.title)) {
      // Update existing role with new salary data
      const result = await supabase
        .from('company_roles')
        .update(roleData)
        .eq('company_id', companyId)
        .eq('title', role.title)
      error = result.error
      if (!error) {
        console.log(`   🔄 Updated: ${role.title}`)
        skipped++ // reuse counter for updates
        continue
      }
    } else {
      // Insert new role
      const result = await supabase
        .from('company_roles')
        .insert(roleData)
      error = result.error
    }

    if (error) {
      errors.push(`${role.title}: ${error.message}`)
      console.log(`   ❌ Error: ${role.title} - ${error.message}`)
    } else {
      inserted++
      console.log(`   ✅ Inserted: ${role.title}`)
    }
  }

  // 5. Report results
  console.log('\n📊 Results:')
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   🔄 Updated: ${skipped}`)
  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.length}`)
  }

  // 6. Verify by querying the inserted roles
  console.log('\n📈 Verifying inserted roles:')
  const { data: insertedRoles } = await supabase
    .from('company_roles')
    .select('title, salary_levels')
    .eq('company_id', companyId)
    .in('title', roles.map(r => r.title))

  insertedRoles?.forEach(r => {
    const levels = r.salary_levels as SalaryLevel[]
    const levelSummary = levels?.map(l => `${l.level}(${l.steps.length})`).join(', ') || 'none'
    console.log(`   ${r.title}: ${levelSummary}`)
  })

  console.log('\n✨ Done!')
}

seedRolesV2().catch(console.error)
