import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'
import { extractionResponseSchema, type ExtractionResponse } from '@/lib/schemas/rfp'

// System prompt for extraction
const EXTRACTION_PROMPT = `Extract data from this government RFP/SOW. Return ONLY valid JSON, no markdown or explanation.

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
  "requirements": [],
  "suggestedRoles": []
}

METADATA RULES:
- periodOfPerformance.base = number of BASE YEARS (usually 1)
- periodOfPerformance.options = number of OPTION YEARS (0-4, NOT months)
- Look for "1 base year + 2 option years" type language
- clientAgency: DOS/State Department = "Department of State"

EXTRACT 30-40 REQUIREMENTS from ALL these categories:
1. USER STORIES: "As a [user], I want..." - type: "delivery"
2. SECURITY: clearances, MRPT, authentication, OKTA, FedRAMP - type: "compliance"
3. INFRASTRUCTURE: AWS, S3, Lambda, ECS, CloudFront, databases - type: "delivery"
4. DEVELOPMENT: features, APIs, integrations, screens, functionality - type: "delivery"
5. COMPLIANCE: Section 508, WCAG, accessibility standards - type: "compliance"
6. OPERATIONS: support, monitoring, maintenance, SLAs - type: "delivery"
7. STAFFING: labor categories, key personnel, qualifications - type: "staffing"
8. REPORTING: status reports, deliverables, documentation - type: "reporting"
9. GOVERNANCE: meetings, reviews, approvals - type: "governance"

Search ALL sections including: Objectives, Operating Constraints, Key Personnel, Security, Technical Requirements.

Each requirement format:
{"id": "REQ-001", "title": "3-6 word title you create", "text": "verbatim text from document (can be full sentence)", "type": "delivery|staffing|compliance|reporting|governance|other", "sourceSection": "actual section header from document", "pageNumber": null}

IMPORTANT: Extract REAL values from the document. Response must start with { and end with }`

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

    // Call Claude for extraction - Using Sonnet 3.5 for better quality and higher token limit
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nDocument to analyze:\n\n${truncatedText}`
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

    // Ensure requirement IDs are populated
    const requirements = validated.data.requirements.map((req, index) => ({
      ...req,
      id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
    }))

    const response: ExtractionResponse & { success: boolean; rawTextLength: number } = {
      success: true,
      ...validated.data,
      requirements,
      rawTextLength: pdfText.length,
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