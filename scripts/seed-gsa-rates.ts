/**
 * Seed gsa_rates table with FFTC GSA ceiling rates
 *
 * Usage: npx tsx scripts/seed-gsa-rates.ts
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

interface GSARate {
  labor_category: string
  sin: string
  year_1_rate: number | null
  year_2_rate: number | null
  year_3_rate: number | null
  year_4_rate: number | null
  year_5_rate: number | null
}

// All 27 GSA rates
const GSA_RATES: GSARate[] = [
  // ORIGINAL RATES (SINs 541611, 54151S, 541910)
  { labor_category: 'Associate', sin: '541611', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86 },
  { labor_category: 'Manager', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'Project Manager', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'Consultant', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'Subject Matter Expert', sin: '541611', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46 },
  { labor_category: 'Developer', sin: '54151S', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46 },
  { labor_category: 'UX/UI Designer', sin: '54151S', year_1_rate: 129.22, year_2_rate: 135.94, year_3_rate: 143.01, year_4_rate: 150.45, year_5_rate: 158.27 },
  { labor_category: 'Consultant', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'Subject Matter Expert', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'Project Manager', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17 },
  { labor_category: 'IT Content Strategy', sin: '54151S', year_1_rate: 114.86, year_2_rate: 120.84, year_3_rate: 127.12, year_4_rate: 133.73, year_5_rate: 140.69 },
  { labor_category: 'IT Training', sin: '54151S', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86 },
  { labor_category: 'Digital Transformer', sin: '54151S', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86 },
  { labor_category: 'Subject Matter Expert I', sin: '541910', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86 },
  { labor_category: 'Subject Matter Expert II', sin: '541910', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46 },

  // CLOUD RATES (SIN 518210C — Y4 and Y5 only)
  { labor_category: 'Cloud Senior Product Manager', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 165.52, year_5_rate: 174.13 },
  { labor_category: 'Cloud Digital Transformer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 156.90, year_5_rate: 165.06 },
  { labor_category: 'Cloud Solutions Architect', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 172.80, year_5_rate: 181.78 },
  { labor_category: 'Cloud AI/ML Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 148.11, year_5_rate: 155.81 },
  { labor_category: 'Cloud Software Developer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 123.43, year_5_rate: 129.84 },
  { labor_category: 'Cloud Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 139.04, year_5_rate: 146.28 },
  { labor_category: 'Cloud Subject Matter Expert', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 222.17, year_5_rate: 233.72 },
  { labor_category: 'Cloud DevSecOps Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 143.68, year_5_rate: 151.15 },
  { labor_category: 'Cloud Task Manager', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 139.04, year_5_rate: 146.28 },
  { labor_category: 'Cloud Data Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 133.30, year_5_rate: 140.23 },
  { labor_category: 'Cloud Consultant I', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 98.74, year_5_rate: 103.88 },
  { labor_category: 'Cloud Consultant II', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 148.11, year_5_rate: 155.81 },
]

async function seedGSARates() {
  console.log('🌱 Starting GSA rates seeding...\n')

  // Get FFTC company
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

  // Get existing rates to check for duplicates (by labor_category + sin)
  const { data: existingRates } = await supabase
    .from('gsa_rates')
    .select('labor_category, sin')
    .eq('company_id', companyId)

  const existingKeys = new Set(
    existingRates?.map(r => `${r.labor_category}|${r.sin}`) || []
  )
  console.log(`📋 Found ${existingKeys.size} existing rates\n`)

  // Insert new rates
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const rate of GSA_RATES) {
    const key = `${rate.labor_category}|${rate.sin}`
    if (existingKeys.has(key)) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('gsa_rates')
      .insert({
        company_id: companyId,
        ...rate,
      })

    if (error) {
      errors.push(`${rate.labor_category} (${rate.sin}): ${error.message}`)
    } else {
      inserted++
    }
  }

  // Report results
  console.log('📊 Results:')
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  if (errors.length > 0) {
    console.log(`   ❌ Errors: ${errors.length}`)
    errors.forEach(e => console.log(`      - ${e}`))
  }

  // Verify by SIN count
  console.log('\n📈 Rates by SIN:')
  const { data: sinCounts } = await supabase
    .from('gsa_rates')
    .select('sin')
    .eq('company_id', companyId)

  const counts: Record<string, number> = {}
  sinCounts?.forEach(r => {
    counts[r.sin] = (counts[r.sin] || 0) + 1
  })

  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([sin, count]) => {
      console.log(`   ${sin}: ${count}`)
    })

  console.log(`\n   Total: ${Object.values(counts).reduce((a, b) => a + b, 0)}`)
  console.log('\n✨ Done!')
}

seedGSARates().catch(console.error)
