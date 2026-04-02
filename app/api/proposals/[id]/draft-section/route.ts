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

interface StandardApproachEntry {
  category: string
  title: string
  body: string
  tags?: string[]
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

  // Get company settings (writing guide, content library)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  console.log('[draft-section] Company lookup:', company?.id || 'NOT FOUND', companyError?.message || '')

  interface WinThemeEntry {
    theme: string
    discriminatorStatement?: string
  }
  let contentLibrary: { pastPerformance?: PastPerformanceEntry[]; standardApproaches?: StandardApproachEntry[]; winThemes?: WinThemeEntry[] } = {}
  if (company) {
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('content_library, writing_guide')
      .eq('company_id', company.id)
      .single()
    console.log('[draft-section] Settings loaded:', {
      hasContentLibrary: !!settings?.content_library,
      hasWritingGuide: !!settings?.writing_guide,
      pastPerformanceCount: (settings?.content_library as Record<string, unknown>)?.pastPerformance ? ((settings?.content_library as Record<string, unknown>).pastPerformance as unknown[]).length : 0,
      error: settingsError?.message
    })
    contentLibrary = (settings?.content_library || {}) as typeof contentLibrary
  }

  // GLOBAL win themes — from content library
  const globalWinThemes = contentLibrary.winThemes || []

  // PROPOSAL-SPECIFIC win themes — from strategy
  const proposalWinThemes = (strategy.winThemes as string[]) || []
  const hasProposalThemes = proposalWinThemes.filter(t => t?.trim()).length > 0

  // Get past performance entries
  const pastPerformance = contentLibrary.pastPerformance || []
  const relevantPP = pastPerformance
    .filter(pp => pp.status === 'active' || pp.status === 'complete')
    .slice(0, 5) // Top 5 only

  // Get standard approaches relevant to this section
  const standardApproaches = contentLibrary.standardApproaches || []
  const sectionTitleLower = sectionTitle.toLowerCase()
  const relevantApproaches = standardApproaches.filter(sa =>
    sectionTitleLower.includes(sa.category || '') ||
    sa.tags?.some(tag => sectionTitleLower.includes(tag.toLowerCase()))
  )

  // Get writing guide from company settings
  const writingGuide = await getWritingGuidePrompt()
  console.log('[draft-section] Writing guide loaded:', writingGuide ? writingGuide.slice(0, 100) : 'NULL — not loading')

  const setAside = (proposalSetup.setAside as string) || ''
  const solicitationNumber = (solicitation.solicitationNumber as string) || ''
  const pageTarget = sectionData?.pageTarget || 1
  const subsections = sectionData?.subsections || []
  const wordsPerPage = (proposalSetup.wordsPerPage as number) || 500
  const targetWordCount = pageTarget * wordsPerPage

  const systemPrompt = `You are writing a government proposal section for Friends From The City (FFTC).

FFTC VOICE — FOLLOW THIS EXACTLY:
${writingGuide || `
Write with the confidence of a practitioner, not the caution of a contractor. Be specific. Cite the agency, the outcome, the number. Trust the evaluator to draw conclusions without being told what to think.

Every paragraph must fully develop one idea. Introduce the idea, explain the reasoning or methodology, ground it in specific evidence or a real outcome from FFTC's work, and connect it to what the evaluator cares about. No paragraph should be fewer than four sentences unless it opens or closes a section.

Write sentences the way FFTC writes its case studies: declarative, grounded, direct. Short sentences are acceptable when they carry weight. Long sentences are acceptable when they connect ideas. Choppy fragments are never acceptable.
`}

WORDS YOU MUST NEVER USE:
leverage, leveraging, leverages, robust, best-in-class, cutting-edge, synergy, synergistic, holistic, seamlessly, world-class, innovative, innovation (unless quoting an RFP), deep dive, deep expertise, deeply, transformative, empower, impactful, utilize, spearhead, game-changing, state-of-the-art, best practices (unless citing a specific standard)

If you find yourself writing any of these words, stop and rewrite the sentence with a specific claim instead.

BULLETS AND NUMBERED LISTS:
Bullets are permitted only when presenting three or more parallel items that would be genuinely awkward in continuous prose — for example, a list of deliverables, technical specifications, or team roles. A bulleted list must never be used to avoid writing a paragraph. Numbered lists are for sequential processes only. If a section has more bullets than paragraphs it has failed. Default to prose. Use structure only when it is clearer than prose.

PAGE TARGET:
Write a complete draft that fills the target word count. Do not write a minimum viable response. Every section target represents the evaluator's expectation of how much substance this topic deserves.

PAST PERFORMANCE:
Only cite projects listed in the user prompt. Never invent contract numbers, agencies, or outcomes. When referencing past performance, always include the agency name and at least one specific, verifiable outcome — not just the project name.

FORMAT:
Use HTML tags: <p>, <strong>, <ul>, <li>, <h2>. Do not include the section title as a heading — start directly with content. Use H2 headings only for subsections.`

