import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWritingGuidePrompt, getWritingGuideForCoaching } from '@/lib/writing-guide'

// Types for Pass 1 outline
type ParagraphRole = 'opener' | 'subsection_opener' | 'development' | 'evidence' | 'transition'

interface ParagraphOutline {
  role: ParagraphRole
  subsection: string | null
  subsectionNumber: string | null
  instruction: string
  approach: string
  evidence: string | null
  transitionTo: string | null
}

interface Pass1Outline {
  sectionArgument: string
  paragraphs: ParagraphOutline[]
}

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

  // Find the section in the outline OR in proposal_sections table
  const allOutlineSections = (outline.volumes || []).flatMap(v => v.sections || [])
  const sectionData = allOutlineSections.find(s => s.id === sectionId) || null

  // If not found in outline, try to get from proposal_sections table
  let dbSection: { title?: string; target_word_count?: number; instructions?: string } | null = null
  if (!sectionData) {
    const { data: section } = await supabase
      .from('proposal_sections')
      .select('title, target_word_count, instructions')
      .eq('id', sectionId)
      .single()
    dbSection = section
  }

  console.log('[draft-section] Section lookup:', {
    sectionId,
    foundInOutline: !!sectionData,
    foundInDb: !!dbSection,
    outlineSectionCount: allOutlineSections.length,
    pageTarget: sectionData?.pageTarget || dbSection?.target_word_count || 1,
    subsectionsCount: sectionData?.subsections?.length || 0
  })

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
  // Block categories with aspirational content that lacks documented outcomes
  const BLOCKED_CATEGORIES = [
    'devops',
    'infrastructure',
    'backend',
    'security'
  ]
  const standardApproaches = contentLibrary.standardApproaches || []
  const sectionTitleLower = sectionTitle.toLowerCase()
  const relevantApproaches = standardApproaches
    .filter(sa => !BLOCKED_CATEGORIES.includes((sa.category || '').toLowerCase()))
    .filter(sa =>
      sectionTitleLower.includes(sa.category || '') ||
      sa.tags?.some(tag => sectionTitleLower.includes(tag.toLowerCase()))
    )

  // Get writing guide from company settings (pass companyId to avoid owner lookup failure)
  const writingGuide = await getWritingGuidePrompt(companyId || undefined)
  const { guide: writingGuideRaw } = await getWritingGuideForCoaching(companyId || undefined)
  const wordsToAvoid = writingGuideRaw?.words_to_avoid?.join(', ') || 'robust, leverage, proven, iterative, mission-critical, seamlessly, deeply, ensure, cutting-edge, innovative'
  console.log('[draft-section] Writing guide loaded:', writingGuide ? `${writingGuide.length} chars` : 'NULL — falling back')

  const setAside = (proposalSetup.setAside as string) || ''
  const solicitationNumber = (solicitation.solicitationNumber as string) || ''
  // Use outline pageTarget, or DB target_word_count (which might be in words, not pages), or default to 2 pages
  const pageTarget = sectionData?.pageTarget || 2
  const subsections = sectionData?.subsections || []
  const wordsPerPage = (proposalSetup.wordsPerPage as number) || 500
  // If DB has target_word_count, use it directly; otherwise calculate from pages
  const targetWordCount = dbSection?.target_word_count || (pageTarget * wordsPerPage)

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

ANOTHER BAD EXAMPLE:

"Friends implements layered security approaches with real-time monitoring, behavioral analysis, and automated response systems that maintain user experience while preventing unauthorized access."

WHY THIS IS BAD:
Three items listed after a verb. No problem stated. No outcome. No agency connection. Any contractor could claim this without changing a word. A comma-separated list of capabilities is a signal that the paragraph has not finished its job. The writer avoided stating what any of these things actually prevented or produced.

ANOTHER GOOD EXAMPLE:

"Federal deployments that skip security review in the development pipeline accumulate vulnerability backlogs that stall ATO processes for months. On the VA PACT Act 526ez project, security scanning ran on every pull request. A failing scan blocked the merge. The security team inherited a clean codebase rather than a remediation list. That decision is not a DevOps preference. It is what makes an ATO timeline predictable."

