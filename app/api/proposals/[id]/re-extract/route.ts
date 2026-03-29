import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'

// Dynamic ceiling based on page count
const getRequirementsCeiling = (pageCount: number): number => {
  if (pageCount <= 15) return 20   // Simple task order
  if (pageCount <= 30) return 30   // Medium RFP
  if (pageCount <= 60) return 40   // Standard RFP (e.g., CAMP = 49 pages)
  if (pageCount <= 100) return 55  // Large RFP
  return 70                         // Very large full RFP
}

// System prompt for extraction
const EXTRACTION_SYSTEM_PROMPT = (ceiling: number) => `You are a senior proposal manager at a government contracting firm. Your job is to extract only the requirements that directly affect how the proposal is written and evaluated.

Think like someone who has to write a response to this RFP. What are the distinct things you need to address, prove, or comply with? Extract those — nothing else.

STRICT RULES:
1. Maximum ${ceiling} requirements total
2. Each requirement must be meaningfully distinct — no overlaps, no sub-clauses of another requirement
3. Consolidate related items — if there are 5 bullets about security, that is ONE requirement: the security requirement
4. Skip entirely:
   - FAR/DFAR boilerplate clauses
   - Payment, invoicing, reporting admin
   - Any requirement already captured in another item
   - General statements of work that don't add a distinct compliance obligation
5. Ask yourself: 'If I missed this, would the proposal be non-compliant or score lower?' If no — skip it.

Target: 15–${ceiling} requirements. If you are finding more, you are being too granular. Consolidate.`

const EXTRACTION_USER_PROMPT = (ceiling: number, pageCount: number) => `Extract the key proposal requirements from this RFP. Be selective — aim for 15 to ${ceiling} total requirements maximum for a ${pageCount}-page RFP.

If you return more than ${ceiling} items, start over and consolidate further.

Return ONLY a valid JSON array, no other text:

[
  {
    "id": "REQ-001",
    "title": "3-6 word title",
    "text": "Full consolidated requirement text",
    "type": "shall",
    "sourceSection": "Section C · p.12"
  }
]

REQUIREMENT NUMBERING:
- REQ-001, REQ-002... for technical and performance requirements (Section C, H etc.)
- L.1, L.2... for Section L submission and formatting instructions
- M.1, M.2... for Section M evaluation criteria

TYPE VALUES:
- 'shall' — mandatory requirement
- 'should' — preferred/desired
- 'instruction' — Section L formatting rule
- 'evaluation' — Section M eval factor

SOURCE FORMAT: 'Section [LETTER] · p.[N]'
Use section letter, not heading name. Examples: 'Section C · p.8', 'Section L · p.31'

If you find more than ${ceiling} requirements, consolidate further until you are at ${ceiling} or fewer.`

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Get proposal with working_data
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, working_data')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = proposal.working_data || {}
  const pdfUrl = workingData.pdfUrl

  if (!pdfUrl) {
    return NextResponse.json({ error: 'No PDF stored for this proposal' }, { status: 400 })
  }

  try {
    // Fetch the PDF
    console.log('[re-extract] Fetching PDF from:', pdfUrl)
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`)
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfUint8 = new Uint8Array(pdfBuffer)

    // Extract text
    const { text: pdfText, totalPages: pdfPageCount } = await extractText(pdfUint8, { mergePages: true })
    console.log(`[re-extract] PDF has ${pdfPageCount} pages, text length: ${pdfText.length}`)

    if (pdfText.length < 100) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 })
    }

    // Calculate dynamic ceiling based on page count
    const ceiling = getRequirementsCeiling(pdfPageCount)
    console.log(`[re-extract] Requirements ceiling: ${ceiling} (for ${pdfPageCount} pages)`)

    // Truncate if needed
    const MAX_CHARS = 150000
    const truncatedText = pdfText.length > MAX_CHARS
      ? pdfText.substring(0, MAX_CHARS) + '\n\n[Document truncated...]'
      : pdfText

    // Call Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT(ceiling),
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_USER_PROMPT(ceiling, pdfPageCount)}\n\nDocument:\n\n${truncatedText}`
        }
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON array
    const jsonStart = responseText.indexOf('[')
    const jsonEnd = responseText.lastIndexOf(']')

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('[re-extract] No JSON array found:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'AI did not return valid JSON array' }, { status: 500 })
    }

    const requirements = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1))
    console.log('[re-extract] Extracted requirements:', requirements.length)

    // Guard rail: dynamic ceiling based on page count
    if (requirements.length > ceiling) {
      console.error(`[re-extract] Too many requirements: ${requirements.length} (ceiling: ${ceiling} for ${pdfPageCount} pages)`)
      return NextResponse.json({
        error: `Extraction returned ${requirements.length} requirements. Maximum for a ${pdfPageCount}-page RFP is ${ceiling}. Consolidate further.`
      }, { status: 400 })
    }

    // Delete existing requirements
    const { error: deleteError } = await supabase
      .from('requirements')
      .delete()
      .eq('proposal_id', proposalId)

    if (deleteError) {
      console.error('[re-extract] Delete error:', deleteError)
    }

    // Insert new requirements
    const insertData = requirements.map((req: { id?: string; title?: string; text?: string; type?: string; sourceSection?: string }) => ({
      proposal_id: proposalId,
      reference_number: req.id || '',
      title: req.title || '',
      description: req.text || '',
      source: req.sourceSection || '',
      type: req.type || 'shall',
      status: 'unaddressed',
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('requirements')
      .insert(insertData)
      .select()

    if (insertError) {
      console.error('[re-extract] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save requirements' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: inserted?.length || 0,
      requirements: inserted,
    })

  } catch (error) {
    console.error('[re-extract] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Re-extraction failed'
    }, { status: 500 })
  }
}
