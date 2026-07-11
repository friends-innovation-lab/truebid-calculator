/**
 * Token-aware truncation utilities
 *
 * Provides honest truncation with user-visible warnings instead of silent slicing.
 */

// Approximate tokens per character for English text
// Claude tokenizer averages ~4 characters per token for English prose
const CHARS_PER_TOKEN = 4

// Model context limits (tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-sonnet-4-6': 200_000,
  'claude-opus-4-5-20251101': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
}

// Default budget allocation for different prompt components
const DEFAULT_BUDGETS = {
  // For extraction prompts: reserve tokens for system prompt, response, and safety margin
  extraction: {
    systemPromptReserve: 2000,  // tokens for system prompt
    responseReserve: 4000,      // tokens for expected response
    safetyMargin: 1000,         // buffer for token estimation error
  },
  // For WBS generation: needs more response budget
  wbs: {
    systemPromptReserve: 8000,  // larger system prompt
    responseReserve: 16000,     // WBS responses are large
    safetyMargin: 2000,
  },
}

export interface TruncationResult {
  text: string
  wasTruncated: boolean
  originalCharCount: number
  truncatedCharCount: number
  estimatedTokens: number
  budgetTokens: number
  warning?: string
}

/**
 * Estimate token count from character count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Calculate available tokens for user content given model and prompt type
 */
export function calculateContentBudget(
  model: string,
  promptType: 'extraction' | 'wbs'
): number {
  const contextLimit = MODEL_CONTEXT_LIMITS[model] || 200_000
  const budget = DEFAULT_BUDGETS[promptType]

  return contextLimit - budget.systemPromptReserve - budget.responseReserve - budget.safetyMargin
}

/**
 * Truncate text to fit within token budget with honest reporting
 */
export function truncateToTokenBudget(
  text: string,
  budgetTokens: number
): TruncationResult {
  const originalCharCount = text.length
  const estimatedTokens = estimateTokens(text)

  if (estimatedTokens <= budgetTokens) {
    return {
      text,
      wasTruncated: false,
      originalCharCount,
      truncatedCharCount: originalCharCount,
      estimatedTokens,
      budgetTokens,
    }
  }

  // Calculate target character count from token budget
  const targetChars = budgetTokens * CHARS_PER_TOKEN

  // Truncate at a sentence boundary if possible
  let truncatedText = text.slice(0, targetChars)
  const lastSentenceEnd = Math.max(
    truncatedText.lastIndexOf('. '),
    truncatedText.lastIndexOf('.\n'),
    truncatedText.lastIndexOf('? '),
    truncatedText.lastIndexOf('! ')
  )

  if (lastSentenceEnd > targetChars * 0.8) {
    truncatedText = truncatedText.slice(0, lastSentenceEnd + 1)
  }

  const truncatedCharCount = truncatedText.length
  const percentTruncated = Math.round((1 - truncatedCharCount / originalCharCount) * 100)

  return {
    text: truncatedText,
    wasTruncated: true,
    originalCharCount,
    truncatedCharCount,
    estimatedTokens: estimateTokens(truncatedText),
    budgetTokens,
    warning: `Document truncated: ${percentTruncated}% of content (${originalCharCount.toLocaleString()} chars) was removed to fit model context window. Some information may be missing from extraction.`
  }
}

/**
 * Prepare solicitation text for extraction with truncation honesty
 */
export function prepareSolicitationForExtraction(
  solicitationText: string,
  model: string = 'claude-sonnet-4-6'
): TruncationResult {
  const budget = calculateContentBudget(model, 'extraction')
  return truncateToTokenBudget(solicitationText, budget)
}

/**
 * Prepare requirements for WBS generation with truncation honesty
 */
export function prepareRequirementsForWbs(
  requirementsText: string,
  model: string = 'claude-sonnet-4-6'
): TruncationResult {
  const budget = calculateContentBudget(model, 'wbs')
  return truncateToTokenBudget(requirementsText, budget)
}
