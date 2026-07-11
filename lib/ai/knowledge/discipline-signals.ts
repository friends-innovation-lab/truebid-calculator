/**
 * Discipline Signal Words
 *
 * Keywords that indicate the presence of a discipline in solicitation text.
 * Used by extraction prompts to identify required disciplines.
 */

import type { Discipline } from './disciplines'

/**
 * Signal words for each discipline.
 * If solicitation text contains these terms, the discipline is likely required.
 */
export const DISCIPLINE_SIGNAL_WORDS: Record<Discipline, string[]> = {
  engineering: [
    'software development',
    'developer',
    'engineer',
    'frontend',
    'backend',
    'full-stack',
    'API',
    'database',
    'coding',
    'programming',
    'system integration',
    'microservices',
    'cloud infrastructure',
  ],

  design: [
    'UX design',
    'UI design',
    'interaction design',
    'visual design',
    'human-centered design',
    'HCD',
    'service design',
    'workshop facilitation',
    'co-design',
    'design thinking',
    'user experience',
    'usability',
    'wireframes',
    'prototypes',
  ],

  research: [
    'user research',
    'usability testing',
    'contextual inquiry',
    'discovery',
    'participant recruitment',
    'interviews',
    'surveys',
    'user interviews',
    'research synthesis',
    'journey mapping',
    'personas',
  ],

  product: [
    'product manager',
    'product owner',
    'backlog',
    'roadmap',
    'agile delivery',
    'product vision',
    'feature prioritization',
    'MVP',
    'product strategy',
  ],

  management: [
    'program manager',
    'delivery manager',
    'scrum master',
    'sprint facilitation',
    'project coordination',
    'multi-workstream',
    'governance',
    'portfolio',
    'PMO',
    'project management',
  ],

  data: [
    'data analytics',
    'data science',
    'machine learning',
    'data engineering',
    'BI',
    'business intelligence',
    'dashboards',
    'reporting',
    'data visualization',
    'ETL',
  ],

  security: [
    'cybersecurity',
    'security architect',
    'FedRAMP',
    'ATO',
    'FISMA',
    'vulnerability',
    'penetration testing',
    'security assessment',
    'NIST',
    'compliance',
  ],

  devops: [
    'DevOps',
    'CI/CD',
    'infrastructure',
    'cloud',
    'AWS',
    'Azure',
    'Kubernetes',
    'containerization',
    'deployment',
    'monitoring',
    'SRE',
    'site reliability',
  ],
}

/**
 * Generate discipline signal words section for prompts
 */
export function generateDisciplineSignalText(disciplines?: Discipline[]): string {
  const relevantDisciplines = disciplines || (Object.keys(DISCIPLINE_SIGNAL_WORDS) as Discipline[])

  const lines = relevantDisciplines.map(d => {
    const signals = DISCIPLINE_SIGNAL_WORDS[d]
    return `- ${d}: ${signals.join(', ')}`
  })

  return `DISCIPLINE SIGNAL WORDS — use these to identify disciplines but do not hardcode them as requirements. Only include a discipline if the scope of work explicitly requires that type of work:
${lines.join('\n')}`
}
