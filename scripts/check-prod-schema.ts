#!/usr/bin/env npx tsx
/**
 * Check production schema for migrations 061-063
 */

import { createClient } from '@supabase/supabase-js'

const PROD_URL = 'https://qtotsijebcpddipmzstb.supabase.co'
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!PROD_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(PROD_URL, PROD_KEY)

async function main() {
  console.log('=== Production Schema Check (061-063) ===\n')

  // Check 061a: solicitation_brief column on intelligence_versions
  console.log('061a: intelligence_versions.solicitation_brief')
  const { error: err061a } = await supabase
    .from('intelligence_versions')
    .select('id, solicitation_brief')
    .limit(1)

  if (err061a) {
    if (err061a.message.includes('solicitation_brief')) {
      console.log('  MISSING: Column does not exist')
    } else {
      console.log('  ERROR:', err061a.message)
    }
  } else {
    console.log('  PRESENT: Column queryable')
  }

  // Check 061b: fact_evidence table
  console.log('\n061b: fact_evidence table')
  const { error: err061b } = await supabase
    .from('fact_evidence')
    .select('id')
    .limit(1)

  if (err061b) {
    if (err061b.message.includes('does not exist') || err061b.code === '42P01') {
      console.log('  MISSING: Table does not exist')
    } else {
      console.log('  ERROR:', err061b.message)
    }
  } else {
    console.log('  PRESENT: Table queryable')
  }

  // Check 062a: requirement_links.status column
  console.log('\n062a: requirement_links.status')
  const { error: err062a } = await supabase
    .from('requirement_links')
    .select('id, status')
    .limit(1)

  if (err062a) {
    if (err062a.message.includes('status')) {
      console.log('  MISSING: Column does not exist')
    } else {
      console.log('  ERROR:', err062a.message)
    }
  } else {
    console.log('  PRESENT: Column queryable')
  }

  // Check 062b: requirement_links.proposed_at column
  console.log('\n062b: requirement_links.proposed_at')
  const { error: err062b } = await supabase
    .from('requirement_links')
    .select('id, proposed_at')
    .limit(1)

  if (err062b) {
    if (err062b.message.includes('proposed_at')) {
      console.log('  MISSING: Column does not exist')
    } else {
      console.log('  ERROR:', err062b.message)
    }
  } else {
    console.log('  PRESENT: Column queryable')
  }

  // Check 062c: requirement_links.resolved_at column
  console.log('\n062c: requirement_links.resolved_at')
  const { error: err062c } = await supabase
    .from('requirement_links')
    .select('id, resolved_at')
    .limit(1)

  if (err062c) {
    if (err062c.message.includes('resolved_at')) {
      console.log('  MISSING: Column does not exist')
    } else {
      console.log('  ERROR:', err062c.message)
    }
  } else {
    console.log('  PRESENT: Column queryable')
  }

  // Check 063: fact_evidence_parent_draft trigger (hard to check via API)
  console.log('\n063: check_fact_evidence_parent_draft function')
  console.log('  (Cannot verify function via API - need psql)')

  console.log('\n=== Summary ===')
  console.log('061 solicitation_brief:      ' + (err061a ? 'MISSING' : 'PRESENT'))
  console.log('061 fact_evidence table:     ' + (err061b ? 'MISSING' : 'PRESENT'))
  console.log('062 requirement_links.status: ' + (err062a ? 'MISSING' : 'PRESENT'))
  console.log('062 proposed_at column:      ' + (err062b ? 'MISSING' : 'PRESENT'))
  console.log('062 resolved_at column:      ' + (err062c ? 'MISSING' : 'PRESENT'))
}

main().catch(console.error)
