import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const confirmSchema = z.object({
  confirm: z.literal(true),
})

const complianceItemSchema = z.object({
  requirement_id: z.string().optional().catch(undefined),
  requirement_ref: z.string().catch(''),
  proposal_section: z.string().catch(''),
  compliance_status: z.string().transform(s => {
    const normalized = s?.toLowerCase?.() || 'compliant'
    if (['compliant', 'partial', 'exception'].includes(normalized)) return normalized
    return 'compliant'
  }).catch('compliant'),
  notes: z.string().catch(''),
}).passthrough()

const instructionItemSchema = z.object({
  ref: z.string().catch(''),
  text: z.string().catch(''),
  category: z.string().transform(s => {
    const normalized = s?.toLowerCase?.() || 'content'
    if (['format', 'content', 'submission', 'certification'].includes(normalized)) return normalized
    return 'content'
  }).catch('content'),
}).passthrough()

const GENERATE_PROMPT = `You are a government proposal compliance expert.
Given these requirements from a federal solicitation, generate a compliance matrix mapping each requirement to the most appropriate proposal section.

Use these standard proposal sections:
- Volume I, Section 1 — Executive Summary
- Volume I, Section 2 — Technical Approach
- Volume I, Section 3 — Management Approach
- Volume I, Section 4 — Past Performance
- Volume II, Section 1 — Price/Cost
- Volume II, Section 2 — Basis of Estimate

For each requirement return:
{
  "requirement_id": "the UUID provided",
  "requirement_ref": "reference like REQ-001 or Section C.3.2",
  "proposal_section": "the mapped proposal section",
  "compliance_status": "compliant" | "partial" | "exception",
  "notes": "brief explanation of how this will be addressed"
}

Status guidelines:
- compliant: Standard requirement we can fully address
- partial: Requirement we can partially address or needs clarification
- exception: Requirement we cannot meet or conflicts with our approach

Return only a JSON array. No preamble, no explanation.`

const SECTION_L_PROMPT = `You are a government proposal expert. From this RFP document extract all instructions to offerors from Section L or equivalent (Instructions, Conditions, and Notices to Offerors).

For each instruction return:
{
  "ref": "reference like L.5, L.5.1, or Instructions-1",
  "text": "the instruction text",
  "category": "format" | "content" | "submission" | "certification"
}

Focus on: page limits, font/margin requirements, required sections, required certifications, submission format, and volume structure.

Return only a JSON array. No preamble, no explanation.`

