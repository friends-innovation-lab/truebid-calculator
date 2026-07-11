import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computePeriods } from '@/lib/types/contract-intelligence'
import type { Discipline, Confidence } from '@/lib/types/contract-intelligence'
import { runCommand, createCreateIntelligenceDraftCommand } from '@/lib/commands'
import type { FactsJson } from '@/lib/commands/intelligence/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Anthropic API key not configured' },
      { status: 500 }
    )
  }

  const { id: proposalId } = await params

  try {
    // Load proposal with working_data to get solicitation text
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('working_data')
      .eq('id', proposalId)
      .single()

    if (fetchError || !proposal) {
      console.error('Failed to fetch proposal:', fetchError)
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const workingData = (proposal.working_data || {}) as Record<string, unknown>

    // Get solicitation text from working_data
    const solicitationText =
      (workingData.rfpText as string) ||
      ((workingData.aiSummary as Record<string, unknown>)?.rawText as string) ||
      ''

    if (!solicitationText || solicitationText.length < 100) {
      return NextResponse.json(
        { error: 'No solicitation text available. Please upload and analyze an RFP first.' },
        { status: 400 }
      )
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a government contracting expert. Your job is to extract the contract structure from federal solicitation documents.

You extract facts. You do not infer, guess, or assume. If information is not explicitly stated in the document, return null for that field and set confidence to 'low'.

Return ONLY valid JSON matching the schema exactly. No prose. No explanation. No markdown.`,

      messages: [
        {
          role: 'user',
          content: `Extract the contract structure from this solicitation.

Return this exact JSON schema. Use null for any field not explicitly stated. Set confidence to 'high' only when the text states it directly, 'medium' when strongly implied, 'low' when uncertain or absent.

{
  "documentType": {
    "value": "RFP|RFQ|SOO|PWS|SOW|task_order|unknown",
    "confidence": "high|medium|low"
  },
  "vehicle": {
    "value": "exact vehicle name from document or null",
    "confidence": "high|medium|low"
  },
  "contractType": {
    "value": "FFP|T&M|IDIQ|BPA|CPFF|unknown",
    "confidence": "high|medium|low"
  },
  "setAside": {
    "value": "8(a)|WOSB|SDVOSB|small_business|none|unknown",
    "confidence": "high|medium|low"
  },
  "rateSource": {
    "value": "internal|gsa_mas|sub",
    "confidence": "high|medium|low",
    "reasoning": "one sentence explaining why"
  },
  "basePeriodMonths": number or null,
  "optionPeriodMonths": [array of numbers] or [],
  "disciplines": {
    "required": ["list only disciplines explicitly required by the scope of work from this list: engineering, design, research, product, delivery, program-management, content, accessibility"],
    "confidence": "high|medium|low",
    "sourceText": "exact quote from document that identifies these disciplines"
  },
  "roles": [
    {
      "title": "exact role title from document",
      "laborCategory": "LCAT name if stated or null",
      "hoursPerMonth": number if explicitly stated or null,
      "utilizationPct": decimal if explicitly stated (e.g. 0.8 for 80%) or null,
      "appearsInPeriods": ["Base Period", "Option Period 1" etc — all periods unless document restricts],
      "confidence": "high|medium|low",
      "sourceText": "exact quote from document"
    }
  ]
}

DISCIPLINE SIGNAL WORDS — use these to identify disciplines but do not hardcode them as requirements. Only include a discipline if the scope of work explicitly requires that type of work:
- engineering: software development, developer, engineer, frontend, backend, full-stack, API, database, coding, programming
- design: UX design, UI design, interaction design, visual design, human-centered design, HCD, service design, workshop facilitation, co-design, design thinking
- research: user research, usability testing, contextual inquiry, discovery, participant recruitment
- product: product manager, product owner, backlog, roadmap, agile delivery
- delivery: delivery manager, scrum master, sprint facilitation, project coordination
- program-management: program manager, multi-workstream, governance, portfolio
- content: content strategist, plain language, content design, information architecture
- accessibility: Section 508, WCAG, assistive technology

SOLICITATION DOCUMENT:
${solicitationText.slice(0, 15000)}`,
        },
      ],
    })

    const text =
      response.content.find((b) => b.type === 'text')?.text || '{}'

    let extracted: {
      documentType?: { value: string; confidence: string }
      vehicle?: { value: string | null; confidence: string }
      contractType?: { value: string; confidence: string }
      setAside?: { value: string; confidence: string }
      rateSource?: { value: string; confidence: string }
      basePeriodMonths?: number | null
      optionPeriodMonths?: number[]
      disciplines?: { required: string[]; confidence: string; sourceText: string }
      roles?: Array<{
        title: string
        laborCategory: string | null
        hoursPerMonth: number | null
        utilizationPct: number | null
        appearsInPeriods: string[]
        confidence: string
        sourceText: string
      }>
    }

    try {
      extracted = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      console.error('Failed to parse AI response:', text.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: text },
        { status: 500 }
      )
    }

    // Compute periods from extracted base and option months
    const periods = computePeriods(
      extracted.basePeriodMonths || 12,
      extracted.optionPeriodMonths || []
    )

    // Build factsJson from extracted fields
    const factsJson: FactsJson = {}
    if (extracted.documentType) {
      factsJson.documentType = {
        value: extracted.documentType.value as FactsJson['documentType'] extends { value: infer V } ? V : never,
        confidence: extracted.documentType.confidence as Confidence,
      }
    }
    if (extracted.vehicle) {
      factsJson.vehicle = {
        value: extracted.vehicle.value,
        confidence: extracted.vehicle.confidence as Confidence,
      }
    }
    if (extracted.contractType) {
      factsJson.contractType = {
        value: extracted.contractType.value as FactsJson['contractType'] extends { value: infer V } ? V : never,
        confidence: extracted.contractType.confidence as Confidence,
      }
    }
    if (extracted.setAside) {
      factsJson.setAside = {
        value: extracted.setAside.value as FactsJson['setAside'] extends { value: infer V } ? V : never,
        confidence: extracted.setAside.confidence as Confidence,
      }
    }
    if (extracted.rateSource) {
      factsJson.rateSource = {
        value: extracted.rateSource.value as FactsJson['rateSource'] extends { value: infer V } ? V : never,
        confidence: extracted.rateSource.confidence as Confidence,
      }
    }

    // Transform disciplines to command input format
    const disciplines = extracted.disciplines?.required?.map((d: string) => ({
      discipline: d as Discipline,
      confidence: (extracted.disciplines?.confidence || 'medium') as Confidence,
      sourceText: extracted.disciplines?.sourceText,
    })) || []

    // Transform roles to labor requirements
    const laborRequirements = (extracted.roles || []).map((r) => ({
      title: r.title,
      laborCategory: r.laborCategory ?? undefined,
      hoursPerMonth: r.hoursPerMonth ?? undefined,
      utilizationPct: r.utilizationPct ?? undefined,
      appearsInPeriods: r.appearsInPeriods || [],
      confidence: (r.confidence || 'medium') as Confidence,
      sourceText: r.sourceText,
    }))

    // Transform periods for command input
    const periodsInput = periods.map((p, idx) => ({
      name: p.name,
      months: p.months,
      cumulativeMonthsEnd: p.cumulativeMonthsEnd,
      gsaRateYear: p.gsaRateYear,
      sortOrder: idx,
    }))

    console.log('[extract-contract-intelligence] Extracted:', JSON.stringify({
      documentType: factsJson.documentType?.value,
      periods: periodsInput.length,
      disciplines: disciplines.map((d: { discipline: string }) => d.discipline),
      laborRequirements: laborRequirements.length,
    }))

    // Use CreateIntelligenceDraft command to persist to versioned tables
    const command = createCreateIntelligenceDraftCommand(supabase)
    const result = await runCommand(supabase, command, {
      proposalId,
      factsJson,
      contractType: extracted.contractType?.value,
      periods: periodsInput,
      disciplines,
      laborRequirements,
    })

    if (!result.success || !result.data) {
      console.error('[extract-contract-intelligence] Command failed:', result.error)
      return NextResponse.json(
        { error: result.error?.message || 'Failed to save intelligence' },
        { status: 500 }
      )
    }

    const { versionId, versionNumber, status } = result.data

    console.log('[extract-contract-intelligence] Created intelligence version:', JSON.stringify({
      proposalId,
      versionId,
      versionNumber,
      status,
    }))

    // Return the new version info along with extracted data for immediate UI display
    return NextResponse.json({
      version: {
        id: versionId,
        versionNumber,
        status,
      },
      factsJson,
      periods: periodsInput,
      disciplines,
      laborRequirements,
    })
  } catch (error) {
    console.error('Extract contract intelligence error:', error)

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
    return NextResponse.json(
      { error: `Failed to extract contract intelligence: ${errorMessage}` },
      { status: 500 }
    )
  }
}
