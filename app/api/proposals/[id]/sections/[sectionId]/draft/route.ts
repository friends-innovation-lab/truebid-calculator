import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface TipTapContent {
  type: string
  content?: TipTapContent[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

// POST - Generate AI draft for a section
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, sectionId } = await params

  // Fetch section details
  const { data: section, error: sectionError } = await supabase
    .from('proposal_sections')
    .select('*')
    .eq('id', sectionId)
    .single()

  if (sectionError || !section) {
    return NextResponse.json(
      { error: 'Section not found' },
      { status: 404 }
    )
  }

  // Fetch proposal for context
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('title, client, agency, contract_type')
    .eq('id', proposalId)
    .single()

  if (proposalError) {
    console.error('[Draft API] Failed to fetch proposal:', proposalError)
  }

  // Fetch related compliance items if available
  let complianceContext = ''
  if (section.compliance_item_ids && section.compliance_item_ids.length > 0) {
    const { data: complianceItems } = await supabase
      .from('compliance_items')
      .select('reference_number, requirement_type, text, source')
      .in('id', section.compliance_item_ids)

    if (complianceItems && complianceItems.length > 0) {
      complianceContext = `
LINKED COMPLIANCE REQUIREMENTS:
${complianceItems.map(item =>
  `- ${item.reference_number} (${item.requirement_type}): ${item.text}`
).join('\n')}
`
    }
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    // Return mock data for testing
    const mockContent = createTipTapDocument([
      { type: 'heading', level: 2, text: section.title },
      { type: 'paragraph', text: `This is a draft for the "${section.title}" section.` },
      { type: 'paragraph', text: section.summary || 'Add your content here based on the section requirements.' },
      { type: 'paragraph', text: '[AI draft generation requires ANTHROPIC_API_KEY]' },
    ])

    return NextResponse.json({
      content: mockContent,
      contentText: `${section.title}\n\nThis is a draft for the "${section.title}" section.\n\n${section.summary || 'Add your content here based on the section requirements.'}\n\n[AI draft generation requires ANTHROPIC_API_KEY]`,
      mock: true,
    })
  }

  // Build the prompt
  const systemPrompt = `You are an expert government contracting proposal writer. Your task is to write technical proposal content that:

1. Is professional and persuasive
2. Uses active voice and specific, quantifiable claims where possible
3. Addresses requirements directly with clear compliance statements
4. Includes appropriate headings and structure
5. Maintains a confident but not arrogant tone
6. Is compliant with government solicitation requirements

PROPOSAL CONTEXT:
- Title: ${proposal?.title || 'Government Contract Proposal'}
- Agency: ${proposal?.agency || proposal?.client || 'Federal Agency'}
- Contract Type: ${proposal?.contract_type || 'FFP'}

WRITING GUIDELINES:
- Use "shall" when describing firm commitments
- Use "will" when describing planned activities
- Avoid passive voice where possible
- Be specific and measurable
- Include action verbs for deliverables
- Reference compliance with requirements when applicable
- Target word count: ${section.target_word_count || 500} words

OUTPUT FORMAT:
Respond with ONLY the prose content in plain text. Use markdown-style headings with ## for H2 and ### for H3.
Do NOT include JSON or code blocks - just write the proposal content directly.
Start with a compelling opening paragraph, then use appropriate subheadings to organize the content.`

  const userPrompt = `Write the proposal content for this section:

SECTION: ${section.section_number ? `${section.section_number} - ` : ''}${section.title}

${section.summary ? `SECTION SUMMARY: ${section.summary}` : ''}
${section.instructions ? `WRITING INSTRUCTIONS: ${section.instructions}` : ''}
${complianceContext}

Target word count: ${section.target_word_count || 500} words

Write the proposal content now. Remember to use ## for main headings and ### for subheadings.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    })

    // Extract text response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Convert markdown-ish response to TipTap JSON
    const tipTapContent = markdownToTipTap(responseText)

    return NextResponse.json({
      content: tipTapContent,
      contentText: responseText,
      usage: {
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens,
      },
    })

  } catch (error) {
    console.error('[Draft API] Error generating draft:', error)

    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; message?: string }
      return NextResponse.json(
        { error: `AI error: ${apiError.message || 'Unknown'}` },
        { status: apiError.status }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper to create TipTap document from simple content
function createTipTapDocument(blocks: Array<{
  type: 'heading' | 'paragraph'
  level?: number
  text: string
}>): TipTapContent {
  return {
    type: 'doc',
    content: blocks.map(block => {
      if (block.type === 'heading') {
        return {
          type: 'heading',
          attrs: { level: block.level || 2 },
          content: [{ type: 'text', text: block.text }],
        }
      }
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: block.text }],
      }
    }),
  }
}

// Convert markdown-like text to TipTap JSON
function markdownToTipTap(text: string): TipTapContent {
  const content: TipTapContent[] = []
  let currentList: TipTapContent | null = null
  let currentListType: 'bulletList' | 'orderedList' | null = null

  // Split by double newlines to preserve paragraph breaks
  const paragraphs = text.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    // Check if this paragraph contains list items or headings
    const lines = trimmedParagraph.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Heading 2
      if (trimmedLine.startsWith('## ')) {
        if (currentList) {
          content.push(currentList)
          currentList = null
          currentListType = null
        }
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: trimmedLine.slice(3) }],
        })
        continue
      }

      // Heading 3
      if (trimmedLine.startsWith('### ')) {
        if (currentList) {
          content.push(currentList)
          currentList = null
          currentListType = null
        }
        content.push({
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: trimmedLine.slice(4) }],
        })
        continue
      }

      // Bullet list item
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (currentListType !== 'bulletList') {
          if (currentList) content.push(currentList)
          currentList = { type: 'bulletList', content: [] }
          currentListType = 'bulletList'
        }
        if (currentList && currentList.content) {
          currentList.content.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseInlineFormatting(trimmedLine.slice(2)),
            }],
          })
        }
        continue
      }

      // Numbered list item
      const numberedMatch = trimmedLine.match(/^\d+\.\s+(.*)$/)
      if (numberedMatch) {
        if (currentListType !== 'orderedList') {
          if (currentList) content.push(currentList)
          currentList = { type: 'orderedList', content: [] }
          currentListType = 'orderedList'
        }
        if (currentList && currentList.content) {
          currentList.content.push({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseInlineFormatting(numberedMatch[1]),
            }],
          })
        }
        continue
      }

      // Regular text line - close any list first
      if (currentList) {
        content.push(currentList)
        currentList = null
        currentListType = null
      }

      // Add as paragraph
      content.push({
        type: 'paragraph',
        content: parseInlineFormatting(trimmedLine),
      })
    }

    // Close any list at end of paragraph block
    if (currentList) {
      content.push(currentList)
      currentList = null
      currentListType = null
    }
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  }
}

// Parse inline formatting (bold, italic) - simplified version
function parseInlineFormatting(text: string): TipTapContent[] {
  // For simplicity, strip markdown formatting and return plain text
  // Full inline parsing would require more complex state machine
  const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '')
  if (cleanText.trim()) {
    return [{ type: 'text', text: cleanText }]
  }
  return [{ type: 'text', text: '' }]
}