const WBS_LINK_PROMPT = `You are a government proposal traceability expert.
Given requirements and WBS (Work Breakdown Structure) elements, suggest which WBS elements best address each requirement.

For each requirement, return the requirement_id and an array of suggested WBS element IDs that would address that requirement.
Only link WBS elements that are genuinely relevant to the requirement.
A requirement may have 0-3 linked WBS elements.

Return only a JSON array:
[
  { "requirement_id": "uuid", "wbs_ids": ["wbs-uuid-1", "wbs-uuid-2"] },
  ...
]

No preamble, no explanation.`

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
    return NextResponse.json(
      { error: 'Anthropic API key not configured' },
      { status: 500 }
    )
  }

  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validated = confirmSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Confirmation required. Send { confirm: true }' },
      { status: 400 }
    )
  }

  try {
    // Delete existing compliance items
    const { error: deleteError } = await supabase
      .from('compliance_items')
      .delete()
      .eq('proposal_id', id)

    if (deleteError) {
      console.error('[regenerate] Delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Fetch requirements for this proposal
    const { data: requirements, error: reqError } = await supabase
      .from('requirements')
      .select('*')
      .eq('proposal_id', id)

    if (reqError) {
      console.error('[regenerate] Requirements fetch error:', reqError)
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }

    if (!requirements || requirements.length === 0) {
      return NextResponse.json(
        { error: 'No requirements found. Extract requirements first.' },
        { status: 400 }
      )
    }

    // Fetch proposal working_data and WBS elements
    const [proposalResult, wbsResult] = await Promise.all([
      supabase
        .from('proposals')
        .select('working_data')
        .eq('id', id)
        .single(),
      supabase
        .from('wbs_elements')
        .select('id, wbs_number, title, description')
        .eq('proposal_id', id)
        .order('wbs_number', { ascending: true }),
    ])

    const workingData = proposalResult.data?.working_data || {}
    const solicitationText = workingData.solicitationRawText || ''
    const wbsElements = wbsResult.data || []

    console.log('[regenerate] working_data keys:', Object.keys(workingData))
    console.log('[regenerate] solicitationRawText length:', solicitationText.length)

    // Build requirements array with actual text for Claude
    const requirementsForPrompt = requirements.map((req, index) => {
      const ref = req.reference_number || `REQ-${String(index + 1).padStart(3, '0')}`
      const text = req.description || req.title || ''
      return {
        id: req.id,
        ref,
        text,
        type: req.type || 'shall',
      }
    })

    // Format requirements for the prompt
    const requirementsText = requirementsForPrompt.map(req =>
      `[ID: ${req.id}] [Ref: ${req.ref}] [Type: ${req.type}] ${req.text}`
    ).join('\n\n')

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: `${GENERATE_PROMPT}\n\nRequirements to map:\n\n${requirementsText}`
        }
      ],
    })

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    if (!responseText) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 }
      )
    }

    // Check if response was truncated
    if (response.stop_reason === 'max_tokens') {
      console.error('[regenerate] Response truncated due to max_tokens')
      return NextResponse.json(
        { error: 'Too many requirements to process at once. Try with fewer requirements.' },
        { status: 400 }
      )
    }

    // Parse the JSON response
    let parsedItems
    try {
      let cleanedResponse = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const jsonStart = cleanedResponse.indexOf('[')
      const jsonEnd = cleanedResponse.lastIndexOf(']')

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON array found in response')
      }

      const jsonString = cleanedResponse.slice(jsonStart, jsonEnd + 1)
      parsedItems = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI response. Raw response:', responseText)
      console.error('Parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    console.log('[regenerate] Parsed items count:', parsedItems?.length)

    // Build a map of requirement ID to requirement data for lookup
    const reqMap = new Map(requirements.map(r => [r.id, r]))

    // Validate and prepare items for insertion
    const itemsToInsert = []
    for (const item of parsedItems) {
      const validatedItem = complianceItemSchema.safeParse(item)
      if (!validatedItem.success) {
        console.log('[regenerate] Validation failed for item:', item, 'Errors:', validatedItem.error.issues)
        continue
      }

      // Find matching requirement by ID
      const matchingReq = reqMap.get(item.requirement_id) ||
        requirements.find(r => r.reference_number === validatedItem.data.requirement_ref)

      if (matchingReq) {
        itemsToInsert.push({
          proposal_id: id,
          requirement_id: matchingReq.id,
          requirement_text: matchingReq.description || matchingReq.title || '',
          requirement_ref: matchingReq.reference_number || validatedItem.data.requirement_ref,
          proposal_section: validatedItem.data.proposal_section,
          compliance_status: validatedItem.data.compliance_status,
          notes: validatedItem.data.notes,
          source: 'requirement',
        })
      }
    }

    // Suggest WBS links for requirement items if WBS elements exist
    let wbsLinksGenerated = false
    if (wbsElements.length > 0 && itemsToInsert.length > 0) {
      console.log('[regenerate] Suggesting WBS links...')
      try {
        // Build requirement summary for AI
        const requirementSummary = itemsToInsert.map(item => ({
          requirement_id: item.requirement_id,
          ref: item.requirement_ref,
          text: item.requirement_text.substring(0, 500),
        }))

        // Build WBS summary for AI
        const wbsSummary = wbsElements.map(w => ({
          id: w.id,
          number: w.wbs_number,
          title: w.title,
          description: w.description?.substring(0, 200) || '',
        }))

        const wbsLinkResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: `${WBS_LINK_PROMPT}\n\nRequirements:\n${JSON.stringify(requirementSummary, null, 2)}\n\nWBS Elements:\n${JSON.stringify(wbsSummary, null, 2)}`
            }
          ],
        })

        const wbsLinkText = wbsLinkResponse.content[0].type === 'text'
          ? wbsLinkResponse.content[0].text
          : ''

        if (wbsLinkText && wbsLinkResponse.stop_reason !== 'max_tokens') {
          let cleanedWbsLink = wbsLinkText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim()

          const jsonStart = cleanedWbsLink.indexOf('[')
          const jsonEnd = cleanedWbsLink.lastIndexOf(']')

          if (jsonStart !== -1 && jsonEnd !== -1) {
            const wbsLinks = JSON.parse(cleanedWbsLink.slice(jsonStart, jsonEnd + 1))
            const wbsLinkMap = new Map<string, string[]>(
              wbsLinks.map((link: { requirement_id: string; wbs_ids: string[] }) => [
                link.requirement_id,
                link.wbs_ids || [],
              ])
            )

            // Apply WBS links to itemsToInsert
            for (const item of itemsToInsert) {
              const suggestedWbsIds: string[] = wbsLinkMap.get(item.requirement_id) || []
              // Filter to only valid WBS IDs that exist
              const validWbsIds = suggestedWbsIds.filter((wbsId) =>
                wbsElements.some(w => w.id === wbsId)
              )
              if (validWbsIds.length > 0) {
                (item as Record<string, unknown>).linked_wbs_ids = validWbsIds
              }
            }
            console.log('[regenerate] WBS links suggested for', wbsLinks.length, 'requirements')
            wbsLinksGenerated = true
          }
        }
      } catch (wbsLinkError) {
        console.warn('[regenerate] WBS link suggestion failed:', wbsLinkError)
        // Continue without WBS links - not a fatal error
      }
    }

    // Track what sections were generated
    let instructionsExtracted = false
    let instructionsSkippedReason: string | null = null

    // Extract Section L instructions if we have the raw solicitation text
    if (solicitationText && solicitationText.length > 100) {
      console.log('[regenerate] Extracting Section L instructions...')
      try {
        const sectionLResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: `${SECTION_L_PROMPT}\n\nDocument:\n\n${solicitationText.substring(0, 100000)}`
            }
          ],
        })

        const sectionLText = sectionLResponse.content[0].type === 'text'
          ? sectionLResponse.content[0].text
          : ''

        if (sectionLText && sectionLResponse.stop_reason !== 'max_tokens') {
          let cleanedSectionL = sectionLText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim()

          const jsonStart = cleanedSectionL.indexOf('[')
          const jsonEnd = cleanedSectionL.lastIndexOf(']')

          if (jsonStart !== -1 && jsonEnd !== -1) {
            const instructions = JSON.parse(cleanedSectionL.slice(jsonStart, jsonEnd + 1))

            for (const instr of instructions) {
              const validatedInstr = instructionItemSchema.safeParse(instr)
              if (validatedInstr.success && validatedInstr.data.text) {
                itemsToInsert.push({
                  proposal_id: id,
                  requirement_id: null,
                  requirement_text: validatedInstr.data.text,
                  requirement_ref: validatedInstr.data.ref || 'L.x',
                  proposal_section: mapCategoryToSection(validatedInstr.data.category),
                  compliance_status: 'unaddressed',
                  notes: `Category: ${validatedInstr.data.category}`,
                  source: 'instruction',
                })
              }
            }
            console.log('[regenerate] Extracted Section L instructions:', instructions.length)
            instructionsExtracted = true
          }
        }
      } catch (sectionLError) {
        console.warn('[regenerate] Section L extraction failed:', sectionLError)
        instructionsSkippedReason = 'Section L extraction failed'
        // Continue without Section L - not a fatal error
      }
    } else {
      instructionsSkippedReason = 'Re-upload RFP to enable Section L extraction'
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'No valid compliance items generated' },
        { status: 500 }
      )
    }

    // Bulk insert
    const { data: insertedItems, error: insertError } = await supabase
      .from('compliance_items')
      .insert(itemsToInsert)
      .select()

    if (insertError) {
      console.error('[regenerate] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Build response with generation metadata
    const sectionsGenerated = ['requirements']
    const skipped: string[] = []

    if (wbsLinksGenerated) {
      sectionsGenerated.push('wbsLinks')
    } else if (wbsElements.length === 0) {
      skipped.push('wbsLinks')
    }

    if (instructionsExtracted) {
      sectionsGenerated.push('instructions')
    } else if (instructionsSkippedReason) {
      skipped.push('instructions')
    }

    return NextResponse.json({
      items: insertedItems,
      count: insertedItems?.length || 0,
      sectionsGenerated,
      skipped,
      skipReason: instructionsSkippedReason,
    })

  } catch (error) {
    console.error('Regenerate compliance error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to regenerate matrix: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Map Section L category to proposal section
function mapCategoryToSection(category: string): string {
  const mapping: Record<string, string> = {
    format: 'Volume I, Section 1 — Executive Summary',
    content: 'Volume I, Section 2 — Technical Approach',
    submission: 'Volume I, Section 1 — Executive Summary',
    certification: 'Volume II, Section 1 — Price/Cost',
  }
  return mapping[category] || 'Other'
}
