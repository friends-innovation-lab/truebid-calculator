import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'
import { extractionResponseSchema, type ExtractionResponse } from '@/lib/schemas/rfp'

// Dynamic ceiling based on page count
const getRequirementsCeiling = (pageCount: number): number => {
  if (pageCount <= 15) return 20   // Simple task order
  if (pageCount <= 30) return 30   // Medium RFP
  if (pageCount <= 60) return 40   // Standard RFP (e.g., CAMP = 49 pages)
  if (pageCount <= 100) return 55  // Large RFP
  return 70                         // Very large full RFP
}

// ============================================================================
// EXTRACTION 1: REQUIREMENTS (Section C + H only)
// These are delivery requirements that drive WBS and pricing
// ============================================================================

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

// ============================================================================
// EXTRACTION 2: COMPLIANCE MATRIX (All sections)
// Everything the proposal document must address or respond to
// ============================================================================

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

export async function POST(request: NextRequest) {
  try {
    // Check for API key first
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Get the form data with the PDF file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { success: false, error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Check file size (limit to 10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)

    // Extract text using unpdf
    let pdfText: string
    let pdfPageCount: number
    try {
      const { text, totalPages } = await extractText(buffer, { mergePages: true })
      pdfText = text
      pdfPageCount = totalPages
      console.log(`[extract-rfp] PDF has ${pdfPageCount} pages`)
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError)
      return NextResponse.json(
        { success: false, error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
        { status: 400 }
      )
    }

    // Calculate dynamic ceiling based on page count
    const ceiling = getRequirementsCeiling(pdfPageCount)
    console.log(`[extract-rfp] Requirements ceiling: ${ceiling} (for ${pdfPageCount} pages)`)

    // Truncate text if too long (Claude can handle 150k+ chars)
    const MAX_CHARS = 150000
    const truncatedText = pdfText.length > MAX_CHARS 
      ? pdfText.substring(0, MAX_CHARS) + '\n\n[Document truncated due to length...]'
      : pdfText

    // Check if we have enough text
    if (truncatedText.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Could not extract sufficient text from PDF. It may be a scanned image.' },
        { status: 400 }
      )
    }

    // ========================================================================
    // EXTRACTION 1: Requirements (Section C + H only)
    // ========================================================================
    console.log('[extract-rfp] Starting requirements extraction (Section C + H)...')

    const reqMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: REQUIREMENTS_SYSTEM_PROMPT(ceiling),
      messages: [
        {
          role: 'user',
          content: `${REQUIREMENTS_USER_PROMPT(ceiling, pdfPageCount)}\n\nDocument to analyze:\n\n${truncatedText}`
        }
      ],
    })

    const reqResponseText = reqMessage.content[0].type === 'text' ? reqMessage.content[0].text : ''

    if (!reqResponseText) {
      return NextResponse.json(
        { success: false, error: 'No response from AI model for requirements' },
        { status: 500 }
      )
    }

    // Parse the requirements JSON response
    let extracted
    try {
      const jsonStart = reqResponseText.indexOf('{')
      const jsonEnd = reqResponseText.lastIndexOf('}')

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in requirements response')
      }

      const jsonString = reqResponseText.slice(jsonStart, jsonEnd + 1)
      extracted = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse requirements response:', reqResponseText.substring(0, 500))
      return NextResponse.json(
        { success: false, error: 'Failed to parse requirements response' },
        { status: 500 }
      )
    }

    // Validate requirements response
    const validated = extractionResponseSchema.safeParse(extracted)
    if (!validated.success) {
      const issues = validated.error.issues
      console.error('Requirements validation failed:', JSON.stringify(issues, null, 2))
      const issuesSummary = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json(
        {
          success: false,
          error: `AI returned invalid requirements structure: ${issuesSummary}`,
          details: issues
        },
        { status: 500 }
      )
    }

    // Guard rail: dynamic ceiling based on page count
    if (validated.data.requirements.length > ceiling) {
      console.error(`[extract-rfp] Too many requirements: ${validated.data.requirements.length} (ceiling: ${ceiling} for ${pdfPageCount} pages)`)
      return NextResponse.json(
        {
          success: false,
          error: `Extraction returned ${validated.data.requirements.length} requirements. Maximum for a ${pdfPageCount}-page RFP is ${ceiling}. Consolidate further.`
        },
        { status: 400 }
      )
    }

    // Ensure requirement IDs are populated
    const requirements = validated.data.requirements.map((req, index) => ({
      ...req,
      id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
    }))

    console.log(`[extract-rfp] Extracted ${requirements.length} requirements`)

    // ========================================================================
    // EXTRACTION 2: Compliance Matrix (All sections)
    // ========================================================================
    console.log('[extract-rfp] Starting compliance matrix extraction (all sections)...')

    let complianceMatrix: Array<{
      ref: string
      rfpSection: string
      type: string
      text: string
      source: string
      requirementId: string | null
    }> = []

    try {
      const compMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        temperature: 0,
        system: COMPLIANCE_MATRIX_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `${COMPLIANCE_MATRIX_USER_PROMPT}\n\nDocument to analyze:\n\n${truncatedText}`
          }
        ],
      })

      const compResponseText = compMessage.content[0].type === 'text' ? compMessage.content[0].text : ''

      if (compResponseText) {
        // Parse the compliance matrix JSON array
        const jsonStart = compResponseText.indexOf('[')
        const jsonEnd = compResponseText.lastIndexOf(']')

        if (jsonStart !== -1 && jsonEnd !== -1) {
          const rawMatrix = JSON.parse(compResponseText.slice(jsonStart, jsonEnd + 1))

          // Link Section C and H items to requirements by matching ref
          complianceMatrix = rawMatrix.map((item: { ref: string; rfpSection: string; type: string; text: string; source: string }) => {
            let requirementId: string | null = null

            // If this is a Section C or H item, try to link to requirements
            if (item.rfpSection === 'C' || item.rfpSection === 'H') {
              const matchingReq = requirements.find(r => r.id === item.ref)
              requirementId = matchingReq?.id || null
            }

            return {
              ref: item.ref || '',
              rfpSection: item.rfpSection || '',
              type: item.type || '',
              text: item.text || '',
              source: item.source || '',
              requirementId,
            }
          })

          console.log(`[extract-rfp] Extracted ${complianceMatrix.length} compliance items`)
        }
      }
    } catch (compError) {
      // Compliance matrix extraction is not fatal - log and continue
      console.warn('[extract-rfp] Compliance matrix extraction failed:', compError)
    }

    // Build response
    const response: ExtractionResponse & {
      success: boolean
      rawTextLength: number
      solicitationRawText: string
      complianceMatrix: typeof complianceMatrix
    } = {
      success: true,
      ...validated.data,
      requirements,
      complianceMatrix,
      rawTextLength: pdfText.length,
      solicitationRawText: pdfText,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Extraction error:', error)
    
    // Handle Anthropic-specific errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid Anthropic API key' },
          { status: 401 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to extract RFP data' },
      { status: 500 }
    )
  }
}