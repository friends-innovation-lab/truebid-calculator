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
    .select('working_data, contract_type, strategy, company_id')
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

  // Get company settings (writing guide, content library) using proposal's company_id
  const companyId = proposal.company_id as string | null
  console.log('[draft-section] Using company_id from proposal:', companyId || 'NOT SET')

  interface WinThemeEntry {
    theme: string
    discriminatorStatement?: string
  }
  let contentLibrary: { pastPerformance?: PastPerformanceEntry[]; standardApproaches?: StandardApproachEntry[]; winThemes?: WinThemeEntry[] } = {}
  if (companyId) {
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('content_library, writing_guide')
      .eq('company_id', companyId)
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
  console.log('[draft-section] Past performance:', pastPerformance.length, 'total,', relevantPP.length, 'relevant')

  // Get standard approaches relevant to this section
  const standardApproaches = contentLibrary.standardApproaches || []
  const sectionTitleLower = sectionTitle.toLowerCase()
  const relevantApproaches = standardApproaches.filter(sa =>
    sectionTitleLower.includes(sa.category || '') ||
    sa.tags?.some(tag => sectionTitleLower.includes(tag.toLowerCase()))
  )

  // Get writing guide from company settings
  const writingGuide = await getWritingGuidePrompt()
  console.log('[draft-section] Writing guide loaded:', writingGuide ? `${writingGuide.length} chars` : 'NULL — falling back')

  const setAside = (proposalSetup.setAside as string) || ''
  const solicitationNumber = (solicitation.solicitationNumber as string) || ''
  const pageTarget = sectionData?.pageTarget || 1
  const subsections = sectionData?.subsections || []
  const wordsPerPage = (proposalSetup.wordsPerPage as number) || 392
  const targetWordCount = pageTarget * wordsPerPage

  const systemPrompt = `You are writing a proposal section on behalf of Friends From The City.

${writingGuide}

WHAT BAD LOOKS LIKE — NEVER WRITE LIKE THIS:

"Friends From The City brings proven experience supporting federal platforms with stringent availability requirements and complex stakeholder ecosystems, demonstrated through our current work on State's Consular Appointment Management Platform and our track record across federal agencies with similar operational demands. Our technical approach centers on iterative delivery within secure federal environments."

WHY THIS IS BAD:
- Opens with what FFTC has instead of what the agency needs
- "proven experience" — banned phrase
- "iterative delivery" — banned word
- "stringent availability requirements" — could describe any vendor's pitch
- No specific outcome, number, or decision
- An evaluator learns nothing about FFTC that distinguishes them from 10 other offerors

WHAT GOOD LOOKS LIKE — WRITE LIKE THIS:

"The Department of State's appointment scheduling infrastructure serves 300+ consular locations across 230 overseas posts and 29 domestic passport agencies. When that system fails, visa appointments don't get booked. Consular officers lose visibility into capacity. Travelers lose access to services they've waited months to reach. Friends From The City is currently supporting CAMP's product development across American Citizen Services, Non-Immigrant Visa, and crisis scheduling workstreams — which means we understand the operational consequences of getting this wrong."

WHY THIS IS GOOD:
- Opens with the agency's reality, not FFTC
- States what failure actually costs
- Ties FFTC's current work to specific workstreams named in the RFP
- Every sentence contains something an evaluator cannot find in any other proposal

ANOTHER BAD EXAMPLE:

"Our human-centered design methodology ensures user needs are at the center of all design decisions. We conduct user research to inform our designs and iterate based on feedback."

WHY THIS IS BAD:
- Generic to the point of meaninglessness
- No specific users, no specific system, no specific outcome
- "human-centered design" — banned phrase
- "ensures" — banned word
- Any UX firm on the planet could claim this

ANOTHER GOOD EXAMPLE:

"When the QPP site was receiving 8,834 help desk tickets in a single submission window, the team could have rebuilt the navigation. Instead, Friends conducted research that surfaced a simpler problem: users expected information organized around their participation flow — eligibility first, then reporting, then scores. The navigation wasn't wrong. It was in the wrong order. Fixing the sequence reduced key tasks from seven clicks to three."

WHY THIS IS GOOD:
- Opens with a specific, verifiable number
- Explains the decision, not just the outcome
- Shows the thinking behind the approach
- Outcome is specific and measurable

RULES FOR CITING PAST PERFORMANCE:

When referencing a past project, always use a linking sentence that connects the past work to the current need. Do not just drop a project name.

BAD: "Friends' work on the VA debt portal demonstrates our UX capability."

GOOD: "The scheduling challenges DOS faces with CAMP are structurally similar to what Friends navigated on the VA debt resolution platform — multiple pathways, different user populations, and a backend that had to connect to multiple VA systems. On that project, co-design sessions with Veterans with PTSD, TBI, and cognitive impairments produced behavioral archetypes that shaped the information architecture. Waiver submissions increased 88 percent after launch."

READ THE REQUIREMENTS BEFORE YOU WRITE:

You have been given the specific requirements and PWS for this section. Read them before writing a single sentence. Every paragraph must respond to something in those requirements. If a paragraph could appear in a proposal for a different agency or a different contract, delete it and rewrite.

For technical sections: go into specific depth on design, research, and engineering approaches. Name specific methodologies, tools, and practices. Describe how the work actually gets done — not that it will be done well.

For design sections: name specific research methods (moderated usability sessions, contextual inquiry, co-design, service blueprinting). Describe what those methods produce and how the outputs feed the next phase of work.

For engineering sections: name the specific technical decisions and why they were made. Describe the deployment pipeline, testing approach, and integration strategy in terms of what they prevent or enable.

IDENTITY RULES:
Use "Friends From The City" on first reference. Use "Friends" thereafter. Never use "FFTC." Never open with "Friends From The City brings..." or "Friends From The City is..."

ANTI-HALLUCINATION:
Only cite past performance explicitly listed in this prompt. Never invent projects, agencies, contract numbers, outcomes, or numbers. If a specific number is not in the past performance list, do not use it. No security clearances, FedRAMP, or DevSecOps claims unless explicitly in the past performance list.

LENGTH:
Fill the target word count. This is non-negotiable. A 4-page section = ${4 * wordsPerPage} words minimum. A 2-page section = ${2 * wordsPerPage} words minimum. A 1-page section = ${wordsPerPage} words minimum. If you are under the target you have not finished. Write more.

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

${hasProposalThemes ? `WIN THEMES — REQUIRED FOR THIS PROPOSAL. Weave each into the prose as arguments. Do not list them. Do not introduce them as "win themes." Integrate them so naturally that the evaluator absorbs them without noticing:

${proposalWinThemes.filter(t => t?.trim()).map((t, i) => `${i + 1}. ${typeof t === 'string' ? t : (t as { theme?: string; title?: string }).theme || (t as { theme?: string; title?: string }).title || t}`).join('\n')}
` : ''}
${globalWinThemes.length > 0 ? `FFTC BACKGROUND THEMES — Draw from these where they apply naturally to this section. Do not force them:

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
${subsections.length > 0 ? `SUBSECTION STRUCTURE — Use these as H2 headings and write substantive content under each one. Do not skip any subsection:
${subsections.map(s => `${s.number} ${s.title}`).join('\n')}
` : ''}
WORD COUNT FOR THIS SPECIFIC SECTION:
This section has a page target of ${pageTarget} pages.
That requires EXACTLY ${targetWordCount} words minimum.
Current draft word count will be shown to the user. If the draft is under ${targetWordCount} words you have failed this instruction.
Write until you reach ${targetWordCount} words. Do not stop early.

SUBSECTION DEPTH REQUIREMENT:
${subsections.length > 0 ? `This section has ${subsections.length} subsections. Each subsection is an H2 heading. Each subsection requires a MINIMUM of ${Math.floor(targetWordCount / subsections.length)} words of substantive content.
Do not write a single paragraph per subsection. Write multiple paragraphs that fully develop the topic with specific methodology, tools, outcomes, and connection to this agency's needs.` : `Write multiple paragraphs that fully develop each aspect of this topic. Minimum 4 paragraphs of substantive content.`}

Write the complete section now. Do not include the section title as a heading. Start with the first paragraph of content. Use H2 headings only for subsections.`

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
