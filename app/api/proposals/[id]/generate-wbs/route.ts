import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

  const userPrompt = `Create a WBS for this government contract.

CONTRACT SUMMARY:
${summaryText || 'Federal IT services contract'}

EXTRACTED REQUIREMENTS:
${reqsText}

Return ONLY a valid JSON array, no other text:

[
  {
    "ref": "WBS-01",
    "name": "Work package name",
    "description": "2-3 sentence description of what this package delivers",
    "requirementRefs": ["REQ-001", "REQ-002"],
    "tasks": [
      {
        "name": "Specific task name",
        "suggestedRole": "Senior Developer",
        "estimatedHours": 160
      }
    ],
    "totalHours": 320
  }
]

IMPORTANT:
- requirementRefs must only contain ref values that exist in the requirements list above
- Every requirement ref from the list must appear in at least one WBS element's requirementRefs
- totalHours must equal sum of task hours
- Refs: WBS-01, WBS-02... in sequence`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
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
      tasks: { name: string; suggestedRole: string; estimatedHours: number }[]
      totalHours: number
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

    // Convert to WBS elements format
    const wbsElements = parsed.map(el => ({
      id: crypto.randomUUID(),
      wbsNumber: el.ref.replace('WBS-', '').replace(/^0/, '') + '.0',
      title: el.name,
      description: el.description,
      why: el.description,
      what: el.description,
      notIncluded: '',
      assumptions: [],
      laborEstimates: el.tasks.map(t => ({
        id: crypto.randomUUID(),
        roleId: '',
        roleName: t.suggestedRole,
        hoursByPeriod: { base: t.estimatedHours, option1: 0, option2: 0, option3: 0, option4: 0 },
        rationale: t.name,
        confidence: 'medium' as const,
        isAISuggested: true,
        isOrphaned: false,
      })),
      requirementLinks: el.requirementRefs
        .map(ref => refToId.get(ref))
        .filter((id): id is string => id != null),
      dependencies: [],
      notes: '',
      isAIGenerated: true,
      qualityGrade: 'green' as const,
      qualityScore: 75,
      qualityIssues: [],
    }))

    // Save to working_data — merge with existing data
    const existingWorkingData = proposal.working_data || {}
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: {
          ...existingWorkingData as Record<string, unknown>,
          estimateWbsElements: wbsElements,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('[generate-wbs] Failed to save:', updateError)
      return NextResponse.json({ error: 'Failed to save WBS elements' }, { status: 500 })
    }

    console.log(`[generate-wbs] Generated ${wbsElements.length} elements for proposal ${proposalId}`)

    return NextResponse.json({
      wbsElements,
      count: wbsElements.length,
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
