import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildShipleyDocumentSource } from '@/lib/shipley'
import crypto from 'crypto'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface CoachingScores {
  understanding: number
  approach: number
  proof: number
  risk_mitigation: number
  win_theme_alignment: number
}

interface FeedbackItem {
  category: string
  severity: 'critical' | 'important' | 'suggestion'
  issue: string
  recommendation: string
  example?: string
}

interface CoachingResult {
  scores: CoachingScores
  overall_assessment: string
  feedback: FeedbackItem[]
}

// Generate a hash of the content for staleness detection
function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

// POST — run coaching on this section
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, sectionId } = await params

  // 1. Fetch section content_text
  const { data: section, error: sectionError } = await supabase
    .from('proposal_sections')
    .select('id, title, content_text, compliance_item_ids')
    .eq('id', sectionId)
    .single()

  if (sectionError || !section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  if (!section.content_text || section.content_text.trim().length === 0) {
    return NextResponse.json(
      { error: 'Write some content first' },
      { status: 400 }
    )
  }

  // 2. Fetch proposal strategy (win themes)
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('strategy, ai_summary')
    .eq('id', proposalId)
    .single()

  if (proposalError) {
    console.error('[Coach API] Failed to fetch proposal:', proposalError)
  }

  const strategy = proposal?.strategy as {
    winThemes?: string[]
    decision?: string
  } | null
  const aiSummary = proposal?.ai_summary as {
    evaluation_emphasis?: string
  } | null

  // 3. Fetch compliance items this section addresses
  let complianceContext = ''
  const complianceIds = section.compliance_item_ids || []
  if (complianceIds.length > 0) {
    const { data: complianceItems } = await supabase
      .from('compliance_items')
      .select('reference_number, requirement_type, text')
      .in('id', complianceIds)

    if (complianceItems && complianceItems.length > 0) {
      complianceContext = complianceItems
        .map(item => `- ${item.reference_number} (${item.requirement_type}): ${item.text}`)
        .join('\n')
    }
  }

  // Format win themes
  const winThemes = strategy?.winThemes?.filter(t => t.trim().length > 0) || []
  const winThemesText = winThemes.length > 0
    ? winThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : 'No win themes defined'

  // Format evaluation emphasis
  const evaluationEmphasis = aiSummary?.evaluation_emphasis || 'Not specified'

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    // Return mock data for testing
    const mockResult: CoachingResult = {
      scores: {
        understanding: 3,
        approach: 3,
        proof: 2,
        risk_mitigation: 2,
        win_theme_alignment: 3,
      },
      overall_assessment: 'This section needs more specific evidence and proof points. Consider adding metrics, past performance examples, and explicit risk mitigation strategies.',
      feedback: [
        {
          category: 'Proof',
          severity: 'critical',
          issue: 'No quantifiable metrics or evidence provided',
          recommendation: 'Add specific numbers, percentages, or measurements that demonstrate capability',
          example: 'Instead of "We have extensive experience", write "We have delivered 15+ similar projects with 98% on-time completion"',
        },
        {
          category: 'Risk Mitigation',
          severity: 'important',
          issue: 'Risks are not explicitly addressed',
          recommendation: 'Identify 2-3 key risks and describe your mitigation approach',
        },
      ],
    }

    // Save mock coaching result
    const contentHash = hashContent(section.content_text)
    await supabase.from('section_coaching').insert({
      section_id: sectionId,
      proposal_id: proposalId,
      scores: mockResult.scores,
      feedback: mockResult.feedback,
      overall_assessment: mockResult.overall_assessment,
      content_snapshot: contentHash,
    })

    return NextResponse.json({ coaching: mockResult, mock: true })
  }

  // Build the prompt
  const coachingPrompt = `You are a red team reviewer evaluating a government proposal section against Shipley methodology.

Section title: ${section.title}
Section content:
---
${section.content_text}
---

Win themes this section should reinforce:
${winThemesText}

What evaluators care most about for this proposal:
${evaluationEmphasis}

Requirements this section must address:
${complianceContext || 'None specified'}

Evaluate this section and return a JSON object:
{
  "scores": {
    "understanding": number (1-5),
    "approach": number (1-5),
    "proof": number (1-5),
    "risk_mitigation": number (1-5),
    "win_theme_alignment": number (1-5)
  },
  "overall_assessment": string (2-3 sentences),
  "feedback": [
    {
      "category": string,
      "severity": "critical" | "important" | "suggestion",
      "issue": string (what is missing or weak),
      "recommendation": string (specific fix),
      "example": string (optional — example of stronger language)
    }
  ]
}

Shipley criteria to evaluate against:
- Understanding: Does the section show deep understanding of the government's problem?
- Approach: Is the technical/management approach clear, specific, and credible?
- Proof: Are claims backed by evidence, examples, metrics, or past performance?
- Risk Mitigation: Are risks acknowledged and mitigation strategies described?
- Win Theme Alignment: Does the section reinforce the company's discriminators?

Be specific and actionable. Identify gaps, not generic suggestions.
Return only valid JSON. No preamble.`

  try {
    // Check if Shipley PDF URL is available
    let messageContent: Anthropic.Messages.ContentBlockParam[]
    try {
      const shipleyDoc = buildShipleyDocumentSource()
      messageContent = [
        shipleyDoc as Anthropic.Messages.ContentBlockParam,
        { type: 'text', text: coachingPrompt },
      ]
    } catch {
      // Shipley PDF not available, proceed without it
      messageContent = [
        { type: 'text', text: coachingPrompt },
      ]
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: messageContent },
      ],
    })

    // Extract text response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse the response
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()

    let result: CoachingResult
    try {
      result = JSON.parse(jsonText)
    } catch {
      console.error('[Coach API] Failed to parse response:', jsonText.slice(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse coaching response' },
        { status: 500 }
      )
    }

    // Save coaching result to database
    const contentHash = hashContent(section.content_text)
    const { data: coaching, error: insertError } = await supabase
      .from('section_coaching')
      .insert({
        section_id: sectionId,
        proposal_id: proposalId,
        scores: result.scores,
        feedback: result.feedback,
        overall_assessment: result.overall_assessment,
        content_snapshot: contentHash,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Coach API] Failed to save coaching:', insertError)
      // Still return the result even if save failed
    }

    return NextResponse.json({
      coaching: {
        id: coaching?.id,
        ...result,
        generatedAt: coaching?.generated_at || new Date().toISOString(),
        contentSnapshot: contentHash,
      },
    })

  } catch (error) {
    console.error('[Coach API] Error:', error)

    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; message?: string }
      return NextResponse.json(
        { error: `AI error: ${apiError.message || 'Unknown'}` },
        { status: apiError.status }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET — fetch coaching history for this section
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sectionId } = await params

  // Fetch current section content hash
  const { data: section } = await supabase
    .from('proposal_sections')
    .select('content_text')
    .eq('id', sectionId)
    .single()

  const currentHash = section?.content_text
    ? hashContent(section.content_text)
    : null

  // Fetch coaching history
  const { data: coachingHistory, error } = await supabase
    .from('section_coaching')
    .select('*')
    .eq('section_id', sectionId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('[Coach API] Failed to fetch history:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if latest coaching is stale
  const latestCoaching = coachingHistory?.[0]
  const isStale = latestCoaching && currentHash
    ? latestCoaching.content_snapshot !== currentHash
    : false

  return NextResponse.json({
    history: coachingHistory || [],
    currentHash,
    isStale,
  })
}
