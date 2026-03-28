import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const confirmSchema = z.object({
  confirm: z.literal(true),
})

const complianceItemSchema = z.object({
  requirement_id: z.string().optional(),
  requirement_text: z.string(),
  requirement_ref: z.string(),
  proposal_section: z.string(),
  compliance_status: z.enum(['compliant', 'partial', 'exception']),
  notes: z.string(),
})

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
  "requirement_id": "original ID if provided",
  "requirement_text": "the requirement text",
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

    // Format requirements for the prompt
    const requirementsText = requirements.map((req, index) => {
      const ref = req.requirement_ref || req.id || `REQ-${String(index + 1).padStart(3, '0')}`
      return `[${ref}] ${req.text || req.requirement_text || ''}`
    }).join('\n')

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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

    // Parse the JSON response
    let parsedItems
    try {
      const jsonStart = responseText.indexOf('[')
      const jsonEnd = responseText.lastIndexOf(']')

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON array found in response')
      }

      const jsonString = responseText.slice(jsonStart, jsonEnd + 1)
      parsedItems = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Validate and prepare items for insertion
    const itemsToInsert = []
    for (const item of parsedItems) {
      const validated = complianceItemSchema.safeParse(item)
      if (validated.success) {
        // Find matching requirement ID if possible
        const matchingReq = requirements.find(r =>
          r.id === item.requirement_id ||
          r.requirement_ref === item.requirement_ref
        )

        itemsToInsert.push({
          proposal_id: id,
          requirement_id: matchingReq?.id || null,
          requirement_text: validated.data.requirement_text,
          requirement_ref: validated.data.requirement_ref,
          proposal_section: validated.data.proposal_section,
          compliance_status: validated.data.compliance_status,
          notes: validated.data.notes,
        })
      }
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

    return NextResponse.json({
      items: insertedItems,
      count: insertedItems?.length || 0,
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
