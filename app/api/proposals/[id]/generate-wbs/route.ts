import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { syncRolesFromWBS } from '@/lib/wbs-to-roles'
import type { ContractIntelligence } from '@/lib/types/contract-intelligence'

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

  // Fetch proposal with full data
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, period_of_performance')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const requirements = (workingData.extractedRequirements || []) as {
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

  if (requirements.length === 0) {
    return NextResponse.json({
      error: 'No requirements extracted yet. Go to Scope → Solicitation to extract requirements first.'
    }, { status: 400 })
  }

  // Load contract intelligence for discipline constraints
  const intelligence = workingData.contractIntelligence as ContractIntelligence | undefined
  const disciplines = intelligence?.disciplines?.required || []
  const confirmedRoles = intelligence?.roles || []
  const periods = intelligence?.periods || []

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
  `${r.title}: ${r.hoursPerMonth || 0} hours/month (${Math.round((r.hoursPerMonth || 0) / 160 * 100)}% utilization)`
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

    const message = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32768,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }).finalMessage()

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (message.stop_reason === 'max_tokens') {
      console.error('[generate-wbs] Response truncated — hit max_tokens limit')
      return NextResponse.json(
        { error: 'AI response was truncated. Try reducing the number of requirements or generating in smaller batches.' },
        { status: 500 }
      )
    }

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Extract JSON array robustly — handles markdown fences, preamble text, etc.
    let parsed: {
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
    }[]

    try {
      const arrayMatch = responseText.match(/\[[\s\S]*\]/)
      if (!arrayMatch) {
        console.error('[generate-wbs] No JSON array found in:', responseText.substring(0, 500))
        return NextResponse.json({ error: 'AI did not return a JSON array' }, { status: 500 })
      }
      parsed = JSON.parse(arrayMatch[0])
    } catch {
      console.error('[generate-wbs] Parse failed:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ error: 'AI returned empty WBS' }, { status: 500 })
    }

    const refToId = new Map<string, string>()
    requirements.forEach((r, index) => {
      // Map by reference_number if it exists
      if (r.referenceNumber) {
        refToId.set(r.referenceNumber, r.id)
      }
      if (r.reference_number) {
        refToId.set(r.reference_number, r.id)
      }
      // Map by auto-generated REQ-NNN format
      const autoRef = `REQ-${String(index + 1)
        .padStart(3, '0')}`
      refToId.set(autoRef, r.id)
      // Always map by ID too
      refToId.set(r.id, r.id)
    })

    // Helper to check if a task applies to a period
    const appliesToPeriod = (applicablePeriods: string[] | undefined, periodName: string): boolean => {
      if (!applicablePeriods || applicablePeriods.length === 0) return true // Default: applies to all
      return applicablePeriods.some(p => p.toLowerCase().includes(periodName.toLowerCase()))
    }

    // Convert to WBS elements format with BOE fields
    const wbsElements = parsed.map(el => ({
      id: crypto.randomUUID(),
      ref: el.ref,
      wbsNumber: el.ref.replace(/^WBS-0*/, 'WBS-'),
      title: el.name,
      description: el.description,
      why: el.description,
      what: el.description,
      notIncluded: '',
      estimationType: el.estimationType || 'engineering_estimate',
      basisOfEstimate: '',
      historicalReference: '',
      assumptions: el.assumptions || [],
      laborEstimates: el.tasks.map(t => {
        const hours = t.estimatedHoursPerMonth || t.estimatedHours
        return {
          id: crypto.randomUUID(),
          roleId: '',
          roleName: t.suggestedRole,
          hoursByPeriod: {
            base: appliesToPeriod(t.applicablePeriods, 'base') ? hours : 0,
            option1: optionYears >= 1 && appliesToPeriod(t.applicablePeriods, 'option 1') ? hours : 0,
            option2: optionYears >= 2 && appliesToPeriod(t.applicablePeriods, 'option 2') ? hours : 0,
            option3: optionYears >= 3 && appliesToPeriod(t.applicablePeriods, 'option 3') ? hours : 0,
            option4: optionYears >= 4 && appliesToPeriod(t.applicablePeriods, 'option 4') ? hours : 0,
          },
          rationale: t.name,
          confidence: 'medium' as const,
          isAISuggested: true,
          isOrphaned: false,
          loeType: t.loeType || 'development',
          basisOfEstimate: t.basisOfEstimate || '',
          estimatedHoursPerMonth: t.estimatedHoursPerMonth,
          applicablePeriods: t.applicablePeriods,
        }
      }),
      tasks: el.tasks.map(t => {
        const hours = t.estimatedHoursPerMonth || t.estimatedHours
        return {
          id: crypto.randomUUID(),
          name: t.name,
          role: t.suggestedRole,
          hours: t.estimatedHours,
          hoursByYear: {
            baseYear: appliesToPeriod(t.applicablePeriods, 'base') ? hours : 0,
            oy1: optionYears >= 1 && appliesToPeriod(t.applicablePeriods, 'option 1') ? hours : 0,
            oy2: optionYears >= 2 && appliesToPeriod(t.applicablePeriods, 'option 2') ? hours : 0,
            oy3: optionYears >= 3 && appliesToPeriod(t.applicablePeriods, 'option 3') ? hours : 0,
            oy4: optionYears >= 4 && appliesToPeriod(t.applicablePeriods, 'option 4') ? hours : 0,
          },
          loeType: t.loeType || 'development',
          chargeCode: null,
          basisOfEstimate: t.basisOfEstimate || '',
          estimatedHoursPerMonth: t.estimatedHoursPerMonth,
          applicablePeriods: t.applicablePeriods,
        }
      }),
      totalHours: el.totalHours,
      requirementLinks: el.requirementRefs
        .map(ref => refToId.get(ref))
        .filter((id): id is string => id != null),
      _dependencyRefs: el.dependsOn || [],
      dependencies: [] as string[],
      notes: '',
      isAIGenerated: true,
      qualityGrade: 'green' as const,
      qualityScore: 75,
      qualityIssues: [],
    }))

    // Resolve dependency refs → IDs
    const refToWbsId = new Map(wbsElements.map(el => [el.ref, el.id]))
    wbsElements.forEach(el => {
      el.dependencies = (el._dependencyRefs as string[])
        .map(ref => refToWbsId.get(ref))
        .filter((id): id is string => id != null)
      delete (el as Record<string, unknown>)._dependencyRefs
    })

    // Sync roles from WBS tasks with labor category lookup
    const existingWorkingData = (proposal.working_data || {}) as Record<string, unknown>
    const existingRoles = (existingWorkingData.roles || existingWorkingData.selectedRoles || []) as { id: string; name: string; isManual?: boolean; [key: string]: unknown }[]
    const proposalSetup = (existingWorkingData.proposalSetup || {}) as { optionYears?: number; profitMargin?: number }

    // Fetch company's labor categories for salary lookup
    const { data: proposalRow } = await supabase.from('proposals').select('company_id').eq('id', proposalId).single()
    let laborCategories: { title: string; laborCategory?: string; socCode?: string; salary_levels?: { level: string; level_title?: string; steps: number[] }[] }[] = []
    if (proposalRow?.company_id) {
      const { data: roles } = await supabase.from('company_roles').select('title, labor_category, soc_code, salary_levels').eq('company_id', proposalRow.company_id)
      laborCategories = (roles || []).map(r => ({
        title: r.title,
        laborCategory: r.labor_category,
        socCode: r.soc_code,
        salary_levels: r.salary_levels,
      }))
    }

    const syncedRoles = syncRolesFromWBS(wbsElements, existingRoles, proposalSetup, laborCategories)

    // Save both WBS elements and synced roles to working_data
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: {
          ...existingWorkingData,
          estimateWbsElements: wbsElements,
          roles: syncedRoles,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('[generate-wbs] Failed to save:', updateError)
      return NextResponse.json({ error: 'Failed to save WBS elements' }, { status: 500 })
    }

    console.log(`[generate-wbs] Generated ${wbsElements.length} elements, synced ${syncedRoles.length} roles for proposal ${proposalId}`)

    return NextResponse.json({
      wbsElements,
      roles: syncedRoles,
      count: wbsElements.length,
      rolesCount: syncedRoles.length,
    })

  } catch (error) {
    console.error('[generate-wbs] Error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI API error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
