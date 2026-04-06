import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWritingGuideForCoaching } from '@/lib/writing-guide'

// POST — run coaching on collaborate content (public, token-based auth)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
  const { token } = await params

  // Validate token and get link info
  const { data: link, error: linkError } = await supabase
    .from('collab_section_links')
    .select('id, proposal_id, section_ids, submission_status')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  // Get content from request body
  let content: string | null = null
  let title: string | null = null
  try {
    const body = await request.json()
    content = body.content || null
    title = body.title || null
  } catch {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: 'Write some content first' }, { status: 400 })
  }

  // Fetch proposal for win themes
  const { data: proposal } = await supabase
    .from('proposals')
    .select('strategy')
    .eq('id', link.proposal_id)
    .single()

  const strategy = proposal?.strategy as { winThemes?: string[] } | null
  const winThemes = strategy?.winThemes?.filter(t => t.trim().length > 0) || []
  const winThemesText = winThemes.length > 0
    ? winThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : 'No win themes defined'

  // Get writing guide
  const { prompt: writingGuidePrompt, guide: writingGuide } = await getWritingGuideForCoaching()

  let writingGuideEvaluation = ''
  if (writingGuide) {
    const wordsToAvoidList = writingGuide.words_to_avoid?.length
      ? writingGuide.words_to_avoid.join(', ')
      : ''
    writingGuideEvaluation = `
Company Writing Guide to evaluate against:
${writingGuidePrompt}
${wordsToAvoidList ? `Flag any use of these forbidden words: ${wordsToAvoidList}` : ''}
`
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    // Return mock data for testing
    return NextResponse.json({
      coaching: {
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
          },
        ],
      },
      mock: true,
    })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const coachingPrompt = `You are a red team reviewer evaluating a government proposal section against Shipley methodology.

Section title: ${title || 'Section'}
Section content:
---
${content}
---

Win themes this section should reinforce:
${winThemesText}

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
      "recommendation": string (specific fix)
    }
  ]
}

Shipley criteria:
- Understanding: Does the section show deep understanding of the government's problem?
- Approach: Is the technical/management approach clear, specific, and credible?
- Proof: Are claims backed by evidence, examples, metrics, or past performance?
- Risk Mitigation: Are risks acknowledged and mitigation strategies described?
- Win Theme Alignment: Does the section reinforce the company's discriminators?
${writingGuideEvaluation}
Be specific and actionable. Return only valid JSON. No preamble.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: coachingPrompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse JSON response
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7)
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3)
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3)
    jsonText = jsonText.trim()

    const result = JSON.parse(jsonText)

    return NextResponse.json({ coaching: result })
  } catch (error) {
    console.error('[Collaborate Coach API] Error:', error)
    return NextResponse.json({ error: 'Coaching failed' }, { status: 500 })
  }
}
