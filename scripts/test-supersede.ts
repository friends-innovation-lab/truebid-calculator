#!/usr/bin/env npx tsx
/**
 * Test supersede flow for T5
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import type { TenantContext, Tenant, TenantMembership } from '../lib/tenancy'
import type { CommandContext } from '../lib/commands/types'
import { createGenerateBOEArtifactCommand } from '../lib/commands/boe/generate-artifact'

const STAGING_URL = 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_KEY || ''

if (!STAGING_KEY) {
  console.error('STAGING_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

const TENANT_ID = '44444444-4444-4444-4444-444444444444'
const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '2adaf420-5e98-40b3-93cb-9b480301d90b'
const PROPOSAL_ID = 'e2e66666-6666-6666-6666-666666666666'
const MAIN_SCENARIO_ID = '45042af1-2073-4d71-9fc7-52098600afc4'

function buildMockTenantContext(): TenantContext {
  const tenant: Tenant = {
    id: TENANT_ID,
    name: 'E2E Test Tenant',
    slug: 'e2e-test',
    status: 'active',
    companyId: COMPANY_ID,
    createdAt: new Date().toISOString(),
    createdBy: USER_ID,
    updatedAt: new Date().toISOString(),
  }

  const membership: TenantMembership = {
    id: 'e2e-membership-id',
    tenantId: TENANT_ID,
    userId: USER_ID,
    role: 'owner',
    status: 'active',
    joinedAt: new Date().toISOString(),
    invitedBy: null,
  }

  return { tenant, membership, userId: USER_ID }
}

function buildMockCommandContext(): CommandContext {
  return {
    tenant: buildMockTenantContext(),
    correlationId: crypto.randomUUID(),
    actorType: 'system',
    actorId: USER_ID,
  }
}

async function main() {
  console.log('=== Supersede Test ===\n')

  // 1. Get current artifacts
  const { data: before } = await supabase
    .from('boe_artifacts')
    .select('id, status, content_hash')
    .eq('proposal_id', PROPOSAL_ID)
    .order('generated_at', { ascending: false })

  console.log('Step 1 - Before:')
  const v1Id = before?.[0]?.id
  for (const a of before || []) {
    console.log(`  ${a.id} status=${a.status}`)
  }

  if (!v1Id) {
    console.log('No artifacts to supersede')
    return
  }

  // 2. Supersede the existing artifact
  console.log(`\nStep 2 - Supersede artifact: ${v1Id.slice(0, 8)}...`)
  const { error: supersedeErr } = await supabase
    .from('boe_artifacts')
    .update({ status: 'superseded', superseded_at: new Date().toISOString() })
    .eq('id', v1Id)

  if (supersedeErr) {
    console.log('Supersede error:', supersedeErr.message)
    return
  }
  console.log('  Superseded successfully')

  // 3. Generate new artifact
  console.log('\nStep 3 - Generate new artifact...')
  const generateCmd = createGenerateBOEArtifactCommand(supabase)
  const result = await generateCmd.execute(buildMockCommandContext(), {
    proposalId: PROPOSAL_ID,
    pricingScenarioId: MAIN_SCENARIO_ID,
  })

  if (!result.success) {
    console.log('  Generation failed:', JSON.stringify(result.error))
    return
  }

  const v2Id = result.data?.artifactId
  console.log('  New artifact:', v2Id)

  // 4. Get final state
  const { data: after } = await supabase
    .from('boe_artifacts')
    .select('id, status, content_hash')
    .eq('proposal_id', PROPOSAL_ID)
    .order('generated_at', { ascending: false })

  console.log('\nStep 4 - After:')
  for (const a of after || []) {
    console.log(`  ${a.id} status=${a.status}`)
  }

  console.log('\n=== Summary ===')
  console.log(`v1 (Superseded): ${v1Id}`)
  console.log(`v2 (Generated):  ${v2Id}`)
}

main().catch(console.error)
