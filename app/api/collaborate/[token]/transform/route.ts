import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// POST — Transform collaborator draft to FFTC voice
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  // Find link
  const { data: link, error: linkError } = await supabase
    .from('collab_section_links')
    .select('*')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const submissionContent = link.submission_content as { html?: string } | null
  if (!submissionContent?.html) {
    return NextResponse.json({ error: 'No submission content to transform' }, { status: 400 })
  }

  // Load writing guide from company settings
  let writingGuideText = ''
  let wordsToAvoid = ''
  if (link.company_id) {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('writing_guide')
      .eq('company_id', link.company_id)
      .single()

    const guide = settings?.writing_guide as {
      voice_description?: string
      sentence_rules?: string[]
      words_to_avoid?: string[]
      example_sentences?: string
    } | null

    if (guide) {
      const parts: string[] = []
      if (guide.voice_description) parts.push(`Voice: ${guide.voice_description}`)
      if (guide.sentence_rules?.length) parts.push(`Rules:\n${guide.sentence_rules.map(r => `- ${r}`).join('\n')}`)
      if (guide.example_sentences) parts.push(`Example sentences:\n${guide.example_sentences}`)
      writingGuideText = parts.join('\n\n')
      wordsToAvoid = guide.words_to_avoid?.join(', ') || ''
    }
  }

  // Load win themes from proposal
  if (link.proposal_id) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('strategy')
      .eq('id', link.proposal_id)
      .single()

    const strategy = proposal?.strategy as { winThemes?: string[] } | null
    if (strategy?.winThemes?.length) {
      writingGuideText += `\n\nWin themes to weave in:\n${strategy.winThemes.map(t => `- ${t}`).join('\n')}`
    }
  }

  // Call Claude
  const client = new Anthropic()

  const systemPrompt = `You are transforming a collaborator's draft into FFTC's voice. Preserve every fact, number, specific claim, and piece of past performance cited. Do not add or remove information. Only change the language.

${writingGuideText ? `Apply these rules:\n${writingGuideText}` : ''}

${wordsToAvoid ? `Never use: ${wordsToAvoid}` : ''}
Never use em dashes.
Use "Friends From The City" on first reference, "Friends" thereafter. Never "FFTC."

Return only the transformed HTML content. No explanation, no markdown code fences.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Transform this draft into FFTC's voice. Preserve all facts and specific claims exactly.\n\nORIGINAL DRAFT:\n${submissionContent.html}\n\nReturn only the transformed content as HTML.`,
        },
      ],
    })

    const transformed = message.content[0].type === 'text' ? message.content[0].text : ''

    // Update record
    await supabase
      .from('collab_section_links')
      .update({
        transformed_content: { html: transformed },
        submission_status: 'transform_pending',
      })
      .eq('id', link.id)

    return NextResponse.json({ transformed })
  } catch (error) {
    console.error('[POST /api/collaborate/[token]/transform] Error:', error)
    return NextResponse.json({ error: 'Transform failed' }, { status: 500 })
  }
}
