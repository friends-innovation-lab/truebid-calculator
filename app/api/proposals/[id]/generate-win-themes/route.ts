import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

  // Fetch proposal data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, company_id')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    console.error('[generate-win-themes] Proposal fetch failed:', proposalId, fetchError?.message)
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const proposalSetup = (workingData.proposalSetup || {}) as Record<string, unknown>
  const solicitation = (workingData.solicitation || {}) as Record<string, unknown>

  const agency = (solicitation.clientAgency as string) || ''
  const contractType = (proposalSetup.contractType as string) || (proposal.contract_type as string) || 'T&M'
  const setAside = (proposalSetup.setAside as string) || ''
  const whatTheyWant = (solicitation.whatTheyWant as string) || (solicitation.what_they_want as string) || ''

  // Get extracted requirements
  const extractedRequirements = (workingData.extractedRequirements || []) as { text?: string; description?: string; title: string }[]

  // Get content library from company settings
  const companyId = proposal.company_id as string | null
  interface PPEntry { title: string; agency: string; outcomes?: string[]; status?: string }
  let pastPerformance: PPEntry[] = []

  if (companyId) {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('content_library')
      .eq('company_id', companyId)
      .single()

    const contentLibrary = (settings?.content_library || {}) as { pastPerformance?: PPEntry[] }
    pastPerformance = contentLibrary.pastPerformance || []
  }

  const reqsText = extractedRequirements
    .slice(0, 10)
    .map(r => r.text || r.description || r.title)
    .join('\n') || 'Not available'

  const ppText = pastPerformance.length > 0
    ? pastPerformance.map(pp =>
      `${pp.title} (${pp.agency}): ${pp.outcomes?.slice(0, 2).join('; ') || 'No outcomes listed'}`
    ).join('\n')
    : 'Not available'

  const systemPrompt = `You are helping Friends From The City identify their strongest competitive arguments for a specific proposal.

A win theme is not a capability claim. It is a specific argument for why this agency should choose Friends over every other offeror — grounded in documented past performance and verifiable outcomes.

A weak win theme: "We have experience with federal agencies."

A strong win theme: "Friends is currently supporting CAMP at the Department of State, which means the team already understands DOS operational constraints, security protocols, and stakeholder expectations — without a learning curve."

Every win theme must:
- Be specific to this agency and this contract
- Be defensible with past performance FFTC actually has
- Be something a competitor cannot claim without lying
- Read like a practitioner's argument, not a marketing pitch`

  const userPrompt = `Generate 3 win themes for this proposal.

AGENCY: ${agency}
CONTRACT TYPE: ${contractType}
SET-ASIDE: ${setAside || 'Not specified'}

WHAT THE AGENCY WANTS:
${whatTheyWant || 'Not available'}

KEY REQUIREMENTS:
${reqsText}

FRIENDS PAST PERFORMANCE — only draw from these:
${ppText}

FRIENDS CERTIFICATIONS:
8(a), WOSB, SDVOSB

Return ONLY valid JSON, no other text:
{
  "winThemes": [
    "First theme as one clear sentence",
    "Second theme as one clear sentence",
    "Third theme as one clear sentence"
  ]
}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: { winThemes: string[] }
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[generate-win-themes] Parse failed:', responseText.substring(0, 300))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!parsed.winThemes || !Array.isArray(parsed.winThemes)) {
      return NextResponse.json({ error: 'AI returned invalid win themes' }, { status: 500 })
    }

    // Ensure exactly 3 themes
    const winThemes = parsed.winThemes.slice(0, 3)
    while (winThemes.length < 3) winThemes.push('')

    console.log(`[generate-win-themes] Generated ${winThemes.length} themes for proposal ${proposalId}`)

    return NextResponse.json({ winThemes })

  } catch (error) {
    console.error('[generate-win-themes] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
