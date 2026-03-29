import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'
import { extractionResponseSchema, type ExtractionResponse } from '@/lib/schemas/rfp'

// System prompt for extraction
const EXTRACTION_SYSTEM_PROMPT = `You are a senior proposal manager at a government contracting firm. Your job is to extract only the requirements that directly affect how the proposal is written and evaluated.

Think like someone who has to write a response to this RFP. What are the distinct things you need to address, prove, or comply with? Extract those — nothing else.

STRICT RULES:
1. Maximum 25 requirements total
2. Each requirement must be meaningfully distinct — no overlaps, no sub-clauses of another requirement
3. Consolidate related items — if there are 5 bullets about security, that is ONE requirement: the security requirement
4. Skip entirely:
   - FAR/DFAR boilerplate clauses
   - Payment, invoicing, reporting admin
   - Any requirement already captured in another item
   - General statements of work that don't add a distinct compliance obligation
5. Ask yourself: 'If I missed this, would the proposal be non-compliant or score lower?' If no — skip it.

Target: 15–25 requirements for a typical scoped federal RFP. If you are finding more, you are being too granular. Consolidate.`

const EXTRACTION_USER_PROMPT = `Extract the key proposal requirements and metadata from this RFP. Be selective — aim for 15 to 25 total requirements maximum.

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
      "type": "shall|should|instruction|evaluation",
      "sourceSection": "Section C · p.12"
    }
  ],
  "suggestedRoles": []
}

METADATA RULES:
- periodOfPerformance.base = number of BASE YEARS (usually 1)
- periodOfPerformance.options = number of OPTION YEARS (0-4, NOT months)
- clientAgency: DOS/State Department = "Department of State"

REQUIREMENT NUMBERING:
- REQ-001, REQ-002... for technical and performance requirements (Section C, H etc.)
- L.1, L.2... for Section L submission and formatting instructions
- M.1, M.2... for Section M evaluation criteria

TYPE VALUES:
- 'shall' — mandatory requirement
- 'should' — preferred/desired
- 'instruction' — Section L formatting rule
- 'evaluation' — Section M eval factor

SOURCE FORMAT: 'Section [LETTER] · p.[N]'
Use section letter, not heading name. Examples: 'Section C · p.8', 'Section L · p.31'

If you find more than 25 requirements, consolidate further until you are at 25 or fewer. Response must start with { and end with }`

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
    try {
      const { text } = await extractText(buffer, { mergePages: true })
      pdfText = text
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError)
      return NextResponse.json(
        { success: false, error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
        { status: 400 }
      )
    }

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

    // Call Claude for extraction - Using Sonnet for better quality
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_USER_PROMPT}\n\nDocument to analyze:\n\n${truncatedText}`
        }
      ],
    })

    // Get response text
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    if (!responseText) {
      return NextResponse.json(
        { success: false, error: 'No response from AI model' },
        { status: 500 }
      )
    }

    // Parse the JSON response - strip any preamble text
    let extracted
    try {
      const jsonStart = responseText.indexOf('{')
      const jsonEnd = responseText.lastIndexOf('}')
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in response')
      }
      
      const jsonString = responseText.slice(jsonStart, jsonEnd + 1)
      extracted = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500))
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Validate AI response with Zod schema (applies defaults for missing fields)
    const validated = extractionResponseSchema.safeParse(extracted)
    if (!validated.success) {
      const issues = validated.error.issues
      console.error('AI response validation failed:', JSON.stringify(issues, null, 2))
      console.error('Raw AI response structure:', JSON.stringify(extracted, null, 2).substring(0, 2000))

      // Build a more informative error message
      const issuesSummary = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json(
        {
          success: false,
          error: `AI returned invalid data structure: ${issuesSummary}`,
          details: issues
        },
        { status: 500 }
      )
    }

    // Guard rail: max 25 requirements
    if (validated.data.requirements.length > 25) {
      console.error(`[extract-rfp] Too many requirements: ${validated.data.requirements.length}`)
      return NextResponse.json(
        {
          success: false,
          error: `Extraction returned ${validated.data.requirements.length} requirements. Maximum is 25. Please re-extract with a more consolidated approach.`
        },
        { status: 400 }
      )
    }

    // Ensure requirement IDs are populated
    const requirements = validated.data.requirements.map((req, index) => ({
      ...req,
      id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
    }))

    const response: ExtractionResponse & { success: boolean; rawTextLength: number; solicitationRawText: string } = {
      success: true,
      ...validated.data,
      requirements,
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