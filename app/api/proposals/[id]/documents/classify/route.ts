import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Document Classification API
 * Phase 4B Pillar 1: Multi-Document Ingestion
 *
 * Classifies a solicitation document by type using AI.
 * Returns structured classification with confidence and suggested precedence.
 */

// Request schema
const classifyRequestSchema = z.object({
  documentId: z.string().uuid(),
})

// Classification result schema
const classificationResultSchema = z.object({
  documentType: z.enum(['pws_sow', 'instructions', 'qa_amendment', 'pricing_template', 'other']),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
})

// Classification prompt - uses fast model for cost efficiency
const CLASSIFICATION_SYSTEM_PROMPT = `You are classifying a government solicitation document by type.

Document types:
- pws_sow: Performance Work Statement or Statement of Work (scope, deliverables, technical requirements, CLIN structure for services)
- instructions: RFQ/RFP instructions, evaluation criteria, submission requirements, pricing instructions, terms and conditions
- qa_amendment: Questions & Answers document, or Amendment modifying prior content (these supersede earlier documents)
- pricing_template: Pricing tables, cost breakdown forms, labor rate templates, Excel-based price sheets
- other: Reference documents, attachments, organizational charts, past performance templates

Classification signals:
- pws_sow: "Performance Work Statement", "Statement of Work", numbered requirements (1.0, 2.0), "shall provide", "deliverables", "CLIN"
- instructions: "Instructions to Offerors", "Evaluation Criteria", "Section L", "Section M", "FAR 52.", "submission format"
- qa_amendment: "Amendment", "Questions and Answers", "Q&A", "Modification", dates of questions/responses
- pricing_template: Labor category tables, rate columns, "Year 1", "Option Year", pricing cells
- other: Org charts, resumes, boilerplate attachments

Return ONLY a JSON object with these fields:
- documentType: one of the enum values above
- confidence: 0.0-1.0 (high if clear signals, low if ambiguous)
- rationale: one sentence explaining the classification

Do not include any other text or markdown formatting.`

// Default precedence by document type
const DEFAULT_PRECEDENCE: Record<string, number> = {
  qa_amendment: 30,
  instructions: 20,
  pws_sow: 10,
  pricing_template: 5,
  other: 0,
}

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
    // Parse and validate request body
    const body = await request.json()
    const parseResult = classifyRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { documentId } = parseResult.data

    // Fetch the document record
    const { data: doc, error: fetchError } = await supabase
      .from('solicitation_documents')
      .select('id, proposal_id, filename, raw_text, status')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      console.error('Failed to fetch document:', fetchError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify document belongs to this proposal
    if (doc.proposal_id !== proposalId) {
      return NextResponse.json(
        { error: 'Document does not belong to this proposal' },
        { status: 403 }
      )
    }

    // Check for raw_text (must be extracted first)
    if (!doc.raw_text || doc.raw_text.length < 100) {
      return NextResponse.json(
        { error: 'Document text not available. Extract text first.' },
        { status: 400 }
      )
    }

    // Truncate to first 5000 chars for classification (sufficient for type detection)
    const textForClassification = doc.raw_text.slice(0, 5000)

    // Call Claude for classification (use fast model)
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', // Fast model for classification
      max_tokens: 200,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify this document:\n\nFILENAME: ${doc.filename}\n\nDOCUMENT TEXT (first 5000 chars):\n${textForClassification}`,
        },
      ],
    })

    // Extract text response
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[classify] No text response from AI')
      return NextResponse.json(
        { error: 'AI did not return classification' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let classification: z.infer<typeof classificationResultSchema>
    try {
      // Remove any markdown code fences if present
      const cleanedText = textBlock.text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()

      const parsed = JSON.parse(cleanedText)
      const validated = classificationResultSchema.safeParse(parsed)

      if (!validated.success) {
        console.error('[classify] Invalid classification schema:', validated.error.issues)
        return NextResponse.json(
          { error: 'AI returned invalid classification format' },
          { status: 500 }
        )
      }

      classification = validated.data
    } catch (parseError) {
      console.error('[classify] Failed to parse AI response:', textBlock.text)
      return NextResponse.json(
        { error: 'Failed to parse AI classification response' },
        { status: 500 }
      )
    }

    // Update the document record with classification
    const { error: updateError } = await supabase
      .from('solicitation_documents')
      .update({
        doc_type: classification.documentType,
        doc_type_source: 'ai_classified',
        classification_confidence: classification.confidence,
        classification_rationale: classification.rationale,
        precedence_rank: DEFAULT_PRECEDENCE[classification.documentType] || 0,
        status: 'classified',
        classified_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('[classify] Failed to update document:', updateError)
      return NextResponse.json(
        { error: 'Failed to save classification' },
        { status: 500 }
      )
    }

    console.log(`[classify] Document ${documentId} classified as ${classification.documentType} (${classification.confidence.toFixed(2)} confidence)`)

    return NextResponse.json({
      documentId,
      documentType: classification.documentType,
      confidence: classification.confidence,
      rationale: classification.rationale,
      suggestedPrecedence: DEFAULT_PRECEDENCE[classification.documentType] || 0,
    })
  } catch (error) {
    console.error('Document classification error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again.' },
          { status: 429 }
        )
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to classify document: ${errorMessage}` },
      { status: 500 }
    )
  }
}
