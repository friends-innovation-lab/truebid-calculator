import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a government proposal manager creating a proposal outline structure.

Your job is to read Section L compliance items and generate a logical proposal outline with volumes and sections.

Standard government proposal structure:
- Volume I: Technical Proposal (technical approach, management approach, past performance, key personnel)
- Volume II: Price/Cost (pricing template, basis of estimate)

Some RFPs have different structures — follow what Section L specifies exactly. Page limits and submission requirements come from Section L.

Generate unique IDs for each volume, section, and subsection using the format vol-1, sec-1-1, sub-1-1-1 etc.
Set all statuses to "not_started".
Set assignee to null.
Map compliance refs from the Section L items to the appropriate sections.`

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
    .select('working_data, contract_type')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    console.error('[generate-outline] Proposal fetch failed:', proposalId, fetchError?.message)
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Fetch compliance items from DB
  const { data: complianceItems } = await supabase
    .from('compliance_items')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  // Filter for Section L items (instructions)
  const sectionL = (complianceItems || []).filter(item =>
    item.source === 'instruction' ||
    item.proposal_section?.startsWith('L') ||
    item.requirement_ref?.startsWith('L')
  )

  if (sectionL.length === 0) {
    return NextResponse.json({ error: 'No Section L items found in compliance matrix' }, { status: 400 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const proposalSetup = (workingData.proposalSetup || {}) as Record<string, unknown>
  const solicitationSummary = (workingData.solicitationSummary || workingData.solicitation || {}) as Record<string, unknown>
  const whatTheyWant = (solicitationSummary.whatTheyWant as string) || (solicitationSummary.what_they_want as string) || 'Federal IT services contract'

  const contractType = (proposalSetup.contractType as string) || (proposal.contract_type as string) || 'T&M'
  const setAside = (proposalSetup.setAside as string) || 'N/A'

  const reqsText = sectionL.map(item =>
    `[${item.requirement_ref || 'L'}]: ${item.requirement_text}`
  ).join('\n')

  const userPrompt = `Create a proposal outline for this government contract.

CONTRACT TYPE: ${contractType}
SET-ASIDE: ${setAside}

WHAT THEY WANT:
${whatTheyWant}

SECTION L COMPLIANCE ITEMS:
${reqsText}

Return ONLY valid JSON, no other text:

{
  "volumes": [
    {
      "id": "vol-1",
      "title": "Volume I — Technical Proposal",
      "description": "Technical approach, management plan, past performance, and key personnel.",
      "maxPages": null,
      "complianceRef": "L.3",
      "sections": [
        {
          "id": "sec-1-1",
          "number": "1.0",
          "title": "Technical Approach",
          "description": "Detailed description of the proposed technical solution.",
          "pageTarget": null,
          "status": "not_started",
          "assignee": null,
          "complianceRefs": ["L.3"],
          "requirementRefs": [],
          "subsections": [
            {
              "id": "sub-1-1-1",
              "number": "1.1",
              "title": "Understanding of Requirements",
              "pageTarget": null,
              "status": "not_started"
            }
          ]
        }
      ]
    }
  ]
}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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

    // Parse JSON from response
    let parsed: { volumes: unknown[] }
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[generate-outline] No JSON found in:', responseText.substring(0, 500))
        return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[generate-outline] Parse failed:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!parsed.volumes || !Array.isArray(parsed.volumes) || parsed.volumes.length === 0) {
      return NextResponse.json({ error: 'AI returned empty outline' }, { status: 500 })
    }

    const outline = parsed

    // Save to working_data
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: {
          ...workingData,
          outline,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('[generate-outline] Failed to save:', updateError)
      return NextResponse.json({ error: 'Failed to save outline' }, { status: 500 })
    }

    const totalSections = (outline.volumes as { sections?: unknown[] }[]).reduce((sum: number, v) =>
      sum + (v.sections?.length || 0), 0
    )

    console.log(`[generate-outline] Generated ${outline.volumes.length} volumes, ${totalSections} sections for proposal ${proposalId}`)

    return NextResponse.json({ outline })

  } catch (error) {
    console.error('[generate-outline] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
