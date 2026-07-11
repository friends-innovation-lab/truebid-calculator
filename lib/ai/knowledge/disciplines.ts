/**
 * Canonical Discipline Vocabulary
 *
 * Single source of truth for discipline strings used across:
 * - intelligence_disciplines table (lowercase storage)
 * - AI prompts (injected as vocabulary)
 * - WBS validation (allowed disciplines check)
 * - Role-to-discipline mapping
 *
 * RULE: All discipline values in the database are lowercase.
 * Display names are derived via DISCIPLINE_DISPLAY_NAMES.
 */

/**
 * Canonical discipline identifiers (FFTC discipline list).
 * These MUST match the database exactly.
 *
 * NOTE: "HCD" is an umbrella term in RFPs, NOT a discipline.
 * Map HCD roles to design|research based on context.
 */
export const DISCIPLINES = [
  'engineering',
  'design',
  'product',
  'research',
  'management',
  'data',
  'security',
  'devops',
] as const

export type Discipline = (typeof DISCIPLINES)[number]

/**
 * Display names for UI and prompt assembly.
 * Canonical ID → Human-readable name
 */
export const DISCIPLINE_DISPLAY_NAMES: Record<Discipline, string> = {
  engineering: 'Engineering',
  design: 'Design',
  product: 'Product',
  research: 'Research',
  management: 'Management',
  data: 'Data & Analytics',
  security: 'Security',
  devops: 'DevOps & Infrastructure',
}

/**
 * Role-to-discipline mapping.
 * Each FFTC labor category maps to exactly one canonical discipline.
 *
 * UMBRELLA-TERM MAPPING:
 * "HCD" (Human-Centered Design) is an umbrella term in RFPs, not a discipline.
 * HCD roles map to design|research based on the work described:
 * - Design focus (wireframes, prototypes, UI/UX): → design
 * - Research focus (interviews, usability testing, journey maps): → research
 * When ambiguous, flag low-confidence in extraction.
 */
export const ROLE_TO_DISCIPLINE: Record<string, Discipline> = {
  // Management
  'Product Manager': 'management',
  'Delivery Manager': 'management',
  'Senior PM': 'management',
  'Program Manager': 'management',

  // Design (visual, interaction, UI/UX)
  'Product Designer': 'design',
  'Design Lead': 'design',
  'Content/UX Writer': 'design',
  'UX Designer': 'design',
  'UI Designer': 'design',
  'Visual Designer': 'design',

  // Research (user research, usability, discovery)
  'UX Researcher': 'research',
  'User Researcher': 'research',
  'Research Lead': 'research',
  'HCD Lead': 'research',        // Umbrella role - default to research when work is research-focused
  'Senior HCD Lead': 'research', // Umbrella role - default to research when work is research-focused

  // Engineering
  'Back-end Developer': 'engineering',
  'Front-end Developer': 'engineering',
  'DevOps Engineer': 'engineering',
  'QA Engineer': 'engineering',
  'Technical Lead': 'engineering',
  'Software Engineer': 'engineering',
  'Full-stack Developer': 'engineering',

  // Product
  'Product Lead': 'product',
  'Product Owner': 'product',

  // Data
  'Data Engineer': 'data',
  'Data Analyst': 'data',
  'Data Scientist': 'data',

  // Security
  'Security Engineer': 'security',
  'Security Analyst': 'security',

  // DevOps
  'Platform Engineer': 'devops',
  'Site Reliability Engineer': 'devops',
}

/**
 * Get discipline for a role title, with fuzzy matching fallback.
 * Returns undefined if no match found.
 */
export function getDisciplineForRole(roleTitle: string): Discipline | undefined {
  // Exact match
  if (roleTitle in ROLE_TO_DISCIPLINE) {
    return ROLE_TO_DISCIPLINE[roleTitle]
  }

  // Fuzzy match: check if role title contains a known role
  const lowerRole = roleTitle.toLowerCase()
  for (const [knownRole, discipline] of Object.entries(ROLE_TO_DISCIPLINE)) {
    if (lowerRole.includes(knownRole.toLowerCase())) {
      return discipline
    }
  }

  return undefined
}

/**
 * Get allowed roles for a set of disciplines.
 * Used to build prompt vocabulary.
 */
export function getRolesForDisciplines(disciplines: Discipline[]): string[] {
  const roles: string[] = []
  for (const [role, discipline] of Object.entries(ROLE_TO_DISCIPLINE)) {
    if (disciplines.includes(discipline)) {
      roles.push(role)
    }
  }
  // Dedupe (some roles may appear under multiple spellings)
  return [...new Set(roles)]
}

/**
 * Validate that a discipline string is canonical.
 */
export function isValidDiscipline(value: string): value is Discipline {
  return DISCIPLINES.includes(value as Discipline)
}

/**
 * Normalize a discipline string to canonical form.
 * Handles common variations.
 */
export function normalizeDiscipline(value: string): Discipline | undefined {
  const lower = value.toLowerCase().trim()

  // Direct match
  if (isValidDiscipline(lower)) {
    return lower
  }

  // Common variations
  // NOTE: 'HCD' umbrella terms map to 'design' by default; use context for research
  const variations: Record<string, Discipline> = {
    'human-centered design': 'design',
    'human centered design': 'design',
    hcd: 'design', // Umbrella term - default to design
    eng: 'engineering',
    dev: 'engineering',
    development: 'engineering',
    pm: 'management',
    'project management': 'management',
    'program management': 'management',
    ux: 'design',
    ui: 'design',
    'ux/ui': 'design',
    'user research': 'research',
    usability: 'research',
    analytics: 'data',
    infrastructure: 'devops',
    ops: 'devops',
    'site reliability': 'devops',
    sre: 'devops',
    cyber: 'security',
    cybersecurity: 'security',
    infosec: 'security',
  }

  return variations[lower]
}
