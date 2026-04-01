import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// Schema for AI summary response
const aiSummarySchema = z.object({
  problem_statement: z.string(),
  what_they_want: z.string(),
  why_it_matters: z.string(),
  key_challenges: z.array(z.string()),
  evaluation_emphasis: z.string(),
})

const SUMMARY_PROMPT = `You are a government proposal expert helping a small business understand a federal solicitation. Generate a detailed plain-language summary of this RFP. Return ONLY valid JSON with exactly these fields:

{
  "problem_statement": "3-5 sentence paragraph. Describe the full scope of what's being procured — the system, its purpose, key capabilities required, who will use it, and the operational context. Be specific about scale, integrations, and technical environment. Do not summarize in one sentence.",

  "what_they_want": "3-5 sentence paragraph. What does the government want the contractor to actually deliver? Focus on outcomes, deliverables, and operational expectations. Mention specific systems, platforms, or capabilities referenced in the SOW.",

  "why_it_matters": "2-4 sentence paragraph. Explain the mission impact and strategic importance of this contract. What happens if this isn't done well? Who is affected and how? Why is the government prioritizing this now?",

  "key_challenges": ["5-8 specific technical or operational challenges this contract presents. Each item should be a distinct, specific challenge — not generic. Examples: security clearance requirements, legacy system migration, multi-timezone operations, FedRAMP authorization, integration with existing agency systems, Section 508 accessibility compliance."],

  "evaluation_emphasis": "2-4 sentence paragraph. Based on Section M and the overall solicitation tone, what does the government actually care most about? What type of offeror are they trying to attract? What will differentiate winning proposals from losing ones?"
}

Be substantive. A proposal manager reading this summary should understand the full scope and context of the opportunity without reading the original RFP. Thin one-sentence summaries are not acceptable. Return only valid JSON, no other text.`

