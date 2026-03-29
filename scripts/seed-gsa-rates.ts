/**
 * Seed gsa_rates table with complete FFTC GSA ceiling rates
 * Contract: 47QTCA23D0076
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
  years_experience: number
  education: string
  education_substitution: string
}

// All 28 GSA rates from contract 47QTCA23D0076
const GSA_RATES: GSARate[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIN 54151S — IT Professional Services
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { labor_category: 'Product/Program Manager', sin: '54151S', year_1_rate: 151.47, year_2_rate: 159.35, year_3_rate: 167.63, year_4_rate: 176.34, year_5_rate: 185.51, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Project Manager', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Subject Matter Expert', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 3, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Consultant', sin: '54151S', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.38, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Developer', sin: '54151S', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'UX/UI Designer', sin: '54151S', year_1_rate: 129.22, year_2_rate: 135.94, year_3_rate: 143.01, year_4_rate: 150.45, year_5_rate: 158.27, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'IT Content Strategy', sin: '54151S', year_1_rate: 114.86, year_2_rate: 120.84, year_3_rate: 127.12, year_4_rate: 133.73, year_5_rate: 140.69, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'IT Training', sin: '54151S', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Digital Transformer', sin: '54151S', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIN 541611 — Management Consulting
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { labor_category: 'Project Manager', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 3, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Subject Matter Expert', sin: '541611', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Consultant', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Associate', sin: '541611', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86, years_experience: 3, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Manager', sin: '541611', year_1_rate: 167.51, year_2_rate: 176.22, year_3_rate: 185.99, year_4_rate: 195.02, year_5_rate: 205.17, years_experience: 2, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIN 541910 — Marketing Research & Analysis
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { labor_category: 'Subject Matter Expert I', sin: '541910', year_1_rate: 143.58, year_2_rate: 151.04, year_3_rate: 158.90, year_4_rate: 167.16, year_5_rate: 175.86, years_experience: 1, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },
  { labor_category: 'Subject Matter Expert II', sin: '541910', year_1_rate: 191.44, year_2_rate: 201.39, year_3_rate: 211.86, year_4_rate: 222.87, year_5_rate: 234.46, years_experience: 4, education: "Bachelor's", education_substitution: 'Associates Degree Equal to Two Years of Relevant Experience' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIN 518210C — Cloud Computing (Y4 and Y5 only)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { labor_category: 'Cloud Senior Product Manager', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 165.52, year_5_rate: 174.13, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Digital Transformer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 156.90, year_5_rate: 165.06, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud AI/ML Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 148.11, year_5_rate: 155.81, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Solutions Architect', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 172.80, year_5_rate: 181.78, years_experience: 8, education: "Bachelor's", education_substitution: 'Ten Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 139.04, year_5_rate: 146.28, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud DevSecOps Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 143.68, year_5_rate: 151.15, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Data Engineer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 133.30, year_5_rate: 140.23, years_experience: 4, education: "Bachelor's", education_substitution: 'Six Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Software Developer', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 123.43, year_5_rate: 129.84, years_experience: 3, education: "Bachelor's", education_substitution: 'Five Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Consultant I', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 98.74, year_5_rate: 103.88, years_experience: 2, education: "Bachelor's", education_substitution: 'Four Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Consultant II', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 148.11, year_5_rate: 155.81, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Subject Matter Expert', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 222.17, year_5_rate: 233.72, years_experience: 10, education: "Bachelor's", education_substitution: 'Twelve Years of Professional Services Relevant Experience' },
  { labor_category: 'Cloud Task Manager', sin: '518210C', year_1_rate: null, year_2_rate: null, year_3_rate: null, year_4_rate: 139.04, year_5_rate: 146.28, years_experience: 6, education: "Bachelor's", education_substitution: 'Eight Years of Professional Services Relevant Experience' },
]

async function seedGSARates() {
  console.log('🌱 Starting GSA rates seeding (complete data)...\n')
  console.log(`📋 Contract: 47QTCA23D0076`)
  console.log(`📋 Total rates to process: ${GSA_RATES.length}\n`)

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
    .select('id, labor_category, sin')
    .eq('company_id', companyId)

  const existingMap = new Map<string, string>()
  existingRates?.forEach(r => {
    existingMap.set(`${r.labor_category}|${r.sin}`, r.id)
  })
  console.log(`📋 Found ${existingMap.size} existing rates\n`)

  // Insert or update rates
  let inserted = 0
  let updated = 0
  const errors: string[] = []

  for (const rate of GSA_RATES) {
    const key = `${rate.labor_category}|${rate.sin}`
    const existingId = existingMap.get(key)

    if (existingId) {
      // Update existing record with new fields
      const { error } = await supabase
        .from('gsa_rates')
        .update({
          year_1_rate: rate.year_1_rate,
          year_2_rate: rate.year_2_rate,
          year_3_rate: rate.year_3_rate,
          year_4_rate: rate.year_4_rate,
          year_5_rate: rate.year_5_rate,
          years_experience: rate.years_experience,
          education: rate.education,
          education_substitution: rate.education_substitution,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)

      if (error) {
        errors.push(`Update ${rate.labor_category} (${rate.sin}): ${error.message}`)
      } else {
        updated++
        console.log(`   ✏️  Updated: ${rate.labor_category} (${rate.sin})`)
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('gsa_rates')
        .insert({
          company_id: companyId,
          ...rate,
        })

      if (error) {
        errors.push(`Insert ${rate.labor_category} (${rate.sin}): ${error.message}`)
      } else {
        inserted++
        console.log(`   ✅ Inserted: ${rate.labor_category} (${rate.sin})`)
      }
    }
  }

  // Report results
  console.log('\n📊 Results:')
  console.log(`   ✅ Inserted: ${inserted}`)
  console.log(`   ✏️  Updated: ${updated}`)
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
