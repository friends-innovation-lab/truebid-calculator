/**
 * Hash Stability Verification Script
 *
 * Verifies that the new code produces the same hash for an existing
 * confirmed intelligence version (PM-HCD).
 *
 * Run with staging credentials:
 *   STAGING_DB_URL="..." npx tsx scripts/verify-hash-stability.ts
 */

import { createClient } from '@supabase/supabase-js'
import { loadAndHashIntelligence } from '../lib/commands/intelligence/hash-utils'

async function main() {
  // Supabase URL and service role key for API access
  const supabaseUrl = process.env.STAGING_SUPABASE_URL
  const supabaseKey = process.env.STAGING_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: STAGING_SUPABASE_URL and STAGING_SERVICE_ROLE_KEY required')
    console.error('')
    console.error('Usage:')
    console.error('  STAGING_SUPABASE_URL="https://tcobyquewjootwxpqijq.supabase.co" \\')
    console.error('  STAGING_SERVICE_ROLE_KEY="..." \\')
    console.error('  npx tsx scripts/verify-hash-stability.ts')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('Hash Stability Verification')
  console.log('===========================')
  console.log('')

  // Find PM-HCD confirmed intelligence version
  // Look for proposals with "PM-HCD" or similar in the title
  const { data: proposals, error: propError } = await supabase
    .from('proposals')
    .select('id, title, active_intelligence_version_id')
    .or('title.ilike.%PM-HCD%,title.ilike.%pm-hcd%,title.ilike.%pmhcd%')
    .not('active_intelligence_version_id', 'is', null)
    .limit(5)

  if (propError) {
    console.error('Error finding proposals:', propError.message)
    process.exit(1)
  }

  if (!proposals || proposals.length === 0) {
    console.log('No PM-HCD proposals found with confirmed intelligence.')
    console.log('')
    console.log('Searching for ANY confirmed intelligence version...')

    const { data: anyVersion, error: anyError } = await supabase
      .from('intelligence_versions')
      .select('id, proposal_id, confirmation_hash, status')
      .eq('status', 'confirmed')
      .not('confirmation_hash', 'is', null)
      .limit(1)
      .single()

    if (anyError || !anyVersion) {
      console.error('No confirmed intelligence versions found.')
      process.exit(1)
    }

    console.log(`Found confirmed version: ${anyVersion.id}`)
    console.log(`Stored hash: ${anyVersion.confirmation_hash}`)
    console.log('')

    await verifyVersion(supabase, anyVersion.id, anyVersion.confirmation_hash!)
    return
  }

  console.log(`Found ${proposals.length} PM-HCD proposal(s):`)
  for (const p of proposals) {
    console.log(`  - ${p.title} (version: ${p.active_intelligence_version_id})`)
  }
  console.log('')

  // Use the first one
  const targetProposal = proposals[0]
  const versionId = targetProposal.active_intelligence_version_id!

  // Get the stored hash
  const { data: version, error: versionError } = await supabase
    .from('intelligence_versions')
    .select('confirmation_hash')
    .eq('id', versionId)
    .single()

  if (versionError || !version) {
    console.error('Error loading version:', versionError?.message)
    process.exit(1)
  }

  const storedHash = version.confirmation_hash
  console.log(`Target: ${targetProposal.title}`)
  console.log(`Version ID: ${versionId}`)
  console.log(`Stored hash: ${storedHash}`)
  console.log('')

  await verifyVersion(supabase, versionId, storedHash!)
}

async function verifyVersion(
   
  supabase: any,
  versionId: string,
  storedHash: string
) {
  console.log('Recomputing hash with new code...')

  const result = await loadAndHashIntelligence(supabase, versionId)

  if (!result) {
    console.error('ERROR: Failed to load and hash intelligence')
    process.exit(1)
  }

  const recomputedHash = result.hash

  console.log('')
  console.log('RESULTS')
  console.log('=======')
  console.log(`Stored hash:     ${storedHash}`)
  console.log(`Recomputed hash: ${recomputedHash}`)
  console.log('')

  if (storedHash === recomputedHash) {
    console.log('✅ PASS: Hashes match - backward compatibility confirmed')
    process.exit(0)
  } else {
    console.log('❌ FAIL: Hash mismatch - backward compatibility BROKEN')
    console.log('')
    console.log('This means the new code produces different hashes for existing')
    console.log('confirmed versions. The canonicalize() function may have changed')
    console.log('in a way that breaks existing confirmation hashes.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
