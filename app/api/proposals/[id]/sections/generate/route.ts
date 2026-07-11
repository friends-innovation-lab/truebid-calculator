import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const OUTLINE_PROMPT = `You are a federal government proposal expert specializing in technical volume structure.

Given a compliance matrix mapping requirements to proposal sections, generate a hierarchical outline for the Technical Volume.

Structure guidelines:
1. Create a logical hierarchy with sections and subsections (max 3 levels deep)
2. Each section should address related compliance items grouped by theme
3. Include standard proposal sections:
   - Executive Summary
   - Technical Approach (with subsections for major requirement areas)
   - Management Approach
   - Past Performance (if relevant requirements exist)
4. Number sections like "1", "1.1", "1.2", "2", "2.1", etc.

For each section return:
{
  "section_number": "1.1",
  "title": "Section Title",
  "parent_number": "1" | null,
  "summary": "Brief description of what this section covers",
  "instructions": "Writing guidance for this section",
  "compliance_refs": ["REQ-001", "REQ-002"],
  "target_word_count": 500
}

Word count guidance:
- Executive Summary: 500-1000 words
- Major technical sections: 800-1500 words
- Subsections: 300-800 words
- Management sections: 500-1000 words

Return only a JSON array ordered by section_number. No preamble, no explanation.`

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

  // Check for regenerate flag
  let body: { regenerate?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine
  }

  try {
    // Check if sections already exist
    const { data: existingSections, error: checkError } = await supabase
      .from('proposal_sections')
      .select('id')
      .eq('proposal_id', id)
      .limit(1)

    if (checkError) {
      console.error('[generate sections] Check error:', checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existingSections && existingSections.length > 0 && !body.regenerate) {
      return NextResponse.json(
        { error: 'Outline already exists. Set regenerate=true to replace.' },
        { status: 409 }
      )
    }

    // If regenerating, delete existing sections first
    if (body.regenerate && existingSections && existingSections.length > 0) {
      const { error: deleteError } = await supabase
        .from('proposal_sections')
        .delete()
        .eq('proposal_id', id)

      if (deleteError) {
        console.error('[generate sections] Delete error:', deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    }

    // Fetch compliance matrix items
    const { data: complianceItems, error: compError } = await supabase
      .from('compliance_items')
      .select('*')
      .eq('proposal_id', id)
      .order('proposal_section', { ascending: true })

    if (compError) {
      console.error('[generate sections] Compliance fetch error:', compError)
      return NextResponse.json({ error: compError.message }, { status: 500 })
    }

    if (!complianceItems || complianceItems.length === 0) {
      return NextResponse.json(
        { error: 'No compliance matrix found. Generate compliance matrix first.' },
        { status: 400 }
      )
    }

    // Fetch proposal info for context
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('title, working_data')
      .eq('id', id)
      .single()

    if (propError) {
      console.error('[generate sections] Proposal fetch error:', propError)
    }

    const proposalTitle = proposal?.title || 'Untitled Proposal'
    const workingData = proposal?.working_data || {}
    const solicitationTitle = (workingData as Record<string, unknown>).solicitationTitle || ''

    // Format compliance items for the prompt
    const complianceForPrompt = complianceItems.map(item => ({
      ref: item.requirement_ref || 'N/A',
      text: (item.requirement_text || '').substring(0, 300),
      section: item.proposal_section || 'Unassigned',
      status: item.compliance_status,
      source: item.source || 'requirement',
    }))

    // Group by section for better AI understanding
    const groupedCompliance = complianceForPrompt.reduce((acc, item) => {
      const section = item.section
      if (!acc[section]) acc[section] = []
      acc[section].push(item)
      return acc
    }, {} as Record<string, typeof complianceForPrompt>)

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const contextInfo = `Proposal: ${proposalTitle}${solicitationTitle ? ` for ${solicitationTitle}` : ''}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `${OUTLINE_PROMPT}\n\n${contextInfo}\n\nCompliance Matrix by Section:\n${JSON.stringify(groupedCompliance, null, 2)}`
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
    let parsedSections
    try {
      const cleanedResponse = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const jsonStart = cleanedResponse.indexOf('[')
      const jsonEnd = cleanedResponse.lastIndexOf(']')

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON array found in response')
      }

      const jsonString = cleanedResponse.slice(jsonStart, jsonEnd + 1)
      parsedSections = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      console.error('Parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    console.log('[generate sections] Parsed sections count:', parsedSections?.length)

    // Build section number to ID map for parent_id resolution
    const sectionMap = new Map<string, string>()
    interface SectionInsert {
      id: string
      proposal_id: string
      section_number: string
      title: string
      summary: string | null
      instructions: string | null
      compliance_item_ids: string[]
      requirement_refs: string[]
      target_word_count: number | null
      status: string
      sort_order: number
      ai_generated: boolean
      parent_id: string | null
    }
    const sectionsToInsert: SectionInsert[] = []

    // First pass: create all sections with temporary IDs
    for (let i = 0; i < parsedSections.length; i++) {
      const section = parsedSections[i]
      const tempId = crypto.randomUUID()
      sectionMap.set(section.section_number, tempId)

      // Find compliance item IDs that match the refs
      const complianceIds = complianceItems
        .filter(ci => section.compliance_refs?.includes(ci.requirement_ref))
        .map(ci => ci.id)

      sectionsToInsert.push({
        id: tempId,
        proposal_id: id,
        section_number: section.section_number,
        title: section.title,
        summary: section.summary || null,
        instructions: section.instructions || null,
        compliance_item_ids: complianceIds,
        requirement_refs: section.compliance_refs || [],
        target_word_count: section.target_word_count || null,
        status: 'draft',
        sort_order: i,
        ai_generated: true,
        parent_id: null, // Will be resolved in second pass
      })
    }

    // Second pass: resolve parent_id references
    for (const section of sectionsToInsert) {
      const originalSection = parsedSections.find(
        (s: { section_number: string }) => s.section_number === section.section_number
      )
      if (originalSection?.parent_number && sectionMap.has(originalSection.parent_number)) {
        section.parent_id = sectionMap.get(originalSection.parent_number) ?? null
      }
    }

    // Insert all sections
    const { data: insertedSections, error: insertError } = await supabase
      .from('proposal_sections')
      .insert(sectionsToInsert)
      .select()

    if (insertError) {
      console.error('[generate sections] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Transform for response
    const transformedSections = (insertedSections || []).map(s => ({
      id: s.id,
      proposalId: s.proposal_id,
      parentId: s.parent_id,
      sortOrder: s.sort_order,
      sectionNumber: s.section_number,
      title: s.title,
      summary: s.summary,
      instructions: s.instructions,
      complianceItemIds: s.compliance_item_ids,
      requirementRefs: s.requirement_refs,
      status: s.status,
      targetWordCount: s.target_word_count,
      actualWordCount: s.actual_word_count,
      owner: s.owner,
      notes: s.notes,
      aiGenerated: s.ai_generated,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }))

    return NextResponse.json({
      sections: transformedSections,
      count: transformedSections.length,
      regenerated: body.regenerate || false,
    })

  } catch (error) {
    console.error('Generate sections error:', error)

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
      { error: `Failed to generate outline: ${errorMessage}` },
      { status: 500 }
    )
  }
}