  const userPrompt = `Write the "${sectionTitle}" section for this proposal.

CONTRACT DETAILS:
Agency: ${agency}
Contract type: ${contractType}
Set-aside: ${setAside || 'Not specified'}
Solicitation: ${solicitationNumber || 'Not specified'}

WHAT THIS AGENCY WANTS:
${whatTheyWant}

${hasProposalThemes ? `WIN THEMES — REQUIRED FOR THIS PROPOSAL. You must weave each of these into the draft. Do not list them. Integrate them as arguments woven through the prose. These take priority over all other framing:

${proposalWinThemes.filter(t => t?.trim()).map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}
${globalWinThemes.length > 0 ? `FFTC BACKGROUND WIN THEMES — Draw from these where relevant. They represent FFTC's enduring differentiators. Use only those that apply naturally to this section:

${globalWinThemes.map(t => typeof t === 'string' ? t : `${t.theme}: ${t.discriminatorStatement || ''}`).join('\n')}
` : ''}
COMPLIANCE REQUIREMENTS THIS SECTION MUST ADDRESS:
${relatedCompliance.length > 0 ? relatedCompliance.map(c => `[${(c as { requirement_ref?: string }).requirement_ref || ''}] ${c.requirement_text}`).join('\n') : 'See requirements below'}

SPECIFIC REQUIREMENTS TO ADDRESS:
${relatedReqs.length > 0 ? relatedReqs.map(r => `[${r.reference_number || r.id}] ${r.text || r.description || r.title}`).join('\n') : 'Not available — write to the section title and context'}

${relevantApproaches.length > 0 ? `STANDARD APPROACHES FROM FFTC — Use these as foundation. Adapt the specific language to this proposal and agency. Do not copy verbatim:

${relevantApproaches.map(sa => `[${(sa.category || 'general').toUpperCase()}] ${sa.title}\n${sa.body}`).join('\n---\n')}
` : ''}
${relevantPP.length > 0 ? `FFTC PAST PERFORMANCE — Cite these specifically. Never invent others:

${relevantPP.map(pp => `PROJECT: ${pp.title}
AGENCY: ${pp.agency}
CONTRACT: ${pp.contractNumber}
PERIOD: ${pp.periodOfPerformance}
SCOPE: ${pp.scope}
OUTCOMES:
  ${pp.outcomes.join('\n  ')}`).join('\n---\n')}
` : ''}
${relatedWbs.length > 0 ? `RELATED WORK PACKAGES:
${relatedWbs.map(w => `${w.ref || ''}: ${w.title}`).join('\n')}
` : ''}
PAGE TARGET: ${pageTarget} pages
TARGET WORD COUNT: approximately ${targetWordCount} words

${subsections.length > 0 ? `SUBSECTION STRUCTURE — Use these as H2 headings and write substantive content under each one. Do not skip any subsection:
${subsections.map(s => `${s.number} ${s.title}`).join('\n')}
` : 'No subsections — write as flowing prose.'}

Write the complete section now. Do not include the section title as a heading. Start with the first paragraph of content. Use H2 headings only for subsections. Fill the target word count.`

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
