import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveTenantContext } from '@/lib/tenancy'
import { requireConfirmedIntelligence, createWbsCandidate, WbsValidationError } from '@/lib/commands'
import type { TaskInput, StaffingInput, PrimeOrSub } from '@/lib/commands/wbs/types'
import { wbsGenerationSchema, wbsGenerationJsonSchema, type WbsElement } from '@/lib/schemas/wbs-generation'

const SYSTEM_PROMPT = `You are a senior government proposal manager and technical architect with deep expertise in staffing federal IT delivery teams.

You apply three industry frameworks when determining team composition for any government digital services contract:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 1: TEAM TOPOLOGIES
(Skelton & Pais — the modern standard for software delivery team structure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

Cognitive load principle: A single work package should not exceed what ~3-5 people can reasonably own. If a package requires all 9 roles at significant hours, it should be split into smaller packages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 2: SFIA COMPLEXITY LEVELS
(Skills Framework for the Information Age — used by USDS, UK GDS, and federal IT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every task in a government IT contract maps to a SFIA complexity level (1-7). The level determines how many roles are needed:

LEVEL 1-2 — ROUTINE / ASSISTED:
  Single discipline, minimal coordination.
  One primary role, light oversight.
  Hours: 40-160 per role

  Examples:
  - Content writing and documentation
  - Simple UI component updates
  - Standard report generation
  - Basic configuration tasks

  Typical staffing: 1-2 roles

LEVEL 3 — AUTONOMOUS:
  Single discipline, self-directed work.
  One lead role, QA involvement.
  Hours: 80-320 per role

  Examples:
  - Standard feature development
  - UI pattern implementation
  - API endpoint development
  - Automated test suite creation

  Typical staffing: 2-3 roles (lead discipline + QA)

LEVEL 4 — INFLUENTIAL:
  Cross-functional, requires coordination between multiple disciplines.
  Hours: 160-640 per role

  Examples:
  - Authentication and identity systems
  - System integrations and APIs
  - Accessibility implementation
  - Database design and migration
  - CI/CD pipeline setup

  Typical staffing: 3-5 roles (minimum: lead + supporting discipline + QA + DevOps or Design)

LEVEL 5 — ENSURING/ADVISING:
  Complex, multi-system, high coordination.
  Work has significant downstream impact.
  Hours: 320-960 per role

  Examples:
  - Core platform/engine development
  - Security architecture and FedRAMP
  - Multi-tenant data systems
  - Real-time or high-availability systems
  - Major user-facing feature suites

  Typical staffing: 5-7 roles (broad cross-functional team required)

LEVEL 6-7 — STRATEGIC/GOVERNANCE:
  Program-level, architectural decisions, stakeholder management.

  Examples:
  - Program management and oversight
  - Technical architecture decisions
  - Stakeholder communication strategy
  - Transition planning

  Typical staffing: 2-3 senior roles (PM + Delivery Manager + Tech Lead)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMEWORK 3: USDS DIGITAL SERVICES PLAYBOOK — PLAY 7
(The federal standard for government digital services team composition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

If any of these roles does NOT appear anywhere in the WBS, that is a gap that will likely be noticed by federal evaluators.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOVERNMENT IT COMPLIANCE MULTIPLIERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For government IT specifically, certain requirement types ALWAYS require additional roles beyond the base team. Apply these multipliers when the requirement type is present:

SECURITY & FEDRAMP:
  Trigger: Any requirement mentioning FedRAMP, ATO, security compliance, FISMA, vulnerability management, or Authority to Operate
  Add: DevOps Engineer (security config), Back-end Developer (secure coding), QA Engineer (security testing)
  Hours premium: +25% on all estimates
  Rationale: Security requirements add substantial testing and documentation overhead.

ACCESSIBILITY (SECTION 508 / WCAG):
  Trigger: Any requirement mentioning 508, WCAG, accessibility, screen readers, or assistive technology
  Add: Front-end Developer (implementation), QA Engineer (accessibility testing), Content/UX Writer (plain language), UX Researcher (usability testing with users with disabilities)
  Hours premium: +15% on frontend tasks
  Rationale: Section 508 compliance is substantially more rigorous than commercial accessibility standards.

LEGACY SYSTEM INTEGRATION:
  Trigger: Any requirement mentioning integration, migration, legacy system, existing data, or API connectivity
  Add: Back-end Developer (integration code), DevOps Engineer (connection management), QA Engineer (integration testing)
  Hours premium: +30% on integration tasks
  Rationale: Government legacy systems are notoriously undocumented and integration timelines are unpredictable.

MULTI-LOCATION / GLOBAL DEPLOYMENT:
  Trigger: Any requirement mentioning multiple locations, global, international, multiple time zones, or rollout
  Add: DevOps Engineer (infrastructure), QA Engineer (environment testing), Content/UX Writer (localization)
  Hours premium: +20% on deployment tasks

USER TRAINING & CHANGE MANAGEMENT:
  Trigger: Any requirement mentioning training, documentation, user guides, onboarding, or change management
  Add: Content/UX Writer (materials), Product Designer (visual aids), Product Manager (change strategy)
  Note: Training is often underestimated in government proposals. Budget generously.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOURS ESTIMATION PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THINK ACROSS THE FULL CONTRACT PERIOD:
Government IT contracts have distinct phases.
Structure work accordingly:

  BASE YEAR — Setup, discovery, initial build:
    Infrastructure provisioning
    User research and discovery
    Core feature development (phase 1)
    Initial deployment and testing
    Expect: highest hours for most roles

  OPTION YEARS 1-2 — Feature delivery:
    Continued development
    Additional feature sets
    Ongoing operations
    Expect: similar to base year for development roles

  OPTION YEARS 3-4 — Maturity and operations:
    Reduced new development
    Increased operations and maintenance
    Knowledge transfer begins
    Expect: lower hours for dev roles, stable for ops roles

HOUR TARGETS PER ROLE:
Unless there is a specific reason a role is part-time, assume FULL TIME (1,920 hrs/yr):

  Full time:      1,920 hrs/yr (standard)
  Three-quarter:  1,440 hrs/yr (0.75 FTE)
  Half time:        960 hrs/yr (0.5 FTE)
  Quarter time:     480 hrs/yr (0.25 FTE — use sparingly, not for primary delivery roles)

DO NOT default to low hours unless the role genuinely has limited work on this package. A developer working on a major feature suite should be at 1,920 hrs/yr not 480 hrs/yr.

PROGRAM MANAGEMENT RULE — NON-NEGOTIABLE:

FFTC's Delivery Manager and Product Manager are FULL-TIME (1.0 FTE) on every project.

ALWAYS create WBS-01 as a dedicated "Program Management & Delivery" package.
This is the ONLY place DM and PM appear.

  WBS-01: Program Management & Delivery
    Task 1: Delivery management, sprint ceremonies, client relationships, reporting, risk management
      Role: Delivery Manager
      Hours: [billableHoursPerYear] per year
      LOE: management

    Task 2: Product vision, backlog, stakeholder alignment, acceptance, roadmap, feature prioritization
      Role: Product Manager
      Hours: [billableHoursPerYear] per year
      LOE: management

DO NOT add Delivery Manager or Product Manager to any other work package.
All other packages contain delivery work only.

TECHNICAL LEAD — appears on every development-heavy package:
  Full time (1,920 hrs) on core build packages
  Half time (960 hrs) on lighter packages
  Task: "Technical architecture and code review"

DESIGN LEAD — appears on every user-facing package:
  Full time (1,920 hrs) on design-heavy work
  Half time (960 hrs) on lighter packages
  Task: "Design direction and system consistency"

SPRINT-BASED SANITY CHECK:
  1 sprint = 2 weeks = ~80 hrs per developer
  Full year = ~24 sprints
  A developer at 1,920 hrs/yr = full 24 sprints

  If you estimate fewer than 960 hrs for a primary delivery role on a package that spans the full contract period, question whether that role truly belongs on this package or whether the package should be combined with another.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORK PACKAGE NAMING AND STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name work packages as clear NOUN PHRASES that describe the deliverable, not the action:
  ✓ "Authentication & Identity Management"
  ✗ "Implement Authentication"

  ✓ "User Research & Discovery"
  ✗ "Do User Research"

  ✓ "Cloud Infrastructure & DevSecOps"
  ✗ "Set Up Infrastructure"

Each work package must have:
  - A name (noun phrase, deliverable-focused)
  - A 2-3 sentence description of what gets delivered and why it matters
  - 3-6 tasks (specific work items)
  - 2-5 roles with hours per role
  - 1-3 linked requirements
  - Assumptions (what must be true)
  - Dependencies (what must come first)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE ROLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available FFTC roles (use ONLY these 11):

  Back-end Developer
  Front-end Developer
  DevOps Engineer
  QA Engineer
  Product Manager
  Product Designer
  UX Researcher
  Content/UX Writer
  Delivery Manager
  Technical Lead
  Design Lead

Do not invent new role names. If a work package needs a "Security Engineer", map that to DevOps Engineer. If it needs a "Business Analyst", map that to Product Manager.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTRACT-SPECIFIC ROLE FLAGGING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the work requires a role NOT in the standard FFTC labor categories, DO NOT invent a new role name. Instead:

1. Map to the closest standard role from the list above
2. Flag it in the task's basisOfEstimate field:
   "NOTE: This task may benefit from a [Training Specialist / Change Manager / Security Architect / etc.] not in FFTC's standard labor categories. Assigned to [closest role] — recommend reviewing in Roles & Pricing and adding a custom role if needed."

Common mappings:
  Security Architect    → DevOps Engineer
  Data Analyst          → Back-end Developer
  Business Analyst      → Product Manager
  Training Specialist   → Content/UX Writer
  Change Manager        → Product Manager
  Technical Writer      → Content/UX Writer
  Scrum Master          → Delivery Manager
  Solutions Architect   → Back-end Developer`

