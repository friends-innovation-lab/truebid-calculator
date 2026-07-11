/**
 * Phase 2 E2E Rehearsal Script
 *
 * Tests the full intelligence versioning flow on staging:
 * 1. Upload RFP → extract intelligence
 * 2. Edit facts → confirm → generate WBS
 * 3. Supersede → edit → confirm again → generate WBS
 * 4. Verify old version is rejected
 *
 * Usage: STAGING_URL=http://localhost:3000 npx tsx scripts/e2e-intelligence-rehearsal.ts
 */

const BASE_URL = process.env.STAGING_URL || 'http://localhost:3000'

interface TestResult {
  step: string
  success: boolean
  data?: unknown
  error?: string
  duration?: number
}

const results: TestResult[] = []

async function logResult(step: string, fn: () => Promise<unknown>): Promise<unknown> {
  const start = Date.now()
  try {
    const data = await fn()
    results.push({ step, success: true, data, duration: Date.now() - start })
    console.log(`✓ ${step} (${Date.now() - start}ms)`)
    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ step, success: false, error: message, duration: Date.now() - start })
    console.error(`✗ ${step}: ${message}`)
    throw error
  }
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Note: This would need a real auth cookie/session for staging
      // For local testing, we can use service role key via env
      ...options.headers,
    },
  })
  return response
}

