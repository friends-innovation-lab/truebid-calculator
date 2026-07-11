/**
 * Government IT Staffing Frameworks
 *
 * Domain knowledge for WBS generation:
 * - Team Topologies
 * - SFIA Complexity Levels
 * - USDS Digital Services Playbook Play 7
 */

/**
 * Team Topologies framework for stream-aligned teams
 */
export const TEAM_TOPOLOGIES = `FRAMEWORK 1: TEAM TOPOLOGIES
(Skelton & Pais — the modern standard for software delivery team structure)

Government IT contracts are STREAM-ALIGNED TEAMS — teams aligned to a flow of work from a segment of the user journey.

A well-formed stream-aligned team always contains ALL of these capabilities:
  - Product direction (Product Manager)
  - User understanding (UX Researcher)
  - Interface design (Product Designer)
  - Frontend delivery (Front-end Developer)
  - Backend delivery (Back-end Developer)
  - Platform/infrastructure (DevOps Engineer)
  - Quality assurance (QA Engineer)
  - Content and communication (Content/UX Writer)
  - Delivery oversight (Delivery Manager)

Not every role is full-time on every work package — but EVERY work package must be evaluated against each capability and assigned hours if that capability is needed.

Cognitive load principle: A single work package should not exceed what ~3-5 people can reasonably own. If a package requires all 9 roles at significant hours, it should be split into smaller packages.`

/**
 * SFIA complexity levels for task estimation
 */
export const SFIA_LEVELS = `FRAMEWORK 2: SFIA COMPLEXITY LEVELS
(Skills Framework for the Information Age — used by USDS, UK GDS, and federal IT)

Every task in a government IT contract maps to a SFIA complexity level (1-7). The level determines how many roles are needed:

LEVEL 1-2 — ROUTINE / ASSISTED:
  Single discipline, minimal coordination.
  One primary role, light oversight.
  Hours: 40-160 per role
  Examples: Content writing, simple UI updates, standard reports, basic configuration
  Typical staffing: 1-2 roles

LEVEL 3 — AUTONOMOUS:
  Single discipline, self-directed work.
  One lead role, QA involvement.
  Hours: 80-320 per role
  Examples: Standard feature development, UI patterns, API endpoints, test suites
  Typical staffing: 2-3 roles (lead discipline + QA)

LEVEL 4 — INFLUENTIAL:
  Cross-functional, requires coordination between multiple disciplines.
  Hours: 160-640 per role
  Examples: Auth systems, integrations, accessibility, database design, CI/CD
  Typical staffing: 3-5 roles (lead + supporting + QA + DevOps or Design)

LEVEL 5 — ENSURING/ADVISING:
  Complex, multi-system, high coordination.
  Work has significant downstream impact.
  Hours: 320-960 per role
  Examples: Core platform, FedRAMP security, multi-tenant systems, HA systems
  Typical staffing: 5-7 roles (broad cross-functional team)

LEVEL 6-7 — STRATEGIC/GOVERNANCE:
  Program-level, architectural decisions, stakeholder management.
  Examples: Program oversight, technical architecture, stakeholder strategy
  Typical staffing: 2-3 senior roles (PM + DM + Tech Lead)`

/**
 * USDS Playbook Play 7 requirements
 */
export const USDS_PLAY_7 = `FRAMEWORK 3: USDS DIGITAL SERVICES PLAYBOOK — PLAY 7
(The federal standard for government digital services team composition)

The USDS Playbook defines the MINIMUM composition for a federal digital services delivery team. For any government IT contract, these roles must appear somewhere across the full WBS:

REQUIRED across the full contract:
  ✓ Product Manager (owns vision, roadmap, acceptance)
  ✓ Technical Lead / Back-end Developer (owns architecture and backend)
  ✓ Front-end Developer (owns UI implementation)
  ✓ DevOps / Infrastructure Engineer (owns deployment and reliability)
  ✓ UX Researcher (owns user understanding)
  ✓ Content Designer / UX Writer (owns plain language and content)
  ✓ QA Engineer (owns quality and testing strategy)
  ✓ Delivery Manager (owns delivery process and team health)

If any of these roles does NOT appear anywhere in the WBS, that is a gap that will likely be noticed by federal evaluators.`

/**
 * Build framework knowledge section for WBS prompts
 * @param _disciplines - Reserved for future discipline-conditional content
 */
export function buildFrameworkKnowledge(_disciplines?: string[]): string {
  // Future: conditionally include frameworks based on contract type
  // For PM/HCD contracts, could focus on HCD-relevant portions
  // For engineering contracts, could emphasize technical frameworks
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${TEAM_TOPOLOGIES}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${SFIA_LEVELS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${USDS_PLAY_7}`
}
