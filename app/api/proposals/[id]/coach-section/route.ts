import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWritingGuideForCoaching } from '@/lib/writing-guide'

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

  const { id: proposalId } = await params
  const body = await request.json()
  const { sectionId, content } = body

  if (!sectionId || !content) {
    return NextResponse.json({ error: 'sectionId and content required' }, { status: 400 })
  }

  // Fetch proposal data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, strategy, company_id')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const strategy = (proposal.strategy || {}) as Record<string, unknown>

  // Get writing guide from company settings
  const { prompt: writingGuidePrompt, guide: writingGuide } = await getWritingGuideForCoaching(proposal.company_id)
  const wordsToAvoid = writingGuide?.words_to_avoid?.filter(w => w.trim()) || []

  // Get win themes
  const winThemes = (strategy.winThemes as string[]) || []

  // Find section requirements
  interface OutlineSec { id: string; requirementRefs?: string[]; complianceRefs?: string[] }
  const outline = (workingData.outline || {}) as { volumes?: { sections?: OutlineSec[] }[] }
  const allSections = (outline.volumes || []).flatMap(v => v.sections || [])
  const sectionData = allSections.find(s => s.id === sectionId) || null

  const reqRefs = sectionData?.requirementRefs || []
  const extractedRequirements = (workingData.extractedRequirements || []) as { id: string; text?: string; description?: string; title: string; reference_number?: string }[]
  const relatedReqs = extractedRequirements.filter(r => {
    const ref = r.reference_number || r.id
    return reqRefs.includes(ref)
  })

  // Truncate very long content to avoid token limits
  const maxContentLength = 8000
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '\n\n[Content truncated for scoring...]'
    : content

  const userPrompt = `Score this government proposal section on 6 Shipley dimensions (1.0-5.0 each):

1. Customer focus: Does it center on what the customer gets, not what the vendor does?
2. Win themes: Are the win themes woven in naturally?
3. Discriminators: Does it show why FFTC specifically, not just any vendor?
4. Proof points: Are claims backed by specific evidence, numbers, or examples?
5. Compliance: Does it address the stated requirements?
6. Writing style: Does it follow the company writing guide? Are banned words avoided?

${winThemes.filter(t => t?.trim()).length > 0 ? `Win themes for this proposal:\n${winThemes.filter(t => t?.trim()).join('\n')}` : 'No win themes defined yet.'}

${relatedReqs.length > 0 ? `Requirements this section must address:\n${relatedReqs.map(r => r.text || r.description || r.title).join('\n')}` : 'No specific requirements linked to this section.'}

${wordsToAvoid.length > 0 ? `WORDS TO AVOID (flag if found):\n${wordsToAvoid.join(', ')}` : ''}

${writingGuidePrompt ? `COMPANY WRITING GUIDE:\n${writingGuidePrompt}` : ''}

SECTION CONTENT:
${truncatedContent}

Return ONLY valid JSON, no other text:
{
  "overall": 3.8,
  "scores": {
    "customerFocus": 4.0,
    "winThemes": 3.6,
    "discriminators": 3.0,
    "proofPoints": 2.8,
    "compliance": 4.4,
    "writingStyle": 4.0
  },
  "feedback": [
    {
      "type": "issue",
      "title": "Short title",
      "text": "Specific actionable feedback."
    }
  ]
}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Check if response was truncated
    if (message.stop_reason === 'max_tokens') {
      console.error('[coach-section] Response truncated - max_tokens reached')
      return NextResponse.json({ error: 'AI response was truncated. Try with shorter content.' }, { status: 500 })
    }

    let parsed
    try {
      // Extract JSON from response - handle markdown fences anywhere
      let jsonStr = responseText

      // Try to extract from markdown code block first
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim()
      }

      // Find the JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[coach-section] No JSON found in:', responseText.substring(0, 500))
        return NextResponse.json({ error: 'AI did not return valid JSON' }, { status: 500 })
      }

      parsed = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('[coach-section] Parse failed:', responseText.substring(0, 800), parseErr)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Save to DB
    console.log('[coach-section] Attempting upsert for:', { proposalId, sectionId })

    const { data: upsertData, error: upsertError } = await supabase
      .from('section_coaching')
      .upsert({
        proposal_id: proposalId,
        section_id: sectionId,
        scores: parsed.scores,
        overall_assessment: String(parsed.overall),
        feedback: parsed.feedback,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'proposal_id,section_id'
      })
      .select()

    console.log('[coach-section] Upsert result:', {
      data: upsertData,
      error: upsertError ? JSON.stringify(upsertError) : null
    })

    if (upsertError) {
      console.error('[coach-section] Failed to save coaching:', upsertError)
      // Still return the coaching result even if save failed
    }

    return NextResponse.json({ coaching: parsed })

  } catch (error) {
    console.error('[coach-section] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
