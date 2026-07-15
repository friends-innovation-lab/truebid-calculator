#!/usr/bin/env npx tsx
/**
 * Fix main fixture citations - create missing links for tasks 1 and 2
 * then accept them and generate BOE artifact.
 */

import { createClient } from '@supabase/supabase-js'
import type { TenantContext, Tenant, TenantMembership } from '../lib/tenancy'
import type { CommandContext } from '../lib/commands/types'
import { createAcceptProposedLinkCommand } from '../lib/commands/wbs/accept-proposed-link'
import { createGenerateBOEArtifactCommand } from '../lib/commands/boe/generate-artifact'
import crypto from 'crypto'

const STAGING_URL = 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_KEY || ''

if (!STAGING_KEY) {
  console.error('STAGING_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

// IDs from main fixture
const TENANT_ID = '44444444-4444-4444-4444-444444444444'
const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '2adaf420-5e98-40b3-93cb-9b480301d90b'
const PROPOSAL_ID = 'e2e66666-6666-6666-6666-666666666666'
// Intel version ID for reference: e2e77777-7777-7777-7777-777777777777

// Tasks that need links
const TASK_2_ID = 'ffffffff-6666-0002-6666-ffffffffffff' // Development
const TASK_3_ID = 'ffffffff-6666-0003-6666-ffffffffffff' // Design

// Requirements to link
const REQ_2_ID = '22222222-6666-0002-6666-222222222222' // Develop software
const REQ_3_ID = '22222222-6666-0003-6666-222222222222' // Design interfaces

// Approved scenario for main fixture
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
  const ctx = buildMockCommandContext()

  console.log('=== Fix Main Fixture Citations ===\n')

  // 1. Check current citation count
  console.log('1. Checking current citation state...')
  const { data: beforeLinks } = await supabase
    .from('requirement_links')
    .select('id, wbs_task_id, status')
    .in('wbs_task_id', [
      'ffffffff-6666-0001-6666-ffffffffffff',
      TASK_2_ID,
      TASK_3_ID,
    ])

  const beforeAccepted = (beforeLinks || []).filter((l) => l.status === 'accepted')
  console.log(`   Links found: ${beforeLinks?.length || 0}`)
  console.log(`   Accepted links: ${beforeAccepted.length}`)

  // Count by task
  const byTaskBefore: Record<string, number> = {}
  for (const link of beforeAccepted) {
    byTaskBefore[link.wbs_task_id] = (byTaskBefore[link.wbs_task_id] || 0) + 1
  }
  console.log('   By task:', JSON.stringify(byTaskBefore))

  // 2. Create proposed links for tasks 2 and 3
  console.log('\n2. Creating proposed links for tasks 2 and 3...')

  const newLinkIds: string[] = []

  // Link for task 2 (Development -> REQ-002)
  const link2Id = crypto.randomUUID()
  const { error: link2Err } = await supabase.from('requirement_links').insert({
    id: link2Id,
    requirement_id: REQ_2_ID,
    wbs_task_id: TASK_2_ID,
    link_source: 'ai',
    status: 'proposed',
    proposed_at: new Date().toISOString(),
  })

  if (link2Err) {
    console.log(`   Task 2 link error: ${link2Err.message}`)
  } else {
    console.log(`   Created link for task 2: ${link2Id.slice(0, 8)}...`)
    newLinkIds.push(link2Id)
  }

  // Link for task 3 (Design -> REQ-003)
  const link3Id = crypto.randomUUID()
  const { error: link3Err } = await supabase.from('requirement_links').insert({
    id: link3Id,
    requirement_id: REQ_3_ID,
    wbs_task_id: TASK_3_ID,
    link_source: 'ai',
    status: 'proposed',
    proposed_at: new Date().toISOString(),
  })

  if (link3Err) {
    console.log(`   Task 3 link error: ${link3Err.message}`)
  } else {
    console.log(`   Created link for task 3: ${link3Id.slice(0, 8)}...`)
    newLinkIds.push(link3Id)
  }

  // 3. Accept the new links via command
  console.log('\n3. Accepting proposed links via AcceptProposedLinkCommand...')
  const acceptCmd = createAcceptProposedLinkCommand(supabase)

  for (const linkId of newLinkIds) {
    const result = await acceptCmd.execute(ctx, { linkId })
    if (result.success) {
      console.log(`   ✓ Accepted: ${linkId.slice(0, 8)}...`)
    } else {
      console.log(`   ✗ Rejected: ${linkId.slice(0, 8)}... - ${JSON.stringify(result.error)}`)
    }
  }

  // 4. Check citation count after
  console.log('\n4. Checking citation state after...')
  const { data: afterLinks } = await supabase
    .from('requirement_links')
    .select('id, wbs_task_id, status')
    .in('wbs_task_id', [
      'ffffffff-6666-0001-6666-ffffffffffff',
      TASK_2_ID,
      TASK_3_ID,
    ])

  const afterAccepted = (afterLinks || []).filter((l) => l.status === 'accepted')
  console.log(`   Links found: ${afterLinks?.length || 0}`)
  console.log(`   Accepted links: ${afterAccepted.length}`)

  // Count by task
  const byTaskAfter: Record<string, number> = {}
  for (const link of afterAccepted) {
    byTaskAfter[link.wbs_task_id] = (byTaskAfter[link.wbs_task_id] || 0) + 1
  }
  console.log('   By task:', JSON.stringify(byTaskAfter))

  // 5. Generate BOE artifact
  console.log('\n5. Generating BOE artifact via GenerateBOEArtifactCommand...')
  const generateCmd = createGenerateBOEArtifactCommand(supabase)
  const generateResult = await generateCmd.execute(ctx, {
    proposalId: PROPOSAL_ID,
    pricingScenarioId: MAIN_SCENARIO_ID,
  })

  if (generateResult.success) {
    console.log(`   ✓ Artifact generated: ${generateResult.data?.artifactId}`)
    console.log(`   Content hash: ${generateResult.data?.contentHash?.slice(0, 16)}...`)

    // Verify artifact in database
    const { data: artifact } = await supabase
      .from('boe_artifacts')
      .select('id, status, content')
      .eq('id', generateResult.data?.artifactId)
      .single()

    if (artifact) {
      console.log(`   Status: ${artifact.status}`)
      const content = artifact.content as { totals?: { totalCents?: number } }
      if (content?.totals?.totalCents) {
        console.log(`   Grand Total: $${(content.totals.totalCents / 100).toLocaleString()}`)
      }
    }
  } else {
    console.log(`   ✗ Generation failed: ${JSON.stringify(generateResult.error)}`)

    if ((generateResult.error as { code?: string })?.code === 'CITATION_INCOMPLETE') {
      const details = generateResult.error as { details?: { uncitedLineCount?: number } }
      console.log(`   Uncited lines remaining: ${details.details?.uncitedLineCount}`)
    }
  }

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Citations BEFORE: ${beforeAccepted.length} (1 task covered)`)
  console.log(`Citations AFTER:  ${afterAccepted.length} (${Object.keys(byTaskAfter).length} tasks covered)`)

  if (generateResult.success) {
    console.log(`\n✓ Main fixture complete`)
    console.log(`Artifact ID: ${generateResult.data?.artifactId}`)
  } else {
    console.log(`\n✗ Main fixture incomplete - BOE generation failed`)
  }
}

main().catch(console.error)