// =============================================================================
// Role to Discipline Mapping
// =============================================================================

const ROLE_DISCIPLINE_MAP: Record<string, string> = {
  // Management
  'Product Manager': 'Management',
  'Delivery Manager': 'Management',
  // HCD (Human-Centered Design)
  'UX Researcher': 'HCD',
  'Product Designer': 'HCD',
  'Design Lead': 'HCD',
  'Content/UX Writer': 'HCD',
  // Engineering
  'Back-end Developer': 'Engineering',
  'Front-end Developer': 'Engineering',
  'DevOps Engineer': 'Engineering',
  'QA Engineer': 'Engineering',
  'Technical Lead': 'Engineering',
}

/**
 * Map role to discipline, constrained to confirmed disciplines.
 * Falls back to first confirmed discipline if no match.
 */
function disciplineForRole(role: string, confirmedDisciplines: string[]): string {
  const mapped = ROLE_DISCIPLINE_MAP[role]
  if (mapped && confirmedDisciplines.includes(mapped)) {
    return mapped
  }
  // Fuzzy match: check if any confirmed discipline contains our mapped value
  if (mapped) {
    const fuzzy = confirmedDisciplines.find(d =>
      d.toLowerCase().includes(mapped.toLowerCase()) ||
      mapped.toLowerCase().includes(d.toLowerCase())
    )
    if (fuzzy) return fuzzy
  }
  // Last resort: first confirmed discipline
  return confirmedDisciplines[0] || 'Engineering'
}

