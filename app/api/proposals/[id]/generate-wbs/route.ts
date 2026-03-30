import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { syncRolesFromWBS } from '@/lib/wbs-to-roles'

const SYSTEM_PROMPT = `You are a senior government proposal manager and technical architect. Your job is to create a Work Breakdown Structure (WBS) for a federal IT services contract.

A WBS organizes work into logical packages that:
- Can be staffed with specific roles
- Can be priced with hours
- Map directly to requirements
- Represent distinct deliverables or workstreams

Rules for generating WBS elements:
1. Create 6-12 work packages — not too granular, not too broad
2. Every requirement must map to at least one WBS element
3. Group related requirements into the same work package when they represent the same workstream
4. Name each element as a clear noun phrase: "Authentication & Identity Management" not "Implement Auth"
5. Each element should have 2-5 concrete tasks
6. Suggest realistic hours based on complexity (government IT: 160-960 hrs per work package is typical for a scoped engagement)
7. Suggest appropriate roles from this list: Senior Developer, Front-end Developer, Back-end Developer, DevOps Engineer, QA Engineer, Product Manager, Product Designer, UX Researcher, Content Writer, Delivery Manager`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const { id: proposalId } = await params

  // Fetch proposal working_data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const requirements = (workingData.extractedRequirements || []) as {
    id: string
    title: string
    text?: string
    description?: string
    type: string
    referenceNumber?: string
    reference_number?: string
    sourceSection?: string
    source?: string
  }[]

  if (requirements.length === 0) {
    return NextResponse.json({
      error: 'No requirements extracted yet. Go to Scope → Solicitation to extract requirements first.'
    }, { status: 400 })
  }

  // Build summary context
  const summary = (workingData.solicitationSummary as Record<string, unknown>) || {}
  const summaryText = (summary.whatTheyWant as string) || (summary.what_they_want as string) || ''

  // Build requirements text for prompt
  const reqsText = requirements.map(r => {
    const ref = r.referenceNumber || r.reference_number || r.id
    return `${ref} [${r.type}]: ${r.text || r.description || r.title}`
  }).join('\n')

  const userPrompt = `Create a Work Breakdown Structure for this government contract. Every requirement must be linked to at least one WBS element. Also identify logical dependencies between work packages.

CONTRACT SUMMARY:
${summaryText || 'Federal IT services contract'}

EXTRACTED REQUIREMENTS:
${reqsText}

Return ONLY a valid JSON array, no other text:

[
  {
    "ref": "WBS-01",
    "name": "Work package name",
    "description": "2-3 sentences describing what this package delivers",
    "requirementRefs": ["REQ-001", "REQ-002"],
    "dependsOn": [],
    "estimationType": "engineering_estimate",
    "tasks": [
      {
        "name": "Specific task name",
        "suggestedRole": "Senior Developer",
        "estimatedHours": 160,
        "loeType": "development",
        "basisOfEstimate": "Based on similar authentication implementations in prior engagements"
      }
    ],
    "totalHours": 320,
    "assumptions": [
      "SSO configuration docs provided at kickoff",
      "OKTA tenant already provisioned"
    ]
  }
]

DEPENDENCY RULES:
- "dependsOn" contains ref values of WBS elements that must complete BEFORE this one starts
- Common patterns: Infrastructure → everything else, Authentication → user-facing features, Discovery → Design → Development
- Only add genuinely blocking dependencies. Use empty array [] if none.

ESTIMATION TYPES (use exactly one per element):
  "engineering_estimate" | "loe" | "historical" | "parametric" | "analogy"

LOE TYPES for tasks (use exactly one per task):
  "development" | "configuration" | "integration" | "testing" | "documentation" | "management" | "research" | "design"

IMPORTANT:
- Every requirement ref in requirementRefs must exist in the requirements list above
- Every requirement must appear in at least one element's requirementRefs
- dependsOn must only reference refs that exist in this same response
- totalHours must equal sum of task hours
- 6-12 work packages total
- Assumptions should be specific, not generic`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse JSON — strip markdown backticks
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7)
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3)
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3)
    jsonText = jsonText.trim()

    let parsed: {
      ref: string
      name: string
      description: string
      requirementRefs: string[]
      dependsOn: string[]
      estimationType: string
      tasks: { name: string; suggestedRole: string; estimatedHours: number; loeType?: string; basisOfEstimate?: string }[]
      totalHours: number
      assumptions: string[]
    }[]

    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error('[generate-wbs] Failed to parse AI response:', jsonText.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ error: 'AI returned empty WBS' }, { status: 500 })
    }

    // Build ref → ID lookup from requirements
    const refToId = new Map<string, string>()
    requirements.forEach(r => {
      const ref = r.referenceNumber || r.reference_number || r.id
      refToId.set(ref, r.id)
    })

    // Convert to WBS elements format with BOE fields
    const wbsElements = parsed.map(el => ({
      id: crypto.randomUUID(),
      ref: el.ref,
      wbsNumber: el.ref.replace('WBS-', '').replace(/^0/, '') + '.0',
      title: el.name,
      description: el.description,
      why: el.description,
      what: el.description,
      notIncluded: '',
      estimationType: el.estimationType || 'engineering_estimate',
      basisOfEstimate: '',
      historicalReference: '',
      assumptions: el.assumptions || [],
      laborEstimates: el.tasks.map(t => ({
        id: crypto.randomUUID(),
        roleId: '',
        roleName: t.suggestedRole,
        hoursByPeriod: { base: t.estimatedHours, option1: 0, option2: 0, option3: 0, option4: 0 },
        rationale: t.name,
        confidence: 'medium' as const,
        isAISuggested: true,
        isOrphaned: false,
        loeType: t.loeType || 'development',
        basisOfEstimate: t.basisOfEstimate || '',
      })),
      tasks: el.tasks.map(t => ({
        id: crypto.randomUUID(),
        name: t.name,
        role: t.suggestedRole,
        hours: t.estimatedHours,
        loeType: t.loeType || 'development',
        chargeCode: null,
        basisOfEstimate: t.basisOfEstimate || '',
      })),
      totalHours: el.totalHours,
      requirementLinks: el.requirementRefs
        .map(ref => refToId.get(ref))
        .filter((id): id is string => id != null),
      _dependencyRefs: el.dependsOn || [],
      dependencies: [] as string[],
      notes: '',
      isAIGenerated: true,
      qualityGrade: 'green' as const,
      qualityScore: 75,
      qualityIssues: [],
    }))

    // Resolve dependency refs → IDs
    const refToWbsId = new Map(wbsElements.map(el => [el.ref, el.id]))
    wbsElements.forEach(el => {
      el.dependencies = (el._dependencyRefs as string[])
        .map(ref => refToWbsId.get(ref))
        .filter((id): id is string => id != null)
      delete (el as Record<string, unknown>)._dependencyRefs
    })

    // Sync roles from WBS tasks
    const existingWorkingData = (proposal.working_data || {}) as Record<string, unknown>
    const existingRoles = (existingWorkingData.roles || existingWorkingData.selectedRoles || []) as { id: string; name: string; isManual?: boolean; [key: string]: unknown }[]
    const proposalSetup = (existingWorkingData.proposalSetup || {}) as { optionYears?: number }
    const syncedRoles = syncRolesFromWBS(wbsElements, existingRoles, proposalSetup)

    // Save both WBS elements and synced roles to working_data
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: {
          ...existingWorkingData,
          estimateWbsElements: wbsElements,
          roles: syncedRoles,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('[generate-wbs] Failed to save:', updateError)
      return NextResponse.json({ error: 'Failed to save WBS elements' }, { status: 500 })
    }

    console.log(`[generate-wbs] Generated ${wbsElements.length} elements, synced ${syncedRoles.length} roles for proposal ${proposalId}`)

    return NextResponse.json({
      wbsElements,
      roles: syncedRoles,
      count: wbsElements.length,
      rolesCount: syncedRoles.length,
    })

  } catch (error) {
    console.error('[generate-wbs] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
