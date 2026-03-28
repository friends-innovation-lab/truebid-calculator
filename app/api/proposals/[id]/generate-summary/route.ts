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

const SUMMARY_PROMPT = `You are a government proposal expert helping a small business understand a federal solicitation. Analyze the provided RFP document and return a JSON object with exactly these fields:

- problem_statement: In 2-3 sentences, what problem is the government trying to solve? Write this as if explaining to someone who has never seen the RFP.

- what_they_want: In 3-4 sentences, what does the government want the contractor to actually do? Focus on outcomes, not technical requirements.

- why_it_matters: In 1-2 sentences, why does this work matter to the agency's mission?

- key_challenges: An array of 3-5 short strings identifying the hardest parts of this contract — technical complexity, coordination requirements, compliance challenges, or delivery risks.

- evaluation_emphasis: In 2-3 sentences, based on the evaluation criteria and their weights, what does the government care most about when selecting a contractor?

Return only valid JSON. No preamble, no explanation.`

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

    // Get the working data which contains the solicitation info and extracted requirements
    const workingData = proposal.working_data || {}
    const solicitation = workingData.solicitation || {}
    const requirements = workingData.extractedRequirements || []
    const strategy = proposal.strategy || {}

    // Build context from solicitation and requirements
    const documentContext = buildDocumentContext(solicitation, requirements)

    if (!documentContext || documentContext.length < 100) {
      return NextResponse.json(
        { error: 'Not enough document content. Please upload and analyze an RFP first.' },
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
      max_tokens: 2048,
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
    }

    return NextResponse.json(
      { error: 'Failed to generate summary' },
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
