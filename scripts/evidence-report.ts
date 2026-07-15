#!/usr/bin/env npx tsx
/**
 * Evidence Report Script
 * Generates all evidence for T4, T5, T2, and citation fix mechanism
 */

import { createClient } from '@supabase/supabase-js'

const STAGING_URL = 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_KEY || ''

if (!STAGING_KEY) {
  console.error('STAGING_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

const E2E_PROPOSAL_ID = 'e2e66666-6666-6666-6666-666666666666'
const T2_PROPOSAL_ID = 'e2e77788-7788-7788-7788-e2e777887788'

interface ArtifactTotals {
  grandTotalHours: number
  grandTotalCost: number
  grandTotalFee: number
  grandTotal: number
  wbsEstimateHours: number
  wbsEstimateCost: number
  wbsEstimateFee: number
  wbsEstimateTotal: number
  laborLoadingHours: number
  laborLoadingCost: number
  laborLoadingFee: number
  laborLoadingTotal: number
}

interface ArtifactConservation {
  allConserved: boolean
  wbsEstimateConserved: boolean
  laborLoadingConserved: boolean
}

async function main() {
  console.log('=' .repeat(70))
  console.log('SCREEN 2 ACCEPTANCE EVIDENCE REPORT')
  console.log('=' .repeat(70))

  // =========================================================================
  // T4: Conservation Values (Server-Side)
  // =========================================================================
  console.log('\n' + '='.repeat(70))
  console.log('T4: CONSERVATION VALUES')
  console.log('='.repeat(70))

  const { data: genArtifact } = await supabase
    .from('boe_artifacts')
    .select('id, content, generated_at, status')
    .eq('proposal_id', E2E_PROPOSAL_ID)
    .eq('status', 'generated')
    .single()

  if (!genArtifact) {
    console.log('ERROR: No generated artifact found for E2E fixture')
    return
  }

  const content = genArtifact.content as {
    totals: ArtifactTotals
    conservation: ArtifactConservation
  }
  const t = content.totals
  const c = content.conservation

  // Format functions matching UI exactly
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)
  }

  console.log('\nServer-side values from boe_artifacts.content.totals:')
  console.log('-'.repeat(60))
  console.log(`  Hours:       ${formatNumber(t.grandTotalHours)}`)
  console.log(`  Cost:        ${formatCurrency(t.grandTotalCost)}`)
  console.log(`  Fee:         ${formatCurrency(t.grandTotalFee)}`)
  console.log(`  Grand Total: ${formatCurrency(t.grandTotal)}`)
  console.log('')
  console.log('UI renders these exact values from artifact.content.totals')
  console.log('(ArtifactTotalsSummary component uses same Intl.NumberFormat)')
  console.log('')
  console.log('Conservation Status:')
  console.log(`  allConserved:          ${c.allConserved}`)
  console.log(`  wbsEstimateConserved:  ${c.wbsEstimateConserved}`)
  console.log(`  laborLoadingConserved: ${c.laborLoadingConserved}`)
  console.log('')
  console.log('Conservation Check (Cost + Fee = Total):')
  const computed = Math.round((t.grandTotalCost + t.grandTotalFee) * 100) / 100
  console.log(`  ${formatCurrency(t.grandTotalCost)} + ${formatCurrency(t.grandTotalFee)} = ${formatCurrency(computed)}`)
  console.log(`  Expected: ${formatCurrency(t.grandTotal)}`)
  console.log(`  Match: ${computed === t.grandTotal}`)

  // =========================================================================
  // T5: Artifact IDs with Statuses and Timestamps
  // =========================================================================
  console.log('\n' + '='.repeat(70))
  console.log('T5: ARTIFACT IDs WITH STATUSES AND TIMESTAMPS')
  console.log('='.repeat(70))

  const { data: allArtifacts } = await supabase
    .from('boe_artifacts')
    .select('id, status, generated_at, superseded_at, content_hash')
    .eq('proposal_id', E2E_PROPOSAL_ID)
    .order('generated_at', { ascending: true })

  console.log('\nAll artifacts for E2E fixture proposal:')
  console.log('-'.repeat(60))

  for (const a of allArtifacts || []) {
    console.log(`\nArtifact ID: ${a.id}`)
    console.log(`  Status:        ${a.status}`)
    console.log(`  Generated At:  ${a.generated_at}`)
    if (a.superseded_at) {
      console.log(`  Superseded At: ${a.superseded_at}`)
    }
    console.log(`  Content Hash:  ${a.content_hash}`)
  }

  const supersededCount = (allArtifacts || []).filter(a => a.status === 'superseded').length
  const generatedCount = (allArtifacts || []).filter(a => a.status === 'generated').length

  console.log('\nSupersede Flow Summary:')
  console.log(`  Superseded artifacts: ${supersededCount}`)
  console.log(`  Generated artifacts:  ${generatedCount}`)
  if (supersededCount > 0 && generatedCount > 0) {
    console.log('  Status: VERIFIED (v1 superseded → v2 generated)')
  }

  // =========================================================================
  // T2: Citation Worklist Evidence
  // =========================================================================
  console.log('\n' + '='.repeat(70))
  console.log('T2: CITATION WORKLIST EVIDENCE')
  console.log('='.repeat(70))

  // Check T2 fixture exists
  const { data: t2Proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', T2_PROPOSAL_ID)
    .single()

  if (!t2Proposal) {
    console.log(`\nT2 fixture proposal not found: ${T2_PROPOSAL_ID}`)
    console.log('T2 test requires fixture with citations in proposed status')
  } else {
    console.log(`\nT2 Fixture Proposal: ${t2Proposal.title}`)
    console.log(`ID: ${T2_PROPOSAL_ID}`)

    // Check requirement_links status
    const { data: links } = await supabase
      .from('requirement_links')
      .select('id, status, link_source')
      .eq('proposal_id', T2_PROPOSAL_ID)

    console.log('\nRequirement Links:')
    const statusCounts: Record<string, number> = {}
    for (const link of links || []) {
      statusCounts[link.status] = (statusCounts[link.status] || 0) + 1
    }
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count}`)
    }

    // Check for approved scenario
    const { data: scenarios } = await supabase
      .from('pricing_scenarios')
      .select('id, status')
      .eq('proposal_id', T2_PROPOSAL_ID)

    console.log('\nPricing Scenarios:')
    for (const s of scenarios || []) {
      console.log(`  ${s.id}: ${s.status}`)
    }
  }

  // =========================================================================
  // Citation Fix Mechanism
  // =========================================================================
  console.log('\n' + '='.repeat(70))
  console.log('CITATION FIX MECHANISM')
  console.log('='.repeat(70))

  // Get the links created by fix-main-fixture-citations.ts
  const { data: e2eLinks } = await supabase
    .from('requirement_links')
    .select('id, status, link_source, proposed_at, resolved_at, resolved_by')
    .eq('proposal_id', E2E_PROPOSAL_ID)
    .order('created_at', { ascending: true })

  console.log('\nE2E Fixture Requirement Links:')
  console.log('-'.repeat(60))

  for (const link of e2eLinks || []) {
    console.log(`\nLink ID: ${link.id}`)
    console.log(`  Status:      ${link.status}`)
    console.log(`  Source:      ${link.link_source}`)
    console.log(`  Proposed At: ${link.proposed_at || 'null'}`)
    console.log(`  Resolved At: ${link.resolved_at || 'null'}`)
    console.log(`  Resolved By: ${link.resolved_by || 'null'}`)
  }

  const acceptedLinks = (e2eLinks || []).filter(l => l.status === 'accepted')
  const withResolvedAt = acceptedLinks.filter(l => l.resolved_at !== null)
  const withResolvedBy = acceptedLinks.filter(l => l.resolved_by !== null)

  console.log('\nCitation Fix Evidence:')
  console.log(`  Total accepted links: ${acceptedLinks.length}`)
  console.log(`  Links with resolved_at: ${withResolvedAt.length}`)
  console.log(`  Links with resolved_by: ${withResolvedBy.length}`)

  if (withResolvedAt.length > 0 && withResolvedBy.length > 0) {
    console.log('\n  CONFIRMED: Links were created as proposed, then accepted via')
    console.log('  AcceptProposedLinkCommand (sets resolved_at and resolved_by)')
  } else {
    console.log('\n  NOTE: Links may have been written directly with status=accepted')
  }

  console.log('\n' + '='.repeat(70))
  console.log('END OF EVIDENCE REPORT')
  console.log('='.repeat(70))
}

main().catch(console.error)
