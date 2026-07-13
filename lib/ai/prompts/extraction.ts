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

Be conservative — only include disciplines where the PWS explicitly describes deliverables or activities in that area.

PERIOD EXTRACTION RULES — CRITICAL:
1. Periods = priced CLIN structure. Count the distinct pricing columns (Base Year, Option Year 1, etc.) in the pricing template or CLIN table.
2. Transition/phase-in is a MILESTONE within the base period, NEVER a separate period.
3. "Ramp-up", "mobilization", "transition-in" are work items, not periods — they occur within Base Year.
4. Periods drive GSA rate year mapping. If the contract has Base + 3 Option Years, that's 4 periods regardless of phase-in language.
5. If pricing template columns show: Base Year | Option Year 1 | Option Year 2 | Option Year 3 → return 4 periods.
6. Do NOT count "phase-in" or "transition" as additional periods beyond the priced structure.

STAFFING MODEL EXTRACTION RULES — CRITICAL:
1. staffingModel = 'prescribed' when the RFP explicitly names required roles:
   - "Key Personnel" section naming specific positions
   - LCAT table with named positions (not generic labor categories)
   - "The contractor SHALL provide a [Role Name]"
   - "Minimum staffing of [Role] and [Role]"
2. staffingModel = 'offeror_proposed' when the RFP allows offeror discretion:
   - "Propose a staffing approach"
   - "Offeror shall determine team composition"
   - "Staffing plan to be provided by offeror"
   - No named Key Personnel requirements
3. staffingModel = 'unclear' when neither signal is present or language is ambiguous
4. For each role, set isPrescribed = true ONLY if the role is explicitly named in the RFP (Key Personnel, required position)
5. Inferred roles (derived from scope of work, not explicitly named) get isPrescribed = false

SOLICITATION BRIEF — REQUIRED:
Generate a structured brief that describes what the government wants:

1. **Summary** (1-2 sentences): What capability or service is being procured
2. **Rationale** (1-2 sentences): Why this matters to the agency (mission context)
3. **Challenges** (2-4 items): Key technical or delivery challenges, each with:
   - Title: short label (2-5 words)
   - Description: 2-3 sentences explaining the challenge
   - Evidence: Quote VERBATIM passages from the document that indicate this challenge
4. **Evaluation Emphasis** (1-2 sentences): What criteria will matter most in evaluation

For each challenge, you MUST include at least one verbatim quote from the document. These quotes become evidence records.`
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