const RELEVANCE_PROMPT = `Given these win themes:
{WIN_THEMES}

And this opportunity:
{OPPORTUNITY}

In 2-3 sentences, explain specifically why this company is well-positioned for this work and which win theme is strongest for this opportunity.

Return only the relevance statement as plain text.`

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

  try {
    // Fetch the proposal with its working data and strategy
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*, working_data, strategy')
      .eq('id', id)
      .single()

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }

    // Accept inline data from request body (avoids race with debounced DB sync)
    let bodyData: {
      rfpText?: string
      solicitation?: Record<string, unknown>
      requirements?: Array<{ text?: string; title?: string; type?: string; sourceSection?: string }>
    } = {}
    try {
      const contentType = request.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        bodyData = await request.json()
      }
    } catch {
      // No body or invalid JSON — fall back to DB
    }

    // Get the working data which contains the solicitation info and extracted requirements
    const workingData = proposal.working_data || {}
    const strategy = proposal.strategy || {}

    // Prefer rfpText (raw PDF text) for richer context, fall back to structured data
    const rfpText = bodyData.rfpText || (workingData as Record<string, unknown>).rfpText as string || ''

    let documentContext: string

    if (rfpText && rfpText.length >= 100) {
      // Use raw PDF text directly — has more context than structured extraction
      documentContext = rfpText
      console.log('[generate-summary] Using rfpText directly:', rfpText.length, 'chars')
    } else {
      // Fall back to structured data
      const solicitation = bodyData.solicitation || (workingData as Record<string, unknown>).solicitation || {}
      const requirements = bodyData.requirements || (workingData as Record<string, unknown>).extractedRequirements || []
      documentContext = buildDocumentContext(solicitation as Record<string, unknown>, requirements as Array<{ text?: string; title?: string; type?: string; sourceSection?: string }>)
      console.log('[generate-summary] Using structured context:', documentContext.length, 'chars')
    }

    if (!documentContext || documentContext.length < 100) {
      return NextResponse.json(
        { error: `Not enough document content (${documentContext.length} chars). Please upload and analyze an RFP first.` },
        { status: 400 }
      )
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Generate the main summary
    const summaryResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${SUMMARY_PROMPT}\n\nDocument to analyze:\n\n${documentContext}`
        }
      ],
    })

    const summaryText = summaryResponse.content[0].type === 'text'
      ? summaryResponse.content[0].text
      : ''

    if (!summaryText) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedSummary
    try {
      const jsonStart = summaryText.indexOf('{')
      const jsonEnd = summaryText.lastIndexOf('}')

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in response')
      }

      const jsonString = summaryText.slice(jsonStart, jsonEnd + 1)
      parsedSummary = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI summary response:', summaryText.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Validate with Zod
    const validated = aiSummarySchema.safeParse(parsedSummary)
    if (!validated.success) {
      console.error('AI summary validation failed:', validated.error.issues)
      return NextResponse.json(
        { error: 'AI returned invalid summary structure' },
        { status: 500 }
      )
    }

    // Generate FFTC relevance if win themes exist
    let fftcRelevance: string | null = null
    const winThemes = strategy.winThemes?.filter((t: string) => t?.trim()) || []

    if (winThemes.length > 0) {
      try {
        const relevancePrompt = RELEVANCE_PROMPT
          .replace('{WIN_THEMES}', winThemes.join('\n- '))
          .replace('{OPPORTUNITY}', `${validated.data.problem_statement}\n\n${validated.data.what_they_want}`)

        const relevanceResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: relevancePrompt
            }
          ],
        })

        fftcRelevance = relevanceResponse.content[0].type === 'text'
          ? relevanceResponse.content[0].text.trim()
          : null
      } catch (relevanceError) {
        console.warn('Failed to generate FFTC relevance:', relevanceError)
        // Continue without relevance — not a fatal error
      }
    }

    // Build the final summary object
    const aiSummary = {
      generated_at: new Date().toISOString(),
      problem_statement: validated.data.problem_statement,
      what_they_want: validated.data.what_they_want,
      why_it_matters: validated.data.why_it_matters,
      key_challenges: validated.data.key_challenges,
      evaluation_emphasis: validated.data.evaluation_emphasis,
      fftc_relevance: fftcRelevance,
      win_themes_at_generation: winThemes,
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        ai_summary: aiSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to save AI summary:', updateError)
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary: aiSummary })

  } catch (error) {
    console.error('Generate summary error:', error)

    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message)
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'Invalid Anthropic API key' },
          { status: 500 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 500 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Non-Anthropic error:', errorMessage)
    return NextResponse.json(
      { error: `Failed to generate summary: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Helper to build document context from solicitation and requirements
function buildDocumentContext(
  solicitation: Record<string, unknown>,
  requirements: Array<{ text?: string; title?: string; type?: string; sourceSection?: string }>
): string {
  const parts: string[] = []

  // Add solicitation metadata
  if (solicitation.title) {
    parts.push(`Title: ${solicitation.title}`)
  }
  if (solicitation.clientAgency) {
    parts.push(`Agency: ${solicitation.clientAgency}`)
  }
  if (solicitation.solicitationNumber) {
    parts.push(`Solicitation Number: ${solicitation.solicitationNumber}`)
  }
  if (solicitation.contractType) {
    parts.push(`Contract Type: ${solicitation.contractType}`)
  }
  if (solicitation.naicsCode) {
    parts.push(`NAICS Code: ${solicitation.naicsCode}`)
  }

  parts.push('\n--- EXTRACTED REQUIREMENTS ---\n')

  // Group requirements by type
  const grouped: Record<string, typeof requirements> = {}
  for (const req of requirements) {
    const type = req.type || 'other'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(req)
  }

  for (const [type, reqs] of Object.entries(grouped)) {
    parts.push(`\n[${type.toUpperCase()}]`)
    for (const req of reqs) {
      const section = req.sourceSection ? ` (${req.sourceSection})` : ''
      parts.push(`- ${req.title || 'Requirement'}${section}: ${req.text || ''}`)
    }
  }

  return parts.join('\n')
}
