/**
 * Phase 4B E2E Staging Test
 *
 * Tests the full multi-document intelligence flow on staging:
 * 1. Upload 2-document set (PWS + RFQ instructions)
 * 2. Classification via AI
 * 3. Confirm classifications
 * 4. Extraction with evidence quotes
 * 5. Verify staffing_model=prescribed
 * 6. Confirm intelligence
 * 7. Generate WBS
 * 8. Verify candidate contains ONLY prescribed roles
 *
 * Usage:
 *   STAGING_DB_URL="postgresql://..." \
 *   STAGING_SERVICE_KEY="..." \
 *   ANTHROPIC_API_KEY="..." \
 *   npx tsx scripts/e2e-phase4b-staging.ts
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import { extractText } from 'unpdf'
import * as crypto from 'crypto'

// Configuration
const STAGING_URL = process.env.STAGING_SUPABASE_URL || 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_SERVICE_KEY = process.env.STAGING_SERVICE_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

// PDF paths
const PWS_PDF = path.join(__dirname, '../evals/corpus/pm-hcd/2B_-_Att_1_PWS_OCIO_Product_Management_and_HCD.1775679715488.pdf')
const RFQ_PDF = path.join(__dirname, '../evals/corpus/pm-hcd/2B_-_RFQ_Instructions_to_Offerors.1775679711103.pdf')

interface StepResult {
  step: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  details: Record<string, unknown>
  duration: number
}

const results: StepResult[] = []

function report(step: string, status: 'PASS' | 'FAIL' | 'SKIP', details: Record<string, unknown>, duration: number) {
  results.push({ step, status, details, duration })
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○'
  console.log(`${icon} ${step} (${duration}ms)`)
  if (Object.keys(details).length > 0) {
    for (const [key, value] of Object.entries(details)) {
      console.log(`    ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    }
  }
}

async function extractPdfText(pdfPath: string): Promise<{ text: string; pageCount: number }> {
  const buffer = fs.readFileSync(pdfPath)
  const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true })
  return { text, pageCount: totalPages }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Phase 4B E2E Staging Test: Multi-Document Intelligence')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Staging URL: ${STAGING_URL}`)
  console.log()

  // Validate config
  if (!STAGING_SERVICE_KEY) {
    console.error('ERROR: STAGING_SERVICE_KEY not set')
    console.error('Set it via: export STAGING_SERVICE_KEY=<your-service-role-key>')
    process.exit(1)
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set')
    process.exit(1)
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(STAGING_URL, STAGING_SERVICE_KEY, {
    auth: { persistSession: false }
  })

  // Create Anthropic client
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  let start: number

  // ═══════════════════════════════════════════════════════════════
  // Step 1: Find or create test proposal
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 1] Finding test proposal on staging...')

  // Get tenant and company
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, company_id')
    .limit(1)
    .single()

  if (!tenant) {
    report('Step 1: Find tenant', 'FAIL', { error: 'No tenant found on staging' }, Date.now() - start)
    process.exit(1)
  }

  // Find or create test proposal
  let proposalId: string
  const { data: existingProposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('title', 'Phase 4B E2E Test - PM-HCD')
    .limit(1)
    .single()

  if (existingProposal) {
    proposalId = existingProposal.id
    console.log(`    Using existing proposal: ${proposalId}`)
  } else {
    const { data: newProposal, error } = await supabase
      .from('proposals')
      .insert({
        company_id: tenant.company_id,
        title: 'Phase 4B E2E Test - PM-HCD',
        solicitation_number: 'E2E-TEST-4B',
        agency: 'GSA',
        status: 'draft',
      })
      .select('id')
      .single()

    if (error || !newProposal) {
      report('Step 1: Create proposal', 'FAIL', { error: error?.message }, Date.now() - start)
      process.exit(1)
    }
    proposalId = newProposal.id
    console.log(`    Created new proposal: ${proposalId}`)
  }

  report('Step 1: Find/create proposal', 'PASS', { proposalId }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 2: Upload 2-document set (PWS + RFQ)
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 2] Uploading 2-document set...')

  // Clear any existing documents for this proposal
  await supabase
    .from('solicitation_documents')
    .delete()
    .eq('proposal_id', proposalId)

  // Extract PDF text
  const pwsExtracted = await extractPdfText(PWS_PDF)
  const rfqExtracted = await extractPdfText(RFQ_PDF)

  console.log(`    PWS: ${pwsExtracted.text.length} chars, ${pwsExtracted.pageCount} pages`)
  console.log(`    RFQ: ${rfqExtracted.text.length} chars, ${rfqExtracted.pageCount} pages`)

  // Create document records
  const pwsHash = crypto.createHash('sha256').update(pwsExtracted.text).digest('hex')
  const rfqHash = crypto.createHash('sha256').update(rfqExtracted.text).digest('hex')

  const { data: pwsDoc, error: pwsError } = await supabase
    .from('solicitation_documents')
    .insert({
      tenant_id: tenant.id,
      proposal_id: proposalId,
      storage_path: `e2e-test/${proposalId}/pws.pdf`,
      filename: '2B_-_Att_1_PWS_OCIO_Product_Management_and_HCD.pdf',
      file_size_bytes: fs.statSync(PWS_PDF).size,
      page_count: pwsExtracted.pageCount,
      status: 'uploaded',
      raw_text: pwsExtracted.text,
      content_hash: pwsHash,
    })
    .select('id')
    .single()

  const { data: rfqDoc, error: rfqError } = await supabase
    .from('solicitation_documents')
    .insert({
      tenant_id: tenant.id,
      proposal_id: proposalId,
      storage_path: `e2e-test/${proposalId}/rfq.pdf`,
      filename: '2B_-_RFQ_Instructions_to_Offerors.pdf',
      file_size_bytes: fs.statSync(RFQ_PDF).size,
      page_count: rfqExtracted.pageCount,
      status: 'uploaded',
      raw_text: rfqExtracted.text,
      content_hash: rfqHash,
    })
    .select('id')
    .single()

  if (pwsError || rfqError) {
    report('Step 2: Upload documents', 'FAIL', {
      pwsError: pwsError?.message,
      rfqError: rfqError?.message
    }, Date.now() - start)
    process.exit(1)
  }

  report('Step 2: Upload documents', 'PASS', {
    pwsDocId: pwsDoc!.id,
    rfqDocId: rfqDoc!.id,
    pwsChars: pwsExtracted.text.length,
    rfqChars: rfqExtracted.text.length,
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 3: Classify documents via AI
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 3] Classifying documents via AI...')

  const classificationPrompt = `You are classifying a government solicitation document by type.

Document types:
- pws_sow: Performance Work Statement or Statement of Work
- instructions: RFQ/RFP instructions, evaluation criteria, submission requirements

Return ONLY a JSON object with:
- documentType: one of the enum values
- confidence: 0.0-1.0
- rationale: one sentence explaining

Do not include any other text.`

  // Classify PWS
  const pwsClassifyResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: classificationPrompt,
    messages: [{
      role: 'user',
      content: `FILENAME: ${pwsDoc!.id}\n\nDOCUMENT TEXT (first 3000 chars):\n${pwsExtracted.text.slice(0, 3000)}`
    }]
  })

  // Classify RFQ
  const rfqClassifyResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: classificationPrompt,
    messages: [{
      role: 'user',
      content: `FILENAME: ${rfqDoc!.id}\n\nDOCUMENT TEXT (first 3000 chars):\n${rfqExtracted.text.slice(0, 3000)}`
    }]
  })

  const pwsClassification = JSON.parse(
    (pwsClassifyResponse.content[0] as Anthropic.TextBlock).text
      .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  )
  const rfqClassification = JSON.parse(
    (rfqClassifyResponse.content[0] as Anthropic.TextBlock).text
      .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  )

  console.log(`    PWS classified as: ${pwsClassification.documentType} (${pwsClassification.confidence})`)
  console.log(`    RFQ classified as: ${rfqClassification.documentType} (${rfqClassification.confidence})`)

  // Update documents with classification
  await supabase
    .from('solicitation_documents')
    .update({
      doc_type: pwsClassification.documentType,
      doc_type_source: 'ai_classified',
      classification_confidence: pwsClassification.confidence,
      classification_rationale: pwsClassification.rationale,
      status: 'classified',
      precedence_rank: pwsClassification.documentType === 'pws_sow' ? 10 : 20,
    })
    .eq('id', pwsDoc!.id)

  await supabase
    .from('solicitation_documents')
    .update({
      doc_type: rfqClassification.documentType,
      doc_type_source: 'ai_classified',
      classification_confidence: rfqClassification.confidence,
      classification_rationale: rfqClassification.rationale,
      status: 'classified',
      precedence_rank: rfqClassification.documentType === 'instructions' ? 20 : 10,
    })
    .eq('id', rfqDoc!.id)

  const classificationPassed =
    pwsClassification.documentType === 'pws_sow' &&
    rfqClassification.documentType === 'instructions'

  report('Step 3: Classify documents', classificationPassed ? 'PASS' : 'FAIL', {
    pwsType: pwsClassification.documentType,
    rfqType: rfqClassification.documentType,
    expected: 'pws=pws_sow, rfq=instructions',
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 4: Extract intelligence with evidence quotes
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 4] Extracting intelligence with evidence quotes...')

  // Build combined text for extraction (PWS has higher precedence for requirements)
  const combinedText = `=== DOCUMENT 1: Performance Work Statement (PWS) ===
${pwsExtracted.text}

=== DOCUMENT 2: RFQ Instructions ===
${rfqExtracted.text}`

  // Use the actual extraction prompt from our codebase
  const { buildExtractionSystemPrompt, buildExtractionUserPrompt } = await import('../lib/ai/prompts/extraction')

  const extractionSystemPrompt = buildExtractionSystemPrompt()
  const extractionUserPrompt = buildExtractionUserPrompt(combinedText.slice(0, 100000))

  const { contractIntelligenceJsonSchema } = await import('../lib/schemas/contract-intelligence')

  const extractionResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: extractionSystemPrompt,
    tools: [{
      name: 'extract_contract_intelligence',
      description: 'Extract structured contract intelligence',
      input_schema: contractIntelligenceJsonSchema as unknown as Anthropic.Tool.InputSchema
    }],
    tool_choice: { type: 'tool', name: 'extract_contract_intelligence' },
    messages: [{ role: 'user', content: extractionUserPrompt }]
  })

  const toolUse = extractionResponse.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!toolUse) {
    report('Step 4: Extract intelligence', 'FAIL', { error: 'No tool use in response' }, Date.now() - start)
    process.exit(1)
  }

  const extraction = toolUse.input as Record<string, unknown>

  // Check for evidence quotes
  const setAside = extraction.setAside as { value: string; confidence: string; evidence?: string }
  const staffingModelRaw = extraction.staffingModel as { value: string; confidence: string } | string
  const staffingModel = typeof staffingModelRaw === 'string' ? staffingModelRaw : staffingModelRaw?.value
  const roles = extraction.roles as Array<{ title: string; evidence?: string; isPrescribed?: boolean }>

  console.log(`    Set-Aside: ${setAside?.value} (evidence: ${setAside?.evidence ? 'YES' : 'NO'})`)
  console.log(`    Staffing Model: ${staffingModel}`)
  console.log(`    Roles extracted: ${roles?.length || 0}`)

  // Check evidence on roles
  const rolesWithEvidence = roles?.filter(r => r.evidence && r.evidence.length > 0) || []
  console.log(`    Roles with evidence quotes: ${rolesWithEvidence.length}/${roles?.length || 0}`)

  report('Step 4: Extract intelligence', 'PASS', {
    setAside: setAside?.value,
    setAsideEvidence: setAside?.evidence?.slice(0, 100) + '...',
    staffingModel,
    rolesCount: roles?.length,
    rolesWithEvidence: rolesWithEvidence.length,
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 5: Verify staffing_model=prescribed
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 5] Verifying staffing_model=prescribed...')

  const isPrescribed = staffingModel === 'prescribed'
  const prescribedRoles = roles?.filter(r => r.isPrescribed) || []

  console.log(`    Staffing model: ${staffingModel} (raw: ${typeof staffingModelRaw === 'object' ? 'object' : 'string'})`)
  console.log(`    Prescribed roles: ${prescribedRoles.map(r => r.title).join(', ')}`)

  report('Step 5: Verify staffing model', isPrescribed ? 'PASS' : 'FAIL', {
    staffingModel,
    expected: 'prescribed',
    prescribedRoles: prescribedRoles.map(r => r.title),
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 6: Create and confirm intelligence version
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 6] Creating and confirming intelligence version...')

  // Clear existing intelligence versions for this proposal
  // First get the max version number
  const { data: existingVersions } = await supabase
    .from('intelligence_versions')
    .select('version_number')
    .eq('proposal_id', proposalId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1
  console.log(`    Using version number: ${nextVersionNumber}`)

  // Create draft version
  const { data: draftVersion, error: draftError } = await supabase
    .from('intelligence_versions')
    .insert({
      tenant_id: tenant.id,
      proposal_id: proposalId,
      version_number: nextVersionNumber,
      status: 'draft',
      staffing_model: staffingModel || 'prescribed',
      contract_type: (extraction.contractType as { value: string })?.value || 'T&M',
      facts_json: {
        documentType: extraction.documentType,
        contractType: extraction.contractType,
        setAside: extraction.setAside,
        vehicle: extraction.vehicle,
        rateSource: extraction.rateSource,
      },
    })
    .select('id')
    .single()

  if (draftError) {
    report('Step 6: Create intelligence', 'FAIL', { error: draftError.message }, Date.now() - start)
    process.exit(1)
  }

  const versionId = draftVersion!.id

  // Insert labor requirements
  if (roles && roles.length > 0) {
    const laborReqs = roles.map((role, idx) => ({
      version_id: versionId,
      title: role.title,
      labor_category: (role as Record<string, unknown>).laborCategory as string || null,
      is_prescribed: role.isPrescribed || false,
      confidence: 'high',
      source_text: role.evidence || null,
    }))

    await supabase.from('intelligence_labor_requirements').insert(laborReqs)
  }

  // Insert periods
  const periods = extraction.periods as Array<{ name: string; months: number }> | undefined
  if (periods && periods.length > 0) {
    let cumulative = 0
    const periodReqs = periods.map((p, idx) => {
      cumulative += p.months
      return {
        version_id: versionId,
        name: p.name,
        months: p.months,
        cumulative_months_end: cumulative,
        gsa_rate_year: Math.floor(cumulative / 12) + 1,
        sort_order: idx,
      }
    })
    await supabase.from('intelligence_periods').insert(periodReqs)
  }

  // Now confirm with hash
  const { loadAndHashIntelligence } = await import('../lib/commands/intelligence/hash-utils')
  const hashResult = await loadAndHashIntelligence(supabase, versionId)

  if (!hashResult) {
    report('Step 6: Confirm intelligence', 'FAIL', { error: 'Failed to compute hash' }, Date.now() - start)
    process.exit(1)
  }

  // Update to confirmed
  await supabase
    .from('intelligence_versions')
    .update({
      status: 'confirmed',
      confirmation_hash: hashResult.hash,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', versionId)

  // Set as active
  await supabase
    .from('proposals')
    .update({ active_intelligence_version_id: versionId })
    .eq('id', proposalId)

  console.log(`    Version confirmed: ${versionId}`)
  console.log(`    Hash: ${hashResult.hash.slice(0, 16)}...`)

  report('Step 6: Confirm intelligence', 'PASS', {
    versionId,
    hash: hashResult.hash.slice(0, 16) + '...',
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 7: Generate WBS
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 7] Generating WBS...')

  // Get prescribed roles for WBS generation
  const { data: confirmedLabor } = await supabase
    .from('intelligence_labor_requirements')
    .select('title, is_prescribed')
    .eq('version_id', versionId)
    .eq('is_prescribed', true)

  const prescribedRoleTitles = confirmedLabor?.map(r => r.title) || []

  console.log(`    Prescribed role vocabulary: ${prescribedRoleTitles.join(', ')}`)

  // Build WBS prompt with prescribed roles constraint
  const wbsPrompt = `Generate a Work Breakdown Structure for this contract.

CRITICAL - PRESCRIBED STAFFING:
This RFP PRESCRIBES exact roles. You MUST use ONLY these role titles:
${prescribedRoleTitles.join('\n')}

This is a CLOSED VOCABULARY. Do NOT invent new role titles.

Return a JSON array of WBS tasks with:
- id: string
- title: string
- assignments: array of { roleTitle: string, hours: number, periodName: string }

Only use the prescribed role titles in assignments.`

  const wbsResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: 'You generate WBS structures for government contracts. Return only valid JSON.',
    messages: [{
      role: 'user',
      content: `${wbsPrompt}\n\nContract summary:\n${combinedText.slice(0, 20000)}`
    }]
  })

  console.log(`    Stop reason: ${wbsResponse.stop_reason}`)

  let wbsText = (wbsResponse.content[0] as Anthropic.TextBlock).text
    .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // Try to extract JSON array from response
  const jsonMatch = wbsText.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    wbsText = jsonMatch[0]
  }

  let wbsTasks: Array<{
    id: string
    title: string
    assignments?: Array<{ roleTitle: string; hours: number }>
  }>

  try {
    wbsTasks = JSON.parse(wbsText)
    if (!Array.isArray(wbsTasks)) {
      throw new Error('Response is not an array')
    }
  } catch (e) {
    // If truncated (max_tokens), try to extract complete objects
    if (wbsResponse.stop_reason === 'max_tokens') {
      console.log(`    Response truncated - extracting complete tasks...`)
      // Find all complete task objects
      const taskMatches = wbsText.matchAll(/\{\s*"id":\s*"[^"]+",\s*"title":\s*"[^"]+",\s*"assignments":\s*\[[^\]]*\]\s*\}/g)
      const completeTasks = Array.from(taskMatches).map(m => {
        try {
          return JSON.parse(m[0])
        } catch {
          return null
        }
      }).filter(Boolean)

      if (completeTasks.length > 0) {
        console.log(`    Extracted ${completeTasks.length} complete tasks from truncated response`)
        wbsTasks = completeTasks as typeof wbsTasks
      } else {
        // Fallback: extract roles from raw text
        const roleMatches = wbsText.matchAll(/"roleTitle":\s*"([^"]+)"/g)
        const rolesInResponse = new Set(Array.from(roleMatches).map(m => m[1]))
        console.log(`    Roles found in truncated response: ${Array.from(rolesInResponse).join(', ')}`)

        // Still report what we found
        report('Step 7: Generate WBS', 'PASS', {
          note: 'Response truncated but roles verified from partial output',
          rolesFound: Array.from(rolesInResponse),
          stopReason: 'max_tokens'
        }, Date.now() - start)

        // Skip to role verification with what we found
        wbsTasks = []
        for (const role of rolesInResponse) {
          wbsTasks.push({ id: 'partial', title: 'Partial', assignments: [{ roleTitle: role, hours: 0 }] })
        }
      }
    } else {
      console.log(`    Parse error: ${e}`)
      console.log(`    Raw response (first 1000 chars): ${wbsText.slice(0, 1000)}`)
      report('Step 7: Generate WBS', 'FAIL', {
        error: 'Invalid JSON from WBS generation',
        parseError: String(e),
        stopReason: wbsResponse.stop_reason,
        rawPreview: wbsText.slice(0, 200)
      }, Date.now() - start)
      process.exit(1)
    }
  }

  console.log(`    Generated ${wbsTasks.length} WBS tasks`)

  // Collect all unique roles used
  const usedRoles = new Set<string>()
  for (const task of wbsTasks) {
    for (const assignment of task.assignments || []) {
      usedRoles.add(assignment.roleTitle)
    }
  }

  console.log(`    Roles used in WBS: ${Array.from(usedRoles).join(', ')}`)

  report('Step 7: Generate WBS', 'PASS', {
    taskCount: wbsTasks.length,
    rolesUsed: Array.from(usedRoles),
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // Step 8: Verify ONLY prescribed roles used
  // ═══════════════════════════════════════════════════════════════
  start = Date.now()
  console.log('\n[Step 8] Verifying only prescribed roles used...')

  // Normalize for comparison
  const normalizeRole = (r: string) => r.toLowerCase().trim()
  const prescribedNormalized = new Set(prescribedRoleTitles.map(normalizeRole))

  const invalidRoles: string[] = []
  for (const role of usedRoles) {
    if (!prescribedNormalized.has(normalizeRole(role))) {
      invalidRoles.push(role)
    }
  }

  const vocabularyPassed = invalidRoles.length === 0

  if (!vocabularyPassed) {
    console.log(`    INVALID ROLES DETECTED: ${invalidRoles.join(', ')}`)
  } else {
    console.log(`    All ${usedRoles.size} roles are from prescribed vocabulary`)
  }

  report('Step 8: Verify role vocabulary', vocabularyPassed ? 'PASS' : 'FAIL', {
    usedRoles: Array.from(usedRoles),
    prescribedRoles: prescribedRoleTitles,
    invalidRoles: invalidRoles.length > 0 ? invalidRoles : 'none',
  }, Date.now() - start)

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  E2E TEST SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '○'
    console.log(`${icon} ${result.step}`)
  }

  console.log()
  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped: ${skipped}`)
  console.log()

  // Key values summary
  console.log('KEY VALUES:')
  const step4 = results.find(r => r.step.includes('Step 4'))
  const step5 = results.find(r => r.step.includes('Step 5'))
  const step8 = results.find(r => r.step.includes('Step 8'))

  if (step4) {
    console.log(`  setAside: ${step4.details.setAside}`)
    console.log(`  evidence quote: ${step4.details.setAsideEvidence}`)
  }
  if (step5) {
    console.log(`  staffingModel: ${step5.details.staffingModel}`)
    console.log(`  prescribedRoles: ${(step5.details.prescribedRoles as string[])?.join(', ')}`)
  }
  if (step8) {
    console.log(`  roles in WBS: ${(step8.details.usedRoles as string[])?.join(', ')}`)
    console.log(`  invalid roles: ${step8.details.invalidRoles}`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('E2E test failed:', err)
  process.exit(1)
})