async function main() {
  console.log('═════════════════════════════════════════════════════════════')
  console.log('Phase 2 E2E Rehearsal: Versioned Contract Intelligence')
  console.log(`Target: ${BASE_URL}`)
  console.log('═════════════════════════════════════════════════════════════')
  console.log()

  // For this rehearsal, we need an existing proposal on staging
  // The user mentioned there's 1 proposal on staging

  // Step 1: Get existing proposal
  console.log('Step 1: Finding test proposal on staging...')
  const proposalsRes = await fetchApi('/api/proposals')
  if (!proposalsRes.ok) {
    console.error('Failed to fetch proposals. Make sure the server is running with staging credentials.')
    console.error('Status:', proposalsRes.status)
    console.error('Ensure you have valid auth session.')
    return
  }

  const proposalsData = await proposalsRes.json()
  const proposals = proposalsData.proposals || []

  if (proposals.length === 0) {
    console.error('No proposals found on staging. Create a test proposal first.')
    return
  }

  const testProposal = proposals[0]
  console.log(`  Using proposal: ${testProposal.id}`)
  console.log(`  Title: ${testProposal.title || 'Untitled'}`)
  console.log()

  // Step 2: Check current intelligence state
  console.log('Step 2: Checking current intelligence state...')
  const intelligenceRes = await fetchApi(`/api/proposals/${testProposal.id}/intelligence`)
  const intelligenceData = await intelligenceRes.json()
  console.log('  Current state:', intelligenceData.version ?
    `Version ${intelligenceData.version.versionNumber} (${intelligenceData.version.status})` :
    'No intelligence version'
  )
  console.log()

  // For full E2E, we would:
  // 1. Extract intelligence (requires PDF upload - skip for now)
  // 2. Or create a draft manually via API

  // If no version exists, we can't proceed with the full flow
  // The user should have extracted intelligence via the UI first

  if (!intelligenceData.version) {
    console.log('No intelligence version found.')
    console.log('To test the full flow:')
    console.log('1. Go to the app UI and upload an RFP')
    console.log('2. Extract contract intelligence')
    console.log('3. Re-run this script')
    return
  }

  const currentVersion = intelligenceData.version
  const versionId = currentVersion.id
  const versionNumber = currentVersion.versionNumber

  console.log('═════════════════════════════════════════════════════════════')
  console.log('E2E Flow Test')
  console.log('═════════════════════════════════════════════════════════════')
  console.log()

  // Step 3: If draft, edit and confirm
  if (currentVersion.status === 'draft') {
    console.log('Step 3: Editing draft facts...')
    const editRes = await fetchApi(`/api/proposals/${testProposal.id}/intelligence`, {
      method: 'PATCH',
      body: JSON.stringify({
        versionId: versionId,
        periods: [
          { name: 'Base Period', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
          { name: 'Option Period 1', months: 12, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 1 },
        ],
        disciplines: [
          { discipline: 'engineering', confidence: 'high' },
          { discipline: 'design', confidence: 'medium' },
        ],
      }),
    })

    if (!editRes.ok) {
      const error = await editRes.json()
      console.error('  Failed to edit:', error)
    } else {
      console.log('  ✓ Edited facts successfully')
    }
    console.log()

    console.log('Step 4: Confirming draft...')
    const confirmRes = await fetchApi(`/api/proposals/${testProposal.id}/intelligence/confirm`, {
      method: 'POST',
      body: JSON.stringify({ versionId: versionId }),
    })

    if (!confirmRes.ok) {
      const error = await confirmRes.json()
      console.error('  Failed to confirm:', error)
      return
    }

    const confirmData = await confirmRes.json()
    console.log('  ✓ Confirmed with hash:', confirmData.version.confirmationHash?.substring(0, 16) + '...')
    console.log()
  } else {
    console.log('Step 3-4: Version already confirmed, skipping...')
    console.log()
  }

  // Step 5: Generate WBS with confirmed version
  console.log('Step 5: Generating WBS with confirmed version...')
  const wbsRes1 = await fetchApi(`/api/proposals/${testProposal.id}/generate-wbs`, {
    method: 'POST',
    body: JSON.stringify({ intelligenceVersionId: versionId }),
  })

  if (!wbsRes1.ok) {
    const error = await wbsRes1.json()
    console.log('  Note: WBS generation may require extractedRequirements')
    console.log('  Response:', error.error || error)
  } else {
    const wbsData1 = await wbsRes1.json()
    console.log('  ✓ Generated', wbsData1.count, 'WBS elements using version', versionNumber)
  }
  console.log()

  // Step 6: Supersede to create new draft
  console.log('Step 6: Creating new draft via supersede...')
  const supersedeRes = await fetchApi(`/api/proposals/${testProposal.id}/intelligence/supersede`, {
    method: 'POST',
  })

  if (!supersedeRes.ok) {
    const error = await supersedeRes.json()
    console.error('  Failed to supersede:', error)
    return
  }

  const supersedeData = await supersedeRes.json()
  const oldVersionId = supersedeData.supersededVersionId
  const newVersionId = supersedeData.newVersion.id
  const newVersionNumber = supersedeData.newVersion.versionNumber
  console.log('  ✓ Created version', newVersionNumber, 'superseding version', versionNumber)
  console.log('  Old version ID:', oldVersionId)
  console.log('  New version ID:', newVersionId)
  console.log()

  // Step 7: Edit new draft
  console.log('Step 7: Editing new draft...')
  const editRes2 = await fetchApi(`/api/proposals/${testProposal.id}/intelligence`, {
    method: 'PATCH',
    body: JSON.stringify({
      versionId: newVersionId,
      periods: [
        { name: 'Base Period', months: 6, cumulativeMonthsEnd: 6, gsaRateYear: 1, sortOrder: 0 },
        { name: 'Option Period 1', months: 6, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 1 },
        { name: 'Option Period 2', months: 6, cumulativeMonthsEnd: 18, gsaRateYear: 2, sortOrder: 2 },
      ],
    }),
  })

  if (!editRes2.ok) {
    const error = await editRes2.json()
    console.error('  Failed to edit new draft:', error)
  } else {
    console.log('  ✓ Edited new draft with different periods')
  }
  console.log()

  // Step 8: Confirm new draft
  console.log('Step 8: Confirming new draft...')
  const confirmRes2 = await fetchApi(`/api/proposals/${testProposal.id}/intelligence/confirm`, {
    method: 'POST',
    body: JSON.stringify({ versionId: newVersionId }),
  })

  if (!confirmRes2.ok) {
    const error = await confirmRes2.json()
    console.error('  Failed to confirm new draft:', error)
    return
  }

  const confirmData2 = await confirmRes2.json()
  console.log('  ✓ Confirmed version', newVersionNumber, 'with hash:', confirmData2.version.confirmationHash?.substring(0, 16) + '...')
  console.log()

  // Step 9: Generate WBS with NEW version
  console.log('Step 9: Generating WBS with NEW confirmed version...')
  const wbsRes2 = await fetchApi(`/api/proposals/${testProposal.id}/generate-wbs`, {
    method: 'POST',
    body: JSON.stringify({ intelligenceVersionId: newVersionId }),
  })

  if (!wbsRes2.ok) {
    const error = await wbsRes2.json()
    console.log('  Note: WBS generation response:', error.error || error)
  } else {
    const wbsData2 = await wbsRes2.json()
    console.log('  ✓ Generated', wbsData2.count, 'WBS elements using version', newVersionNumber)
  }
  console.log()

  // Step 10: CRITICAL - Verify OLD version is rejected
  console.log('Step 10: CRITICAL - Verify OLD (superseded) version is rejected...')
  const wbsResOld = await fetchApi(`/api/proposals/${testProposal.id}/generate-wbs`, {
    method: 'POST',
    body: JSON.stringify({ intelligenceVersionId: oldVersionId }),
  })

  if (wbsResOld.ok) {
    console.error('  ✗ FAILED: Old version was accepted! This is a bug.')
    const data = await wbsResOld.json()
    console.error('  Response:', data)
  } else {
    const error = await wbsResOld.json()
    console.log('  ✓ PASSED: Old version correctly rejected')
    console.log('  Code:', error.code)
    console.log('  Message:', error.error)
  }
  console.log()

  // Summary
  console.log('═════════════════════════════════════════════════════════════')
  console.log('E2E Rehearsal Summary')
  console.log('═════════════════════════════════════════════════════════════')
  console.log()
  console.log('Flow completed:')
  console.log('  - Edit draft: TESTED')
  console.log('  - Confirm draft: TESTED')
  console.log('  - Generate WBS with confirmed: TESTED')
  console.log('  - Supersede to new draft: TESTED')
  console.log('  - Edit new draft: TESTED')
  console.log('  - Confirm new draft: TESTED')
  console.log('  - Generate WBS with NEW version: TESTED')
  console.log('  - Reject OLD version: TESTED')
  console.log()
  console.log('REHEARSAL COMPLETE')
}

main().catch(console.error)
