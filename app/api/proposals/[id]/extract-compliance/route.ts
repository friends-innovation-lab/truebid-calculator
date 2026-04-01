import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const COMPLIANCE_MATRIX_SYSTEM_PROMPT = `You are an expert federal proposal manager building a compliance matrix from an RFP.

A compliance matrix is NOT a list of technical requirements. It is a complete checklist of everything the proposal DOCUMENT must address, respond to, or include — across all sections.

You must extract items from EACH of these RFP sections:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION L — INSTRUCTIONS TO OFFERORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This section tells offerors HOW to write and submit the proposal. Look specifically for:

PAGE AND VOLUME RULES:
- Page limits for each volume ("The Technical Volume shall not exceed 20 pages")
- Font requirements ("Use 12-point Times New Roman or Arial")
- Margin requirements ("1-inch margins on all sides")
- Spacing requirements ("Single-spaced text")
- Whether figures and tables count toward page limits

VOLUME STRUCTURE:
- Which volumes are required ("Submit Volume I — Technical Approach, Volume II — Management Approach, Volume III — Past Performance, Volume IV — Price/Cost")
- Required sections within each volume ("Volume I must include: Technical Approach, Management Plan, Staffing Plan")

SUBMISSION REQUIREMENTS:
- Submission method ("Submit via SAM.gov" or "email to CO")
- File format ("Submit as a single PDF")
- Number of copies ("Submit 1 original and 3 copies")
- Deadline and time zone ("Submit no later than 4:00 PM EST")
- What to put in the subject line or package

REQUIRED ATTACHMENTS AND FORMS:
- Any forms that must be completed ("Complete and sign SF 1449")
- Any attachments that must be filled out ("Complete Attachment 2 — Pricing Template")
- Signed representations required

CONTENT REQUIREMENTS PER SECTION:
- Specific things each section must address ("Technical Approach must describe your methodology for...")
- ("Past Performance must include 3 references from the last 5 years")
- ("Staffing Plan must identify key personnel with resumes in Attachment A")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION M — EVALUATION FACTORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This section describes how the government will SCORE proposals. Look for:

PRIMARY EVALUATION FACTORS:
- The main factors listed ("Technical Approach", "Management Approach", "Past Performance", "Price/Cost")
- Their relative importance or weighting ("Technical is more important than Past Performance, which is more important than Price")
- ("Technical: 40 points, Management: 30 points, Past Performance: 20 points, Price: 10 points")

SUBFACTORS:
- Any subfactors listed under each factor ("Under Technical Approach: (1) Understanding of Requirements, (2) Technical Solution, (3) Implementation Plan")

ADJECTIVAL RATINGS:
- Rating scales used ("Outstanding / Good / Acceptable / Marginal / Unacceptable")

PRICE EVALUATION METHOD:
- How price will be evaluated ("Price will be evaluated for reasonableness and realism")
- ("Lowest price technically acceptable")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION K — CERTIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This section lists certifications the offeror must make. Look for:

- SAM.gov registration requirement
- Small business certifications required (8(a), SDVOSB, WOSB, HUBZone, etc.)
- Conflict of interest certifications
- Ethics certifications
- Any other representations the offeror must make in the proposal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION J — ATTACHMENTS AND DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This section lists attachments that must be completed or included. Look for:

- Numbered attachments that must be filled out ("Attachment 1 — Statement of Work", "Attachment 2 — Pricing Template", "Attachment 3 — Past Performance Questionnaire")
- Required deliverables during contract performance ("Monthly Status Reports due by 5th of each month", "Quarterly Performance Reviews", "Final Transition Plan 30 days before period end")
- Key Data Requirements or CDRLs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION C — TECHNICAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include the same technical requirements already extracted, using the SAME ref numbers (REQ-001, REQ-002...). Do not re-extract or rename them. Just include them with rfpSection: "C".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION H — SPECIAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Special clauses the proposal must acknowledge:
- Security clearance requirements for personnel
- Subcontracting plan requirements
- Small business utilization goals
- Organizational conflict of interest clauses
- Any special terms requiring acknowledgment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. You MUST include Section L items — page limits, font rules, volume structure, and submission instructions. These are the most commonly missed items in compliance matrices and the most likely to cause non-compliance.

2. You MUST include Section M evaluation factors. Knowing what you'll be scored on is fundamental to writing a winning proposal.

3. Do NOT include generic FAR/DFAR boilerplate clauses — only items specific to this solicitation that require action.

4. Each item must be ACTIONABLE — it must describe something the proposal must DO or INCLUDE.

Expected output counts per section:
  Section L: 5-10 items (formatting + content requirements)
  Section M: 3-6 items (eval factors + subfactors)
  Section K: 2-4 items
  Section J: 2-5 items
  Section C: same count as requirements
  Section H: 0-3 items`

const COMPLIANCE_MATRIX_USER_PROMPT = `Build a complete compliance matrix from this RFP. Follow the system instructions exactly.

CRITICAL: You MUST extract Section L page limits, font requirements, volume structure, and submission instructions. If you do not see these in your output, you missed them — look again in Section L.

Return ONLY a valid JSON array, no other text, no markdown formatting, no backticks:

[
  {
    "ref": "L.1",
    "rfpSection": "L",
    "type": "instruction",
    "text": "Full verbatim text of the instruction or requirement",
    "source": "Section L · p.44"
  }
]

Ref numbering:
  Section L: L.1, L.2, L.3...
  Section M: M.1, M.2, M.3...
  Section K: K.1, K.2, K.3...
  Section J: J.1, J.2, J.3...
  Section C: REQ-001, REQ-002... (match requirements extraction)
  Section H: H.1, H.2, H.3...

type values (use exactly):
  "instruction"    — Section L items
  "evaluation"     — Section M items
  "certification"  — Section K items
  "deliverable"    — Section J items
  "technical"      — Section C items
  "special"        — Section H items

source format: "Section L · p.44"
  Section letter + page number only.
  Never use section heading names.
  Never use "Section C.3.2" style — just "Section C · p.12"

Verify your output includes:
  ✓ At least 3 Section L items
  ✓ At least 3 Section M items
  ✓ Section C items matching requirements

If any of these are missing, extract them before returning.`

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
    try {
      const body = await request.json()
      rfpText = body.rfpText || ''
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

    console.log(`[extract-compliance] Starting compliance matrix extraction (${rfpText.length} chars)`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      temperature: 0,
      system: COMPLIANCE_MATRIX_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${COMPLIANCE_MATRIX_USER_PROMPT}\n\nDocument to analyze:\n\n${rfpText}`
        }
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI model' }, { status: 500 })
    }

    // Parse JSON array
    const jsonStart = responseText.indexOf('[')
    const jsonEnd = responseText.lastIndexOf(']')

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('[extract-compliance] No JSON array found:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse compliance response' }, { status: 500 })
    }

    const rawMatrix = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1))

    const complianceMatrix = rawMatrix.map((item: { ref: string; rfpSection: string; type: string; text: string; source: string }) => ({
      ref: item.ref || '',
      rfpSection: item.rfpSection || '',
      type: item.type || '',
      text: item.text || '',
      source: item.source || '',
      requirementId: null,
    }))

    console.log(`[extract-compliance] Extracted ${complianceMatrix.length} compliance items`)

    return NextResponse.json({
      success: true,
      complianceMatrix,
    })

  } catch (error) {
    console.error('[extract-compliance] Error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'Invalid Anthropic API key' }, { status: 401 })
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again.' }, { status: 429 })
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract compliance matrix' },
      { status: 500 }
    )
  }
}
