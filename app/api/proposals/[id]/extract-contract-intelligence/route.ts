import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computePeriods } from '@/lib/types/contract-intelligence'
import type { Discipline, Confidence } from '@/lib/types/contract-intelligence'
import { runCommand, createCreateIntelligenceDraftCommand } from '@/lib/commands'
import type { FactsJson } from '@/lib/commands/intelligence/types'
import {
  contractIntelligenceExtractionSchema,
  contractIntelligenceJsonSchema,
  type ContractIntelligenceExtraction
} from '@/lib/schemas/contract-intelligence'
import { prepareSolicitationForExtraction } from '@/lib/ai/truncation'
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from '@/lib/ai/prompts/extraction'

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

    // Use modular prompt assembly
    const systemPrompt = buildExtractionSystemPrompt()

    // Truncate solicitation with token-aware budget and honest warning
    const truncation = prepareSolicitationForExtraction(solicitationText, 'claude-sonnet-4-6')

    if (truncation.wasTruncated) {
      console.log(`[extract-contract-intelligence] Document truncated: ${truncation.originalCharCount} -> ${truncation.truncatedCharCount} chars`)
    }

    const userPrompt = buildExtractionUserPrompt(truncation.text)

    // Tool definition with structured output schema
    const extractionTool: Anthropic.Tool = {
      name: 'extract_contract_intelligence',
      description: 'Extract structured contract intelligence from a solicitation document. Call this tool with the extracted data.',
      input_schema: contractIntelligenceJsonSchema as unknown as Anthropic.Tool.InputSchema
    }

    // First attempt with tool-use pattern for structured output
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      tools: [extractionTool],
      tool_choice: { type: 'tool', name: 'extract_contract_intelligence' },
      messages: [{ role: 'user', content: userPrompt }]
    })

    // Extract the tool use result
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

    if (!toolUse) {
      console.error('[extract-contract-intelligence] No tool_use block in response')
      return NextResponse.json(
        { error: 'AI did not return structured output' },
        { status: 500 }
      )
    }

    // Validate with Zod schema
    let extracted: ContractIntelligenceExtraction
    const parseResult = contractIntelligenceExtractionSchema.safeParse(toolUse.input)

    if (!parseResult.success) {
      // One repair pass: send validation errors back to the model
      console.log('[extract-contract-intelligence] Schema validation failed, attempting repair pass')
      console.log('[extract-contract-intelligence] Validation errors:', parseResult.error.issues)

      const repairResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        tools: [extractionTool],
        tool_choice: { type: 'tool', name: 'extract_contract_intelligence' },
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: `Your previous extraction had validation errors:

${parseResult.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')}

Please fix these issues and try again. Ensure all required fields are present and values match the allowed enums exactly.`
          }
        ]
      })

      const repairToolUse = repairResponse.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (!repairToolUse) {
        console.error('[extract-contract-intelligence] Repair pass did not return tool_use')
        return NextResponse.json(
          { error: 'AI repair pass failed', validationErrors: parseResult.error.issues },
          { status: 500 }
        )
      }

      const repairResult = contractIntelligenceExtractionSchema.safeParse(repairToolUse.input)

      if (!repairResult.success) {
        console.error('[extract-contract-intelligence] Repair pass validation still failed:', repairResult.error.issues)
        return NextResponse.json(
          { error: 'Schema validation failed after repair', validationErrors: repairResult.error.issues },
          { status: 500 }
        )
      }

      extracted = repairResult.data
      console.log('[extract-contract-intelligence] Repair pass succeeded')
    } else {
      extracted = parseResult.data
    }

    // Compute periods from extracted base and option months
    const periods = computePeriods(
      extracted.basePeriodMonths ?? 12,
      extracted.optionPeriodMonths
    )

    // Build factsJson from validated extracted fields (all fields now guaranteed by schema)
    const factsJson: FactsJson = {
      documentType: {
        value: extracted.documentType.value as FactsJson['documentType'] extends { value: infer V } ? V : never,
        confidence: extracted.documentType.confidence,
      },
      vehicle: {
        value: extracted.vehicle.value,
        confidence: extracted.vehicle.confidence,
      },
      contractType: {
        value: extracted.contractType.value as FactsJson['contractType'] extends { value: infer V } ? V : never,
        confidence: extracted.contractType.confidence,
      },
      setAside: {
        value: extracted.setAside.value as FactsJson['setAside'] extends { value: infer V } ? V : never,
        confidence: extracted.setAside.confidence,
      },
      rateSource: {
        value: extracted.rateSource.value as FactsJson['rateSource'] extends { value: infer V } ? V : never,
        confidence: extracted.rateSource.confidence,
      },
    }

    // Transform disciplines to command input format (all validated by schema)
    const disciplines = extracted.disciplines.required.map((d) => ({
      discipline: d as Discipline,
      confidence: extracted.disciplines.confidence as Confidence,
      sourceText: extracted.disciplines.sourceText,
    }))

    // Transform roles to labor requirements
    const laborRequirements = extracted.roles.map((r) => ({
      title: r.title,
      laborCategory: r.laborCategory ?? undefined,
      hoursPerMonth: r.hoursPerMonth ?? undefined,
      utilizationPct: r.utilizationPct ?? undefined,
      appearsInPeriods: r.appearsInPeriods ?? [],
      confidence: r.confidence as Confidence,
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
      contractType: extracted.contractType.value,
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
      // Include truncation warning if document was truncated
      ...(truncation.wasTruncated && {
        truncationWarning: truncation.warning
      }),
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