WHY THIS IS GOOD:
Opens with the problem the agency recognizes from experience. Names a specific contract. Describes one specific decision. States what it prevented. No list. No capabilities claimed without evidence.

THE RULE THIS ILLUSTRATES:
When writing about technical capabilities, name one specific thing, explain what failure it prevents or what outcome it enables, and connect it to a documented outcome. Never list three capabilities in one sentence. If you find yourself writing "Friends implements X, Y, and Z" stop. Pick the one that is most specific and most documented. Write what it prevented or enabled. Cut the other two.

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

CAPABILITY LISTS:
Never write a sentence that lists three or more technical capabilities separated by commas. This pattern produces unverifiable claims. If you find yourself writing "Friends implements X, Y, and Z" stop. Pick one. Write what it prevented or produced. Cut the others.

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

${relevantApproaches.length > 0 ? `METHODOLOGY FRAMEWORKS ONLY:
The following describe how Friends thinks about this type of work. Do NOT cite any specific tool, technology, platform, or practice from these frameworks as something Friends has done unless it also appears explicitly in the past performance list above. Do not mention Redis, Kubernetes, Terraform, Docker, machine learning, FedRAMP, or any specific technology unless it is in the past performance list. Use these frameworks for structure and thinking only.

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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASS 1 — STRUCTURE (non-streaming)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let pass1Outline: Pass1Outline | null = null

    const pass1SystemPrompt = `You are a proposal strategist helping Friends From The City plan a proposal section before any writing begins.

Your job is to decide what each paragraph needs to argue before a writer writes it. You are not writing prose. You are creating a paragraph-by-paragraph outline that a writer will follow.

Shipley structure is a SECTION-level requirement, not a paragraph-level one. The section opener establishes the government's problem and the FFTC argument. Every subsequent paragraph advances that argument. Subsections develop specific aspects of it. They do not each restart from a problem statement.

PARAGRAPH ROLES:

opener — Use ONCE, for the very first paragraph of the entire section before any H2 headings. This paragraph must:
- Open with the government's specific problem or operational reality
- State what is at stake if the problem is not solved
- Introduce Friends and what makes them uniquely positioned to solve it
- Set up the argument the entire section will make
Never use this role more than once.

subsection_opener — First paragraph under each H2 heading. This paragraph must:
- Connect to the section's overall argument established in the opener
- Introduce the specific angle this subsection develops
- NOT restate the overall problem already established
- Feel like a continuation of the argument, not a new argument
Example opening: "That operational context shapes how Friends approaches [subsection topic]." or "Within that framework, [subsection topic] works as follows."

development — Middle paragraphs that advance the argument. This paragraph must:
- Develop one specific aspect of the approach with enough depth to be credible
- Connect to what came before in the same subsection
- Never restate the problem
- Open with the approach, methodology, or decision — not with a problem

evidence — A paragraph that cites specific documented past performance. This paragraph must:
- Name the agency and contract
- State the specific challenge faced
- Describe what Friends did
- State the measurable outcome
- Connect back to why this matters for the current contract
Never invent evidence. If no relevant past performance exists, use a development role instead.

transition — Last paragraph before a new H2 heading. This paragraph must:
- Close the argument of the current subsection with a concluding sentence
- Hand off naturally to the next subsection without restating the problem
- Last sentence should set up the next subsection topic
Example: "That delivery structure works because quality is tracked with the same rigor as timeline — which the next section addresses directly."

ROLE DISTRIBUTION RULES:
- Exactly ONE opener for the whole section
- ONE subsection_opener per H2
- At least TWO development paragraphs per subsection
- At least ONE evidence paragraph per subsection where past performance exists
- ONE transition paragraph at the end of each subsection EXCEPT the last

Anti-hallucination rule: Evidence must come only from the past performance list provided. If no relevant past performance exists for a paragraph, mark evidence as null and use a development role instead.

Return ONLY valid JSON. No prose. No explanation. No markdown. Just the JSON object.`

    const totalParagraphs = Math.ceil(targetWordCount / 135)
    const developmentPerSubsection = subsections.length > 0
      ? Math.max(2, Math.floor((totalParagraphs - 1 - subsections.length * 2) / subsections.length))
      : Math.max(2, totalParagraphs - 1)

    const pass1UserPrompt = `Plan the paragraph structure for the "${sectionTitle}" section.

SECTION PAGE TARGET: ${pageTarget} pages (${targetWordCount} words)

SUBSECTIONS (include the number in subsectionNumber for each paragraph):
${subsections.length > 0 ? subsections.map(s => `${s.number} ${s.title}`).join('\n') : 'No subsections — single flowing section'}

WHAT THIS AGENCY NEEDS:
${whatTheyWant}

COMPLIANCE REQUIREMENTS:
${relatedCompliance.slice(0, 5).map(c => `[${(c as { requirement_ref?: string }).requirement_ref || ''}] ${c.requirement_text}`).join('\n') || 'None'}

SPECIFIC REQUIREMENTS:
${relatedReqs.slice(0, 10).map(r => `[${r.reference_number || r.id}] ${r.text || r.description || r.title}`).join('\n') || 'None'}

FFTC PAST PERFORMANCE — evidence must come only from this list:
${relevantPP.slice(0, 5).map(pp => `PROJECT: ${pp.title}
AGENCY: ${pp.agency}
OUTCOMES: ${pp.outcomes?.slice(0, 2).join('; ')}`).join('\n---\n') || 'None available'}

Return this JSON structure:
{
  "sectionArgument": "One sentence stating the single argument this entire section makes to the evaluator",
  "paragraphs": [
    {
      "role": "opener | subsection_opener | development | evidence | transition",
      "subsection": "H2 heading title this paragraph belongs under, or null",
      "subsectionNumber": "The subsection number (e.g. '1.1', '2.3') exactly as provided, or null",
      "instruction": "Specific instruction for what this paragraph must do based on its role",
      "approach": "What Friends does or has done",
      "evidence": "Specific past performance project and outcome, or null if not applicable",
      "transitionTo": "For transition role only — what the next subsection is about"
    }
  ]
}

Include the subsection number in every outline entry under subsectionNumber. Use the exact number from the subsections list (e.g., "1.1", "1.2", "2.1").

ROLE DISTRIBUTION FOR THIS SECTION:
This section has ${subsections.length} subsections and needs approximately ${totalParagraphs} paragraphs total.

Distribute roles as follows:
- 1 opener (before any H2)
${subsections.length > 0 ? `- For each subsection:
  - 1 subsection_opener
  - ${developmentPerSubsection} development paragraphs
  - 1 evidence paragraph (if past performance exists for this topic)
  - 1 transition paragraph (except for the last subsection)` : `- ${developmentPerSubsection} development paragraphs
- 1 evidence paragraph (if past performance exists)`}

The section should read as ONE connected argument, not ${subsections.length || 1} separate arguments. Subsections develop the case. They do not restart it.`

    try {
      const pass1Response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: pass1SystemPrompt,
        messages: [{ role: 'user', content: pass1UserPrompt }],
      })

      const pass1Text = pass1Response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('')

      // Parse the JSON response
      const jsonMatch = pass1Text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        pass1Outline = JSON.parse(jsonMatch[0]) as Pass1Outline
        console.log('[draft-section] Pass 1 outline generated:', JSON.stringify({
          paragraphCount: pass1Outline.paragraphs.length,
          sectionArgument: pass1Outline.sectionArgument?.slice(0, 100),
          roles: pass1Outline.paragraphs.map(p => p.role).join(', '),
          targetWordCount
        }))
      }
    } catch (pass1Error) {
      console.log('[draft-section] Pass 1 failed, falling back to single pass:', pass1Error instanceof Error ? pass1Error.message : 'Unknown error')
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASS 2 — PROSE (streaming)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Build Pass 2 user prompt — use outline if available, fall back to original prompt
    let pass2UserPrompt: string

    if (pass1Outline && pass1Outline.paragraphs.length > 0) {
      console.log('[draft-section] Pass 2 starting with outline of', pass1Outline.paragraphs.length, 'paragraphs targeting', targetWordCount, 'words')

      pass2UserPrompt = `Write the "${sectionTitle}" section using this outline.

SECTION ARGUMENT:
${pass1Outline.sectionArgument}

SUBSECTION HEADINGS:
Every subsection must have an H2 heading that includes the section number exactly as it appears in the outline. The heading format is:

## [number] [title]

For example:
## 1.1 Understanding of Requirements
## 1.2 CAMP MVP Enhancement Strategy
## 2.1 Project Management Framework

The number comes from the subsection data passed in the outline. Use it exactly. Do not omit it. Do not renumber. Do not use bold text instead of a heading.

WRITE EACH PARAGRAPH FROM ITS ROLE:
${pass1Outline.paragraphs.map((p, i) => `PARAGRAPH ${i + 1}
${p.subsection ? `[Under H2 heading: ## ${p.subsectionNumber ? `${p.subsectionNumber} ` : ''}${p.subsection}]` : '[Before first H2 — no heading]'}
Role: ${(p.role || 'development').toUpperCase()}

${p.role === 'opener' ? `Open with the government's specific operational problem or reality. State what is at stake. Introduce Friends. Establish the argument this section makes. Do not start with "Friends From The City." Start with the problem.` : ''}
${p.role === 'subsection_opener' ? `Connect to the section's overall argument. Introduce this subsection's specific angle. Do NOT restate the problem already established in the opening. Feel like a continuation. Open with "That..." or "Within that context..." or a similar phrase that connects backward before moving forward.` : ''}
${p.role === 'development' ? `Develop one specific aspect of the approach with depth and precision. Do NOT write a capability list. Do NOT write "Friends implements X, Y, and Z."

Write like a practitioner explaining a decision:
- What problem does this specific approach address?
- What would go wrong without it?
- What specific decision did the team make and why?
- What does that decision prevent or enable?

If no past performance evidence exists, write from methodology. Describe how practitioners think about this problem, what tradeoffs exist, and what the right decision looks like. Ground it in operational reality, not capability claims.

Never write:
"Friends implements [list of tools]"
"The team uses [X, Y, and Z]"
"Our approach includes [list]"

Always write:
"[Specific decision] prevents [specific failure]. [Why that decision matters in this operational context]."` : ''}
${p.role === 'evidence' ? `${p.evidence ? `Cite this documented past performance:
${p.evidence}
Name the agency, describe what Friends did, state the measurable outcome, connect to why this matters for the current contract.` : `No documented past performance exists for this specific topic. Write a development paragraph instead. Describe how practitioners approach this problem, what decisions matter, what failure modes exist, and what the right approach prevents. Do not invent past performance. Do not write a capability list. Write like someone who has thought carefully about this problem.`}` : ''}
${p.role === 'transition' ? `This paragraph closes the current subsection and hands off to the next.

Rules:
- Do NOT restate any problem from this subsection or the section opener
- Close the argument of this subsection with a concluding sentence that reflects what was established here
- The final sentence must hand off naturally to the next subsection: "${p.transitionTo || 'next subsection'}"
- The connection should feel earned, not mechanical. Do not write "Now we turn to..." or "The next section addresses..."
- Instead, close the current thought in a way that makes the next topic feel like the natural continuation. Example: "That delivery structure works because deliverable quality is tracked with the same rigor as timeline — which the next section addresses directly."
- Never use em dashes in the transition sentence` : ''}

What to cover: ${p.instruction}
Approach: ${p.approach}
Write 120-150 words.`).join('\n\n')}

FORMATTING:
Use H2 headings for each subsection. Write prose paragraphs under each heading. Never use em dashes. Never use: ${wordsToAvoid}

IDENTITY:
"Friends From The City" on first reference. "Friends" thereafter. Never "FFTC."

TOTAL TARGET: ${targetWordCount} words. Fill the target completely.`
    } else {
      // Fall back to original user prompt if Pass 1 failed
      pass2UserPrompt = userPrompt
    }

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: pass2UserPrompt }],
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