/**
 * Transform AI-generated WBS output to TaskInput[] format for CreateWbsCandidate.
 *
 * Transformation:
 * - Each AI work package becomes a parent task (WBS-01, WBS-02, etc.)
 * - Each AI subtask becomes a child task with staffing assignments
 * - Hours are fanned out: one assignment per period with hours > 0
 */
function transformToTaskInputs(
  parsed: ParsedWbsElement[],
  confirmedDisciplines: string[],
  periodLabels: string[]
): TaskInput[] {
  const taskInputs: TaskInput[] = []

  for (const el of parsed) {
    // Create parent task (work package)
    const parentWbsCode = el.ref
    taskInputs.push({
      wbsCode: parentWbsCode,
      title: el.name,
      description: el.description,
      staffing: [], // Parent tasks have no direct staffing
    })

    // Create child tasks from subtasks
    for (let i = 0; i < el.tasks.length; i++) {
      const subtask = el.tasks[i]
      const childWbsCode = `${parentWbsCode}.${String(i + 1).padStart(2, '0')}`

      // Fan out hours per period
      const staffing: StaffingInput[] = []
      const discipline = disciplineForRole(subtask.suggestedRole, confirmedDisciplines)

      for (const periodLabel of periodLabels) {
        // Check if this period applies to this task
        const periodApplies = !subtask.applicablePeriods ||
          subtask.applicablePeriods.length === 0 ||
          subtask.applicablePeriods.some(p =>
            p.toLowerCase().includes(periodLabel.toLowerCase()) ||
            periodLabel.toLowerCase().includes(p.toLowerCase().replace('period', '').trim())
          )

        if (periodApplies) {
          const hours = subtask.estimatedHoursPerMonth ?? subtask.estimatedHours
          if (hours > 0) {
            staffing.push({
              roleTitle: subtask.suggestedRole,
              discipline,
              primeOrSub: 'prime' as PrimeOrSub,
              periodLabel,
              hours,
              hoursPerMonth: subtask.estimatedHoursPerMonth,
              rationale: subtask.basisOfEstimate || subtask.name,
            })
          }
        }
      }

      taskInputs.push({
        wbsCode: childWbsCode,
        title: subtask.name,
        description: subtask.basisOfEstimate,
        staffing,
      })
    }
  }

  return taskInputs
}

