/**
 * Extraction Prompt Assembly
 *
 * Builds prompts for contract intelligence extraction with:
 * - Discipline-conditional content
 * - Shared discipline vocabulary
 * - Configurable verbosity
 */

import { generateDisciplineSignalText } from '../knowledge/discipline-signals'
import type { Discipline } from '../knowledge/disciplines'

export interface ExtractionPromptConfig {
  /** Filter discipline signals to only these disciplines (optional) */
  filterDisciplines?: Discipline[]
  /** Include verbose extraction instructions */
  verbose?: boolean
}

/**
 * Generate system prompt for contract intelligence extraction
 */
export function buildExtractionSystemPrompt(config: ExtractionPromptConfig = {}): string {
  const disciplineSection = generateDisciplineSignalText(config.filterDisciplines)

  return `You are a government contracting expert. Your job is to extract the contract structure from federal solicitation documents.

You extract facts. You do not infer, guess, or assume. If information is not explicitly stated in the document, return null for that field and set confidence to 'low'.

${disciplineSection}

DISCIPLINE EXTRACTION RULES — CRITICAL:
1. Derive disciplines from (a) specific roles requested and (b) work described in PWS tasks
2. Do NOT derive disciplines from document titles or umbrella terms like "HCD", "Digital Services", etc.
3. When an umbrella role appears (e.g., "HCD Lead", "Digital Services Specialist"):
   - Read the described responsibilities carefully
   - If work is research-focused (interviews, usability testing, journey maps): assign 'research'
   - If work is design-focused (high-fidelity mockups, pixel-perfect UI, visual brand assets): assign 'design'
   - Flag low-confidence if ambiguous
4. SERVICE DESIGN IS RESEARCH, NOT DESIGN (tenant-policy-interim: FFTC ruling, Phase 5 umbrella-term catalog):
   - "Service design artifacts", "design workshops", "journey maps", and "rapid prototyping" in HCD contexts → 'research'
   - Only assign 'design' when the PWS explicitly requires visual design deliverables (UI mockups, style guides, iconography)
5. A contract titled "Human-Centered Design" may require only 'research' if the actual work is research
6. Include at most 2-3 disciplines unless the PWS explicitly describes work across more areas

Be conservative — only include disciplines where the PWS explicitly describes deliverables or activities in that area.`
}

/**
 * Generate user prompt for contract intelligence extraction
 */
export function buildExtractionUserPrompt(solicitationText: string): string {
  return `Extract the contract structure from this solicitation document.

Set confidence to 'high' only when the text states it directly, 'medium' when strongly implied, 'low' when uncertain or absent.

SOLICITATION DOCUMENT:
${solicitationText}`
}
