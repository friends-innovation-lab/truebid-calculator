import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWritingGuidePrompt } from '@/lib/writing-guide'

interface PastPerformanceEntry {
  id: string
  title: string
  agency: string
  contractNumber: string
  periodOfPerformance: string
  contractValue: string
  scope: string
  outcomes: string[]
  status: 'active' | 'complete'
}

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
  const body = await request.json()
  const { sectionId, sectionTitle, subsectionId, subsectionNumber, subsectionTitle, pageTarget } = body

  if (!sectionId || !subsectionId || !subsectionTitle) {
    return NextResponse.json({ error: 'sectionId, subsectionId, and subsectionTitle required' }, { status: 400 })
  }

  console.log('[draft-subsection] Starting:', { sectionId, subsectionId, subsectionNumber, subsectionTitle, pageTarget })

  // Fetch proposal data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, strategy, company_id')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    console.error('[draft-subsection] Proposal fetch failed:', proposalId, fetchError?.message)
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const strategy = (proposal.strategy || {}) as Record<string, unknown>
  const proposalSetup = (workingData.proposalSetup || {}) as Record<string, unknown>
  const solicitation = (workingData.solicitation || {}) as Record<string, unknown>

  // Get solicitation context
  const whatTheyWant = (solicitation.whatTheyWant as string) || (solicitation.what_they_want as string) || 'Federal IT services contract'
  const agency = (solicitation.clientAgency as string) || ''

  // Get win themes
  const proposalWinThemes = (strategy.winThemes as string[]) || []

  // Get company settings
  const companyId = proposal.company_id as string | null
  let contentLibrary: { pastPerformance?: PastPerformanceEntry[] } = {}
  if (companyId) {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('content_library')
      .eq('company_id', companyId)
      .single()
    contentLibrary = (settings?.content_library || {}) as typeof contentLibrary
  }

  // Get past performance
  const pastPerformance = contentLibrary.pastPerformance || []
  const relevantPP = pastPerformance
    .filter(pp => pp.status === 'active' || pp.status === 'complete')
    .slice(0, 3)

  // Get writing guide
  const writingGuide = await getWritingGuidePrompt(companyId || undefined)

  // Calculate target word count
  const wordsPerPage = (proposalSetup.wordsPerPage as number) || 392
  const targetWordCount = Math.round((pageTarget || 1) * wordsPerPage)

  const systemPrompt = `You are writing ONE subsection of a government proposal on behalf of Friends From The City.

${writingGuide || ''}

RULES:
- Write ONLY the specified subsection — nothing else
- Start with the H2 heading using the exact number and title provided
- Use HTML tags: <h2>, <p>, <strong>, <ul>, <li>
- Do NOT use markdown syntax like ## — use <h2> tags only
- Fill the word target completely
- Follow Challenge-Approach-Results structure within paragraphs
- "Friends From The City" on first reference, "Friends" thereafter
- Never use "FFTC"
- Never invent past performance not provided

ANTI-HALLUCINATION:
Only cite past performance explicitly listed in this prompt. Never invent projects, agencies, contract numbers, outcomes, or numbers.`

  const userPrompt = `Write ONLY the "${subsectionNumber} ${subsectionTitle}" subsection.

This is one subsection within the larger "${sectionTitle}" section. Do not write any other subsections. Do not write the parent section title.

AGENCY CONTEXT:
${agency ? `Agency: ${agency}` : ''}
${whatTheyWant}

${proposalWinThemes.length > 0 ? `WIN THEMES TO WEAVE IN:
${proposalWinThemes.filter(t => t?.trim()).map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}
${relevantPP.length > 0 ? `PAST PERFORMANCE TO DRAW FROM:
${relevantPP.map(pp => `PROJECT: ${pp.title}
AGENCY: ${pp.agency}
OUTCOMES: ${pp.outcomes?.slice(0, 2).join('; ')}`).join('\n---\n')}
` : ''}
START YOUR OUTPUT WITH THIS EXACT HEADING:
<h2>${subsectionNumber} ${subsectionTitle}</h2>

Then write ${targetWordCount} words of substantive content for this subsection only.

PARAGRAPH STRUCTURE:
- Open with the agency's specific need for this topic
- This subsection is part of a larger argument already established in the parent section
- Do not restate the overall section problem — connect to the argument, do not restart it
- Write 3-5 paragraphs of substantive content
- Each paragraph should be 100-150 words

Write exactly one subsection. Fill the word target completely.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Convert to SSE stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
              const data = JSON.stringify({ type: 'content_block_delta', delta: { text: event.delta.text } })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('[draft-subsection] Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('[draft-subsection] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
