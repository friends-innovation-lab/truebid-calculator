import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractionResponseSchema } from '@/lib/schemas/rfp'

const getRequirementsCeiling = (pageCount: number): number => {
  if (pageCount <= 15) return 20
  if (pageCount <= 30) return 30
  if (pageCount <= 60) return 40
  if (pageCount <= 100) return 55
  return 70
}

const REQUIREMENTS_SYSTEM_PROMPT = (ceiling: number) => `You are a senior proposal manager extracting delivery requirements from a federal RFP.

Extract ONLY from Section C (Statement of Work / Performance Work Statement) and Section H (Special Contract Requirements).

These are the things the contractor must BUILD, OPERATE, or DELIVER. They drive work planning and pricing.

Rules:
1. Maximum ${ceiling} requirements total
2. Each requirement must be distinct — consolidate related sub-items into one
3. Skip: FAR/DFAR clauses, payment terms, admin requirements, Section L/M/K/J content
4. Ask: 'Does this drive a WBS work package?' If no — skip it.

A typical scoped federal IT RFP has 15–25 delivery requirements.`

const REQUIREMENTS_USER_PROMPT = (ceiling: number, pageCount: number) => `Extract delivery requirements from this RFP.
Sections C and H only. This is a ${pageCount}-page RFP with a ceiling of ${ceiling} requirements.

Return ONLY valid JSON with this structure:

{
  "metadata": {
    "title": "Extract actual project/contract name",
    "solicitationNumber": "Extract actual solicitation number",
    "clientAgency": "MUST match exactly one of: Department of Defense (DOD)|Health & Human Services (HHS)|Veterans Affairs (VA)|Homeland Security (DHS)|Department of Justice (DOJ)|Department of Treasury|Department of State|Department of Energy (DOE)|Environmental Protection Agency (EPA)|NASA|General Services Administration (GSA)|Social Security Administration (SSA)|Department of Agriculture (USDA)|Department of Commerce|Department of Labor|Department of Interior|Department of Education|Housing & Urban Development (HUD)|Department of Transportation|Office of Personnel Management (OPM)|Small Business Administration (SBA)|Other",
    "contractType": "ffp|tm|cpff|idiq|hybrid|unknown",
    "naicsCode": "6-digit code from document",
    "responseDeadline": "YYYY-MM-DD or N/A",
    "periodOfPerformance": { "base": 1, "options": 0 },
    "placeOfPerformance": "City, State",
    "setAside": "small business|8a|SDVOSB|WOSB|HUBZone|unrestricted|N/A"
  },
  "requirements": [
    {
      "id": "REQ-001",
      "title": "3-6 word title",
      "text": "Full consolidated requirement text",
      "type": "shall",
      "sourceSection": "Section C · p.12"
    }
  ],
  "suggestedRoles": []
}

REQUIREMENT NUMBERING: REQ-001, REQ-002...
TYPE VALUES: 'shall' | 'should'
SOURCE FORMAT: 'Section [LETTER] · p.[N]'

Response must start with { and end with }`

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

  const { id } = await params

  try {
    // Read rfpText from body first, fall back to DB
    let rfpText = ''
    let pageCount = 50 // default estimate
    try {
      const body = await request.json()
      rfpText = body.rfpText || ''
      if (body.pageCount) pageCount = body.pageCount
    } catch {
      // No body — fall back to DB
    }

    if (!rfpText) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('working_data')
        .eq('id', id)
        .single()

      const workingData = (proposal?.working_data || {}) as Record<string, unknown>
      rfpText = (workingData.rfpText as string) || ''
    }

    if (!rfpText || rfpText.length < 100) {
      return NextResponse.json(
        { error: 'No RFP text available. Upload a PDF first.' },
        { status: 400 }
      )
    }

    const ceiling = getRequirementsCeiling(pageCount)
    console.log(`[extract-requirements] Starting extraction (ceiling: ${ceiling}, pages: ${pageCount})`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: REQUIREMENTS_SYSTEM_PROMPT(ceiling),
      messages: [
        {
          role: 'user',
          content: `${REQUIREMENTS_USER_PROMPT(ceiling, pageCount)}\n\nDocument to analyze:\n\n${rfpText}`
        }
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI model' }, { status: 500 })
    }

    // Parse JSON
    let extracted
    try {
      const jsonStart = responseText.indexOf('{')
      const jsonEnd = responseText.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in response')
      }
      extracted = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1))
    } catch (parseError) {
      console.error('[extract-requirements] Parse failed:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse requirements response' }, { status: 500 })
    }

    // Validate
    const validated = extractionResponseSchema.safeParse(extracted)
    if (!validated.success) {
      const issues = validated.error.issues
      console.error('[extract-requirements] Validation failed:', JSON.stringify(issues, null, 2))
      const issuesSummary = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json(
        { error: `AI returned invalid structure: ${issuesSummary}` },
        { status: 500 }
      )
    }

    // Guard rail
    if (validated.data.requirements.length > ceiling) {
      return NextResponse.json(
        { error: `Too many requirements: ${validated.data.requirements.length} (max ${ceiling})` },
        { status: 400 }
      )
    }

    // Ensure IDs
    const requirements = validated.data.requirements.map((req, index) => ({
      ...req,
      id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
    }))

    console.log(`[extract-requirements] Extracted ${requirements.length} requirements`)

    return NextResponse.json({
      success: true,
      metadata: validated.data.metadata,
      requirements,
      suggestedRoles: validated.data.suggestedRoles,
    })

  } catch (error) {
    console.error('[extract-requirements] Error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'Invalid Anthropic API key' }, { status: 401 })
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again.' }, { status: 429 })
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract requirements' },
      { status: 500 }
    )
  }
}