// Type for parsed AI response
interface ParsedWbsElement {
  ref: string
  name: string
  description: string
  requirementRefs: string[]
  dependsOn: string[]
  estimationType: string
  tasks: {
    name: string
    suggestedRole: string
    estimatedHours: number
    estimatedHoursPerMonth?: number
    applicablePeriods?: string[]
    loeType?: string
    basisOfEstimate?: string
  }[]
  totalHours: number
  assumptions: string[]
}

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

  // Parse request body for intelligenceVersionId and optional requirement filter
  let body: {
    intelligenceVersionId?: string
    selectedRequirementIds?: string[]
  } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional for backwards compatibility during migration
  }

  // Resolve tenant context for guard
  let tenantId: string
  try {
    const tenantContext = await resolveTenantContext(supabase)
    tenantId = tenantContext.tenant.id
  } catch (error) {
    console.error('[generate-wbs] Tenant resolution failed:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch proposal with full data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, period_of_performance, active_intelligence_version_id')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Use provided versionId or fall back to active version
  const intelligenceVersionId = body.intelligenceVersionId || proposal.active_intelligence_version_id

  // GATE: Require confirmed intelligence version
  if (!intelligenceVersionId) {
    return NextResponse.json({
      error: 'No confirmed intelligence version found. Please confirm contract intelligence before generating WBS.',
      code: 'INTELLIGENCE_REQUIRED'
    }, { status: 400 })
  }

  const guardResult = await requireConfirmedIntelligence(
    supabase,
    proposalId,
    intelligenceVersionId,
    tenantId
  )

  if (!guardResult.valid) {
    console.error('[generate-wbs] Guard failed:', guardResult.code, guardResult.message)
    const status = guardResult.code === 'NOT_FOUND' ? 404
      : guardResult.code === 'HASH_MISMATCH' ? 500
      : 400
    return NextResponse.json({
      error: guardResult.message,
      code: guardResult.code
    }, { status })
  }

  // Extract intelligence data from guard result
  const disciplines = guardResult.disciplines.map(d => d.discipline)
  const confirmedRoles = guardResult.laborRequirements.map(lr => ({
    title: lr.title,
    laborCategory: lr.laborCategory,
    hoursPerMonth: lr.hoursPerMonth,
    utilizationPct: lr.utilizationPct,
  }))
  const periods = guardResult.periods.map(p => ({
    name: p.name,
    months: p.months,
    cumulativeMonthsEnd: p.cumulativeMonthsEnd,
    gsaRateYear: p.gsaRateYear,
  }))

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  let requirements = (workingData.extractedRequirements || []) as {
    id: string
    title: string
    text?: string
    description?: string
    type: string
    referenceNumber?: string
    reference_number?: string
    sourceSection?: string
    source?: string
  }[]

  // Filter requirements if selectedRequirementIds provided
  if (body.selectedRequirementIds && body.selectedRequirementIds.length > 0) {
    const selectedIds = new Set(body.selectedRequirementIds)
    requirements = requirements.filter(r => selectedIds.has(r.id))
  }

  if (requirements.length === 0) {
    return NextResponse.json({
      error: body.selectedRequirementIds
        ? 'None of the selected requirements were found.'
        : 'No requirements extracted yet. Go to Scope → Solicitation to extract requirements first.'
    }, { status: 400 })
  }

  // Extract setup context
  const periodOfPerformance = (proposal.period_of_performance || {}) as { baseYear?: boolean; optionYears?: number }
  const optionYears = periodOfPerformance.optionYears ?? 4
  const contractYears = 1 + optionYears // base + options
  const billableHoursPerYear = 1920 // Default FTE hours
  const contractType = (proposal.contract_type as string) || 'tm'
  const contractTypeLabels: Record<string, string> = {
    tm: 'Time & Materials (T&M)',
    ffp: 'Firm Fixed Price (FFP)',
    cpff: 'Cost Plus Fixed Fee (CPFF)',
    idiq: 'IDIQ',
    hybrid: 'Hybrid',
  }
  const contractTypeLabel = contractTypeLabels[contractType.toLowerCase()] || contractType.toUpperCase()

  // Extract solicitation metadata
  const metadata = (workingData.solicitationMetadata || workingData.metadata || {}) as Record<string, unknown>
  const setAside = (metadata.setAside as string) || 'N/A'

  // Extract solicitation summary
  const solicitationSummary = (workingData.solicitationSummary || {}) as {
    whatTheyWant?: string
    what_they_want?: string
    whyItMatters?: string
    why_it_matters?: string
    keyChallenges?: string[]
    key_challenges?: string[]
  }
  const whatTheyWant = solicitationSummary.whatTheyWant || solicitationSummary.what_they_want || 'Federal IT services contract'
  const whyItMatters = solicitationSummary.whyItMatters || solicitationSummary.why_it_matters || ''
  const keyChallenges = solicitationSummary.keyChallenges || solicitationSummary.key_challenges || []

  // Build requirements text for prompt
  const reqsText = requirements.map(r => {
    const ref = r.referenceNumber || r.reference_number || r.id
    return `[${ref}] ${(r.type || 'shall').toUpperCase()}: ${r.text || r.description || r.title}`
  }).join('\n')

  const userPrompt = `Create a Work Breakdown Structure for this government IT contract.

CONTRACT CONTEXT:
Type: ${contractTypeLabel}
Period: Base Year + ${optionYears} Option Years (${contractYears} years total)
Billable hours per year: ${billableHoursPerYear}
Maximum hours per role per year: ${billableHoursPerYear}
Set-aside: ${setAside}

WHAT THEY WANT TO BUILD:
${whatTheyWant}

WHY IT MATTERS:
${whyItMatters || 'Not specified'}

KEY CHALLENGES:
${keyChallenges.length > 0 ? keyChallenges.join(', ') : 'Not specified'}

EXTRACTED REQUIREMENTS:
${reqsText}
${disciplines.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCIPLINE CONSTRAINTS — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This contract requires ONLY these disciplines:
${disciplines.join(', ')}

Generate WBS tasks ONLY within these disciplines. If a task falls outside these disciplines, do not include it. A PM/HCD contract does not need engineering tasks. An engineering contract does not need research tasks. Read the disciplines list and stay within it.
` : ''}
${confirmedRoles.length > 0 ? `
ROLES CONFIRMED FOR THIS CONTRACT:
${confirmedRoles.map(r =>
  `${r.title}: ${r.hoursPerMonth ?? 0} hours/month (${Math.round((r.hoursPerMonth ?? 0) / 160 * 100)}% utilization)`
).join('\n')}

Generate WBS tasks that can be staffed by these specific roles. Do not generate tasks requiring roles not in this list.
` : ''}
${periods.length > 0 ? `
CONTRACT PERIODS:
${periods.map(p => `${p.name}: ${p.months} months`).join('\n')}

Distribute work appropriately across these periods. Not all tasks run in all periods.
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using the Team Topologies, SFIA, and USDS frameworks in your instructions:

1. Identify 8-12 distinct work packages that cover ALL requirements

2. For each package:
   a. Assess its SFIA complexity level (3-6)
   b. Apply relevant compliance multipliers
   c. Assign ALL roles that this complexity level requires — not just the obvious ones
   d. Estimate hours per role based on sprint norms × government overhead factor

3. Verify before returning:
   ✓ Every requirement maps to at least one work package
   ✓ All 8 USDS-required roles appear somewhere across the full WBS
   ✓ Each package's SFIA level matches its actual role count
   ✓ Compliance multipliers applied where requirement types trigger them
   ✓ No role hours exceed ${billableHoursPerYear} per year
   ✓ Total hours are realistic for the contract type and period
   ✓ Dependencies are logical (infrastructure before applications, research before design, design before development)

Return ONLY a valid JSON array, no other text:

[
  {
    "ref": "WBS-01",
    "name": "Work package name (noun phrase)",
    "description": "2-3 sentences describing what is delivered and why it matters",
    "sfiaLevel": 4,
    "requirementRefs": ["REQ-001", "REQ-002"],
    "dependsOn": [],
    "estimationType": "engineering_estimate",
    "complianceMultipliers": ["fedramp"],
    "tasks": [
      {
        "name": "Specific task name",
        "suggestedRole": "Back-end Developer",
        "estimatedHours": 320,
        "estimatedHoursPerMonth": 160,
        "applicablePeriods": ["Base Period", "Option Period 1"],
        "loeType": "development",
        "basisOfEstimate": "2-3 sprints for enterprise auth implementation with government overhead factor applied"
      }
    ],
    "totalHours": 640,
    "assumptions": [
      "OKTA tenant provisioned before sprint 1",
      "SSO configuration documentation available"
    ]
  }
]

Ref numbering: WBS-01, WBS-02...
sfiaLevel: integer 1-7
complianceMultipliers: array of zero or more: "fedramp" | "section508" | "legacy_integration" | "global_deployment" | "training"
estimationType: one of: "engineering_estimate" | "loe" | "historical" | "parametric" | "analogy"
loeType: one of: "development" | "configuration" | "integration" | "testing" | "documentation" | "management" | "research" | "design"`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Tool definition for structured WBS output
    const wbsTool: Anthropic.Tool = {
      name: 'generate_wbs',
      description: 'Generate a Work Breakdown Structure for a government IT contract. Call this tool with the complete WBS.',
      input_schema: wbsGenerationJsonSchema as unknown as Anthropic.Tool.InputSchema
    }

    // First attempt with tool-use pattern for structured output
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 32768,
      system: SYSTEM_PROMPT,
      tools: [wbsTool],
      tool_choice: { type: 'tool', name: 'generate_wbs' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (message.stop_reason === 'max_tokens') {
      console.error('[generate-wbs] Response truncated — hit max_tokens limit')
      return NextResponse.json(
        { error: 'AI response was truncated. Try reducing the number of requirements or generating in smaller batches.' },
        { status: 500 }
      )
    }

    // Extract tool use result
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

    if (!toolUse) {
      console.error('[generate-wbs] No tool_use block in response')
      return NextResponse.json({ error: 'AI did not return structured output' }, { status: 500 })
    }

    // Extract workPackages from tool input
    const toolInput = toolUse.input as { workPackages?: WbsElement[] }
    const rawWorkPackages = toolInput.workPackages

    if (!rawWorkPackages || !Array.isArray(rawWorkPackages) || rawWorkPackages.length === 0) {
      console.error('[generate-wbs] Empty or invalid workPackages in tool response')
      return NextResponse.json({ error: 'AI returned empty WBS' }, { status: 500 })
    }

    // Validate with Zod schema
    const parseResult = wbsGenerationSchema.safeParse(rawWorkPackages)

    let parsed: WbsElement[]

    if (!parseResult.success) {
      // One repair pass: send validation errors back to the model
      console.log('[generate-wbs] Schema validation failed, attempting repair pass')
      console.log('[generate-wbs] Validation errors:', parseResult.error.issues.slice(0, 5))

      const repairMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 32768,
        system: SYSTEM_PROMPT,
        tools: [wbsTool],
        tool_choice: { type: 'tool', name: 'generate_wbs' },
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: message.content },
          {
            role: 'user',
            content: `Your previous WBS had validation errors:

${parseResult.error.issues.slice(0, 10).map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')}

Please fix these issues and regenerate the complete WBS. Ensure all required fields are present.`
          }
        ]
      })

      const repairToolUse = repairMessage.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (!repairToolUse) {
        console.error('[generate-wbs] Repair pass did not return tool_use')
        return NextResponse.json(
          { error: 'WBS generation failed after repair attempt', validationErrors: parseResult.error.issues.slice(0, 5) },
          { status: 500 }
        )
      }

      const repairInput = repairToolUse.input as { workPackages?: WbsElement[] }
      const repairResult = wbsGenerationSchema.safeParse(repairInput.workPackages)

      if (!repairResult.success) {
        console.error('[generate-wbs] Repair pass validation still failed:', repairResult.error.issues.slice(0, 5))
        return NextResponse.json(
          { error: 'WBS schema validation failed after repair', validationErrors: repairResult.error.issues.slice(0, 5) },
          { status: 500 }
        )
      }

      parsed = repairResult.data
      console.log('[generate-wbs] Repair pass succeeded')
    } else {
      parsed = parseResult.data
    }

    // Get period labels from intelligence context
    const periodLabels = periods.map(p => p.name)

    // Transform AI output to TaskInput[] format
    const taskInputs = transformToTaskInputs(parsed, disciplines, periodLabels)

    // Create WBS candidate via command (writes to normalized tables, not working_data)
    const result = await createWbsCandidate(supabase, {
      proposalId,
      intelligenceVersionId,
      tasks: taskInputs,
      generationJobNote: `AI-generated from ${requirements.length} requirements`,
    })

    console.log(`[generate-wbs] Created candidate v${result.versionNumber}: ${result.taskCount} tasks, ${result.assignmentCount} assignments for proposal ${proposalId}`)

    return NextResponse.json({
      candidateVersionId: result.candidateVersionId,
      versionNumber: result.versionNumber,
      taskCount: result.taskCount,
      assignmentCount: result.assignmentCount,
      workPackageCount: parsed.length,
    })

  } catch (error) {
    console.error('[generate-wbs] Error:', error)

    // Handle WBS validation errors with detailed feedback
    if (error instanceof WbsValidationError) {
      return NextResponse.json({
        error: 'WBS candidate validation failed',
        code: 'VALIDATION_FAILED',
        violations: error.violations,
      }, { status: 400 })
    }

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
