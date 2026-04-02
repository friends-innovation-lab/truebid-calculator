import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWritingGuidePrompt } from '@/lib/writing-guide'

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
  const { sectionId, sectionTitle } = body

  if (!sectionId || !sectionTitle) {
    return NextResponse.json({ error: 'sectionId and sectionTitle required' }, { status: 400 })
  }

  // Fetch proposal data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, strategy')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    console.error('[draft-section] Proposal fetch failed:', proposalId, fetchError?.message)
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const strategy = (proposal.strategy || {}) as Record<string, unknown>
  const proposalSetup = (workingData.proposalSetup || {}) as Record<string, unknown>
  const solicitation = (workingData.solicitation || {}) as Record<string, unknown>
  interface OutlineSec { id: string; complianceRefs?: string[]; requirementRefs?: string[]; pageTarget?: number; subsections?: { number: string; title: string }[] }
  const outline = (workingData.outline || {}) as { volumes?: { sections?: OutlineSec[] }[] }

  // Find the section in the outline
  const allSections = (outline.volumes || []).flatMap(v => v.sections || [])
  const sectionData = allSections.find(s => s.id === sectionId) || null

  // Get win themes
  const winThemes = (strategy.winThemes as string[]) || []

  // Get solicitation summary
  const whatTheyWant = (solicitation.whatTheyWant as string) || (solicitation.what_they_want as string) || 'Federal IT services contract'
  const agency = (solicitation.clientAgency as string) || ''
  const contractType = (proposalSetup.contractType as string) || (proposal.contract_type as string) || 'T&M'

  // Get related requirements from working_data
  const extractedRequirements = (workingData.extractedRequirements || []) as { id: string; text?: string; description?: string; title: string; reference_number?: string }[]
  const reqRefs = sectionData?.requirementRefs || []
  const relatedReqs = extractedRequirements.filter(r => {
    const ref = r.reference_number || r.id
    return reqRefs.includes(ref)
  })

  // Get related compliance items from DB
  const complianceRefs = sectionData?.complianceRefs || []
  let relatedCompliance: { requirement_text: string; requirement_ref?: string }[] = []
  if (complianceRefs.length > 0) {
    const { data: items } = await supabase
      .from('compliance_items')
      .select('requirement_text, requirement_ref')
      .eq('proposal_id', proposalId)
    relatedCompliance = (items || []).filter(i =>
      complianceRefs.some((ref: string) => i.requirement_ref?.includes(ref))
    )
  }

  // Get related WBS elements
  const wbsElements = (workingData.estimateWbsElements || []) as { ref?: string; title: string; requirementLinks?: string[] }[]
  const relatedWbs = wbsElements.filter(el =>
    el.requirementLinks?.some(link => reqRefs.includes(link))
  )

  // Get writing guide from company settings
  const writingGuidePrompt = await getWritingGuidePrompt()
  const voiceRules = writingGuidePrompt || `Default voice rules:
- Active voice only
- Lead with customer benefit
- No filler phrases like "leverages" or "best-in-class" or "cutting-edge"
- Be specific — cite numbers and outcomes
- Professional but accessible tone`

  const setAside = (proposalSetup.setAside as string) || ''
  const solicitationNumber = (solicitation.solicitationNumber as string) || ''
  const pageTarget = sectionData?.pageTarget || 1
  const subsections = sectionData?.subsections || []

  const systemPrompt = `You are an expert government proposal writer using the Shipley method.

${voiceRules}

Additional rules:
- Write in active voice
- Every claim needs a proof point
- Weave win themes naturally — never list them
- Never use: "leverage", "robust", "best-in-class", "cutting-edge", "synergy", "holistic", "seamlessly"
- Cite specific agencies, timeframes, and measurable outcomes
- Write as if addressing the evaluator directly — they are busy, skeptical, and comparing you to 10 other offerors
- Use "FFTC" not "we" for the company name
- Format with clear paragraphs using HTML: <p>, <strong>, <ul>, <li>, <h2>
- Do not include a top-level heading — start directly with content`

  const userPrompt = `Write the "${sectionTitle}" section for this proposal.

AGENCY: ${agency}
CONTRACT TYPE: ${contractType}
SET-ASIDE: ${setAside || 'Not specified'}
SOLICITATION NUMBER: ${solicitationNumber || 'Not specified'}

WHAT THE AGENCY WANTS:
${whatTheyWant}

${relatedCompliance.length > 0 ? `WHAT THIS SECTION MUST ADDRESS (from compliance matrix):\n${relatedCompliance.map(c => `[${(c as { requirement_ref?: string }).requirement_ref || ''}] ${c.requirement_text}`).join('\n')}` : 'See requirements below.'}

${relatedReqs.length > 0 ? `SPECIFIC REQUIREMENTS TO ADDRESS:\n${relatedReqs.map(r => `[${r.reference_number || r.id}] ${r.text || r.description || r.title}`).join('\n')}` : 'No specific requirements linked.'}

${winThemes.filter(t => t?.trim()).length > 0 ? `WIN THEMES TO WEAVE IN NATURALLY (do not list them — integrate into the narrative):\n${winThemes.filter(t => t?.trim()).join('\n')}` : 'No win themes configured.'}

${relatedWbs.length > 0 ? `RELATED WORK PACKAGES FROM WBS (reference naturally where relevant):\n${relatedWbs.map(w => `${w.ref || ''}: ${w.title}`).join('\n')}` : ''}

PAGE TARGET: ${pageTarget} pages (approx ${Math.round(pageTarget * 250)} words)

${subsections.length > 0 ? `SUBSECTIONS TO STRUCTURE (use as H2 headers in your draft):\n${subsections.map(s => `${s.number} ${s.title}`).join('\n')}` : 'No subsections — write as flowing prose.'}

Write the complete section now. Do not include the section title as a heading — start with content. Use H2 headers only for subsections.`

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
          console.error('[draft-section] Stream error:', error)
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
    console.error('[draft-section] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
