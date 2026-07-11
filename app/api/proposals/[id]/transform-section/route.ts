import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Words and phrases to avoid in FFTC voice
const WORDS_TO_AVOID = [
  'utilize', 'utilization', 'leverage', 'leveraging',
  'synergy', 'synergies', 'synergistic',
  'paradigm', 'paradigm shift',
  'robust', 'scalable', 'seamless', 'seamlessly',
  'cutting-edge', 'state-of-the-art', 'best-in-class',
  'holistic', 'holistically',
  'optimize', 'optimization',
  'proactive', 'proactively',
  'innovative', 'innovation',
  'strategic', 'strategically',
  'impactful',
  'actionable',
  'bandwidth',
  'deep dive',
  'move the needle',
  'low-hanging fruit',
  'circle back',
  'touch base',
  'take it offline',
  'at the end of the day',
  'going forward',
  'in terms of',
  'in order to',
  'due to the fact that',
  'at this point in time',
  'FFTC', // Always spell out "Friends From The City"
]

const WRITING_GUIDE = `
# FFTC Voice and Style Guide

## Core Principles
1. Write in active voice. Subject → Verb → Object.
2. Keep sentences short. Average 15-20 words.
3. Use concrete, specific language. Numbers over adjectives.
4. Write for the evaluator who's reading 50 proposals.

## Company Name
- First reference: "Friends From The City" (full name)
- Subsequent references: "Friends" (not "FFTC", not "the company")

## Sentence Structure
- Lead with the benefit or outcome
- One idea per sentence
- Vary sentence length for rhythm

## Formatting
- No em dashes (—). Use commas or periods instead.
- Use hyphens only for compound adjectives before nouns
- Serial comma (Oxford comma) always

## Tone
- Confident but not arrogant
- Specific but not verbose
- Professional but approachable
- Direct but respectful

## Technical Writing
- Define acronyms on first use
- Use parallel structure in lists
- Start bullet points with action verbs
- Quantify claims when possible
`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params
  const body = await request.json()
  const { sectionId, content } = body

  if (!sectionId || !content) {
    return NextResponse.json({ error: 'sectionId and content are required' }, { status: 400 })
  }

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    const systemPrompt = `You are an expert editor transforming proposal content into Friends From The City's (FFTC) voice and style.

Your task is to improve the language while preserving every fact, number, specific claim, and past performance reference exactly. Do not add or remove information. Only improve the writing.

${WRITING_GUIDE}

## Words and Phrases to Avoid
Never use these: ${WORDS_TO_AVOID.join(', ')}

## Critical Rules
- No em dashes (—). Replace with commas or periods.
- Use "Friends From The City" on first reference, "Friends" thereafter. Never "FFTC".
- Preserve all HTML tags exactly as they appear.
- Do not change any numbers, dates, contract names, or proper nouns.
- Keep technical terms and acronyms unchanged.`

    const userPrompt = `Transform this proposal section content into FFTC voice. Return only the transformed HTML content, nothing else.

${content}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    })

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text')
    const transformed = textBlock?.text || content

    return NextResponse.json({ transformed })
  } catch (error) {
    console.error('[POST /api/proposals/[id]/transform-section] Error:', error)
    return NextResponse.json(
      { error: 'Transform failed' },
      { status: 500 }
    )
  }
}
