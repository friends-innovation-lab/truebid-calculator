import { createClient } from '@/lib/supabase/server'

// ==================== TYPES ====================

export interface WritingGuide {
  voice_description: string
  reading_level: string
  sentence_rules: string[]
  words_to_avoid: string[]
  words_to_use: string[]
  structural_rules: string[]
  example_sentences: string
}

const READING_LEVEL_LABELS: Record<string, string> = {
  'grade-8-9': 'Grade 8-9 (Simple, accessible language)',
  'grade-10-11': 'Grade 10-11 (Standard professional)',
  'grade-12+': 'Grade 12+ (Technical, specialized)',
}

// ==================== MAIN FUNCTION ====================

/**
 * Fetches the writing guide from company settings and returns a formatted
 * string ready to inject into any AI system prompt.
 *
 * @param companyId - Optional company ID. If not provided, uses auth to find company.
 * @returns Formatted prompt string, or empty string if no guide exists.
 */
export async function getWritingGuidePrompt(companyId?: string): Promise<string> {
  const supabase = await createClient()

  // Get company ID if not provided
  let targetCompanyId = companyId
  if (!targetCompanyId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!company) return ''
    targetCompanyId = company.id
  }

  // Fetch settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('writing_guide')
    .eq('company_id', targetCompanyId)
    .single()

  if (!settings?.writing_guide) return ''

  const guide = settings.writing_guide as WritingGuide

  // Build the prompt
  return formatWritingGuidePrompt(guide)
}

/**
 * Formats a WritingGuide object into a prompt string for AI injection.
 */
export function formatWritingGuidePrompt(guide: WritingGuide): string {
  const sections: string[] = []

  // Voice description
  if (guide.voice_description?.trim()) {
    sections.push(`Write in our company's voice: ${guide.voice_description.trim()}`)
  }

  // Reading level
  if (guide.reading_level) {
    const label = READING_LEVEL_LABELS[guide.reading_level] || guide.reading_level
    sections.push(`Reading level target: ${label}`)
  }

  // Sentence rules
  if (guide.sentence_rules?.length > 0) {
    const rules = guide.sentence_rules
      .filter(r => r.trim())
      .map(r => `- ${r}`)
      .join('\n')
    if (rules) {
      sections.push(`Sentence rules:\n${rules}`)
    }
  }

  // Words to avoid
  if (guide.words_to_avoid?.length > 0) {
    const words = guide.words_to_avoid.filter(w => w.trim()).join(', ')
    if (words) {
      sections.push(`Never use these words: ${words}`)
    }
  }

  // Words to use
  if (guide.words_to_use?.length > 0) {
    const words = guide.words_to_use.filter(w => w.trim()).join(', ')
    if (words) {
      sections.push(`Prefer this language: ${words}`)
    }
  }

  // Structural rules
  if (guide.structural_rules?.length > 0) {
    const rules = guide.structural_rules
      .filter(r => r.trim())
      .map(r => `- ${r}`)
      .join('\n')
    if (rules) {
      sections.push(`Structural rules:\n${rules}`)
    }
  }

  // Example sentences
  if (guide.example_sentences?.trim()) {
    sections.push(`Examples of our company's writing style:\n${guide.example_sentences.trim()}`)
  }

  if (sections.length === 0) return ''

  return `
COMPANY WRITING GUIDE:
======================
${sections.join('\n\n')}
======================
`
}

/**
 * Fetches the writing guide for use in coaching evaluations.
 * Returns both the formatted prompt and the raw guide data.
 */
export async function getWritingGuideForCoaching(companyId?: string): Promise<{
  prompt: string
  guide: WritingGuide | null
}> {
  const supabase = await createClient()

  // Get company ID if not provided
  let targetCompanyId = companyId
  if (!targetCompanyId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { prompt: '', guide: null }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!company) return { prompt: '', guide: null }
    targetCompanyId = company.id
  }

  // Fetch settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('writing_guide')
    .eq('company_id', targetCompanyId)
    .single()

  if (!settings?.writing_guide) return { prompt: '', guide: null }

  const guide = settings.writing_guide as WritingGuide
  const prompt = formatWritingGuidePrompt(guide)

  return { prompt, guide }
}
