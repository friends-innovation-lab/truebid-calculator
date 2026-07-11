/**
 * Phase 3: WBS Command Integration Tests
 *
 * Real database tests for core WBS behaviors:
 * - Atomic supersession on accept
 * - user_modified conflict defaults to keep_user
 * - user_modified conflict with accept_candidate takes candidate values
 *
 * Requires local Supabase running: `supabase start`
 *
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js'
import {
  createCreateWbsCandidateCommand,
  createAcceptWbsCandidateCommand,
  createUpdateWbsTaskCommand,
  type CreateWbsCandidateInput,
  type CreateWbsCandidateResult,
  type AcceptWbsCandidateInput,
  type AcceptWbsCandidateResult,
  type WbsTask,
} from '@/lib/commands/wbs'
import type { CommandContext } from '@/lib/commands/types'

// Skip if no local Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const isLocalUrl = SUPABASE_URL?.includes('localhost') || SUPABASE_URL?.includes('127.0.0.1')
const shouldSkip = !SUPABASE_URL || !SERVICE_ROLE_KEY || !isLocalUrl

// Create service role client for tests (bypasses RLS)
function createTestClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials for integration tests')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

// Test data cleanup
async function cleanupTestData(supabase: ReturnType<typeof createTestClient>, proposalId: string) {
  // Delete in order respecting foreign keys
  await supabase.from('staffing_assignments').delete().eq('tenant_id', proposalId) // Will cascade
  await supabase.from('wbs_tasks').delete().eq('tenant_id', proposalId)
  await supabase.from('wbs_versions').delete().eq('proposal_id', proposalId)
  await supabase.from('intelligence_labor_requirements').delete().eq('version_id', proposalId)
  await supabase.from('intelligence_disciplines').delete().eq('version_id', proposalId)
  await supabase.from('intelligence_periods').delete().eq('version_id', proposalId)
  await supabase.from('intelligence_versions').delete().eq('proposal_id', proposalId)
  await supabase.from('proposals').delete().eq('id', proposalId)
}

// Setup test tenant, company, and proposal
async function setupTestFixture(supabase: ReturnType<typeof createTestClient>) {
  // Get or create test company first (proposals.company_id FK)
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('name', 'Test WBS Integration Company')
    .single()

  let companyId: string
  if (existingCompany) {
    companyId = existingCompany.id
  } else {
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({ name: 'Test WBS Integration Company' })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create company: ${error.message}`)
    companyId = newCompany.id
  }

  // Get or create test tenant (linked to company)
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', 'test-wbs-integration')
    .single()

  let tenantId: string
  if (existingTenant) {
    tenantId = existingTenant.id
  } else {
    const { data: newTenant, error } = await supabase
      .from('tenants')
      .insert({ slug: 'test-wbs-integration', name: 'Test WBS Integration', company_id: companyId })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create tenant: ${error.message}`)
    tenantId = newTenant.id
  }

  // Create test proposal
  const proposalId = crypto.randomUUID()
  const { error: propError } = await supabase
    .from('proposals')
    .insert({
      id: proposalId,
      company_id: companyId, // Must reference companies table
      title: 'Integration Test Proposal',
      status: 'draft',
      contract_type: 'T&M',
    })
  if (propError) throw new Error(`Failed to create proposal: ${propError.message}`)

  // Create intelligence version as DRAFT first (can't modify fact tables after confirm)
  const intelId = crypto.randomUUID()
  const { error: intelError } = await supabase
    .from('intelligence_versions')
    .insert({
      id: intelId,
      tenant_id: tenantId,
      proposal_id: proposalId,
      version_number: 1,
      status: 'draft', // Start as draft to allow fact table inserts
      contract_type: 'T&M',
      facts_json: {},
    })
  if (intelError) throw new Error(`Failed to create intelligence: ${intelError.message}`)

  // Add periods and disciplines for validation BEFORE confirming
  const periodResult = await supabase.from('intelligence_periods').insert([
    { version_id: intelId, name: 'Base Year', months: 12, cumulative_months_end: 12, gsa_rate_year: 1, sort_order: 0 },
    { version_id: intelId, name: 'Option Year 1', months: 12, cumulative_months_end: 24, gsa_rate_year: 2, sort_order: 1 },
  ])
  if (periodResult.error) throw new Error(`Failed to insert periods: ${periodResult.error.message}`)

  // Disciplines must match the CHECK constraint values from schema
  const discResult = await supabase.from('intelligence_disciplines').insert([
    { version_id: intelId, discipline: 'engineering', confidence: 'high' },
    { version_id: intelId, discipline: 'program-management', confidence: 'high' },
    { version_id: intelId, discipline: 'design', confidence: 'high' },
  ])
  if (discResult.error) throw new Error(`Failed to insert disciplines: ${discResult.error.message}`)

  // NOW confirm the intelligence version
  const { error: confirmError } = await supabase
    .from('intelligence_versions')
    .update({
      status: 'confirmed',
      confirmation_hash: 'test-hash-' + Date.now(),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', intelId)
  if (confirmError) throw new Error(`Failed to confirm intelligence: ${confirmError.message}`)

  return { tenantId, companyId, proposalId, intelligenceVersionId: intelId }
}

// Create a mock command context for direct command execution
function createMockContext(tenantId: string, companyId: string): CommandContext {
  const now = new Date().toISOString()
  return {
    tenant: {
      tenant: {
        id: tenantId,
        companyId,
        slug: 'test',
        name: 'Test',
        status: 'active' as const,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
      },
      userId: 'test-user',
      membership: {
        id: crypto.randomUUID(),
        role: 'owner' as const,
        userId: 'test-user',
        tenantId,
        status: 'active' as const,
        joinedAt: now,
        invitedBy: null,
      },
    },
    correlationId: crypto.randomUUID(),
    actorType: 'user' as const,
    actorId: 'test-user',
  }
}

// Helper to execute command and extract result
async function execCommand<T>(result: { success: boolean; data?: T }): Promise<T> {
  if (!result.success || !result.data) {
    throw new Error('Command failed')
  }
  return result.data
}

describe('WBS Integration Tests', () => {
  // Skip all tests if not running locally
  const describeOrSkip = shouldSkip ? describe.skip : describe

  describeOrSkip('AcceptWbsCandidate - Atomic Supersession', () => {
    let supabase: ReturnType<typeof createTestClient>
    let tenantId: string
    let companyId: string
    let proposalId: string
    let intelligenceVersionId: string
    let context: CommandContext

    beforeAll(async () => {
      supabase = createTestClient()
      const fixture = await setupTestFixture(supabase)
      tenantId = fixture.tenantId
      companyId = fixture.companyId
      proposalId = fixture.proposalId
      intelligenceVersionId = fixture.intelligenceVersionId
      context = createMockContext(tenantId, companyId)
    })

    afterAll(async () => {
      if (proposalId) {
        await cleanupTestData(supabase, proposalId)
      }
    })

    it('supersedes prior active version atomically when accepting candidate', async () => {
      const createCmd = createCreateWbsCandidateCommand(supabase)
      const acceptCmd = createAcceptWbsCandidateCommand(supabase)

      // 1. Create first WBS version and make it active
      const firstInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '1.0',
            title: 'First Version Task',
            staffing: [
              {
                roleTitle: 'Developer',
                discipline: 'engineering',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 100,
              },
            ],
          },
        ],
      }

      const firstResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, firstInput)
      )
      expect(firstResult.candidateVersionId).toBeDefined()

      // Accept first version (no prior active, so just activation)
      const acceptFirst: AcceptWbsCandidateInput = {
        candidateVersionId: firstResult.candidateVersionId,
        expectedRowVersion: 1,
      }
      const firstAcceptResult = await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, acceptFirst)
      )
      expect(firstAcceptResult.activeVersionId).toBe(firstResult.candidateVersionId)
      expect(firstAcceptResult.supersededVersionId).toBeNull()

      // Verify first version is now active
      const { data: firstVersion } = await supabase
        .from('wbs_versions')
        .select('status, activated_at')
        .eq('id', firstResult.candidateVersionId)
        .single()
      expect(firstVersion?.status).toBe('active')
      expect(firstVersion?.activated_at).toBeTruthy()

      // 2. Create second WBS version
      const secondInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '1.0',
            title: 'Second Version Task',
            staffing: [
              {
                roleTitle: 'Senior Developer',
                discipline: 'engineering',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 200,
              },
            ],
          },
        ],
      }

      const secondResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, secondInput)
      )
      expect(secondResult.candidateVersionId).toBeDefined()

      // Accept second version - should supersede first
      const acceptSecond: AcceptWbsCandidateInput = {
        candidateVersionId: secondResult.candidateVersionId,
        expectedRowVersion: 1,
      }
      const secondAcceptResult = await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, acceptSecond)
      )

      // Verify atomic supersession
      expect(secondAcceptResult.activeVersionId).toBe(secondResult.candidateVersionId)
      expect(secondAcceptResult.supersededVersionId).toBe(firstResult.candidateVersionId)

      // Verify first version is now superseded
      const { data: supersededVersion } = await supabase
        .from('wbs_versions')
        .select('status, superseded_at')
        .eq('id', firstResult.candidateVersionId)
        .single()
      expect(supersededVersion?.status).toBe('superseded')
      expect(supersededVersion?.superseded_at).toBeTruthy()

      // Verify second version is now active
      const { data: activeVersion } = await supabase
        .from('wbs_versions')
        .select('status, activated_at')
        .eq('id', secondResult.candidateVersionId)
        .single()
      expect(activeVersion?.status).toBe('active')
      expect(activeVersion?.activated_at).toBeTruthy()
    })
  })

  describeOrSkip('AcceptWbsCandidate - user_modified Conflict Resolution', () => {
    let supabase: ReturnType<typeof createTestClient>
    let tenantId: string
    let companyId: string
    let proposalId: string
    let intelligenceVersionId: string
    let context: CommandContext

    beforeAll(async () => {
      supabase = createTestClient()
      const fixture = await setupTestFixture(supabase)
      tenantId = fixture.tenantId
      companyId = fixture.companyId
      proposalId = fixture.proposalId
      intelligenceVersionId = fixture.intelligenceVersionId
      context = createMockContext(tenantId, companyId)
    })

    afterAll(async () => {
      if (proposalId) {
        await cleanupTestData(supabase, proposalId)
      }
    })

    it('keeps user values when NO conflict resolution provided (default behavior)', async () => {
      const createCmd = createCreateWbsCandidateCommand(supabase)
      const acceptCmd = createAcceptWbsCandidateCommand(supabase)
      const updateCmd = createUpdateWbsTaskCommand(supabase)

      // 1. Create and accept initial WBS version
      const initialInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '2.0',
            title: 'User Modified Task',
            description: 'Original description',
            staffing: [
              {
                roleTitle: 'PM',
                discipline: 'program-management',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 80,
              },
            ],
          },
        ],
      }

      const initialResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, initialInput)
      )
      await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, {
          candidateVersionId: initialResult.candidateVersionId,
          expectedRowVersion: 1,
        })
      )

      // 2. User modifies the task (simulating UI edit)
      const { data: activeTask } = await supabase
        .from('wbs_tasks')
        .select('id, row_version')
        .eq('wbs_version_id', initialResult.candidateVersionId)
        .eq('wbs_code', '2.0')
        .single()

      const userEditedDescription = 'USER EDITED: Custom description that must survive'
      await execCommand<WbsTask>(
        await updateCmd.execute(context, {
          taskId: activeTask!.id,
          description: userEditedDescription,
          expectedRowVersion: activeTask!.row_version,
        })
      )

      // Verify user_modified flag is set
      const { data: modifiedTask } = await supabase
        .from('wbs_tasks')
        .select('user_modified, description')
        .eq('id', activeTask!.id)
        .single()
      expect(modifiedTask?.user_modified).toBe(true)
      expect(modifiedTask?.description).toBe(userEditedDescription)

      // 3. Create new candidate with different description
      const candidateInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '2.0',
            title: 'User Modified Task', // Same wbs_code + title for matching
            description: 'AI GENERATED: New description from regeneration',
            staffing: [
              {
                roleTitle: 'PM',
                discipline: 'program-management',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 120, // Different hours
              },
            ],
          },
        ],
      }

      const candidateResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, candidateInput)
      )

      // 4. Accept candidate WITHOUT conflict resolution (default: keep_user)
      const acceptResult = await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, {
          candidateVersionId: candidateResult.candidateVersionId,
          expectedRowVersion: 1,
          // NO conflictResolutions provided - should default to keeping user's edits
        })
      )

      expect(acceptResult.conflictsResolved).toBeGreaterThan(0)

      // 5. Verify user's description was preserved in the new active version
      const { data: newActiveTask } = await supabase
        .from('wbs_tasks')
        .select('description, user_modified')
        .eq('wbs_version_id', candidateResult.candidateVersionId)
        .eq('wbs_code', '2.0')
        .single()

      expect(newActiveTask?.description).toBe(userEditedDescription)
      expect(newActiveTask?.user_modified).toBe(true)
    })

    it('takes candidate values when accept_candidate resolution provided', async () => {
      const createCmd = createCreateWbsCandidateCommand(supabase)
      const acceptCmd = createAcceptWbsCandidateCommand(supabase)
      const updateCmd = createUpdateWbsTaskCommand(supabase)

      // 1. Create and accept initial WBS version
      const initialInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '3.0',
            title: 'Override Test Task',
            description: 'Original description',
            deliverable: 'Original deliverable',
            staffing: [
              {
                roleTitle: 'Tester',
                discipline: 'engineering',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 40,
              },
            ],
          },
        ],
      }

      const initialResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, initialInput)
      )
      await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, {
          candidateVersionId: initialResult.candidateVersionId,
          expectedRowVersion: 1,
        })
      )

      // 2. User modifies the task
      const { data: activeTask } = await supabase
        .from('wbs_tasks')
        .select('id, row_version')
        .eq('wbs_version_id', initialResult.candidateVersionId)
        .eq('wbs_code', '3.0')
        .single()

      const userEditedDescription = 'USER EDITED: This should be overwritten'
      await execCommand<WbsTask>(
        await updateCmd.execute(context, {
          taskId: activeTask!.id,
          description: userEditedDescription,
          expectedRowVersion: activeTask!.row_version,
        })
      )

      // 3. Create new candidate with different description
      const candidateDescription = 'AI GENERATED: New description that should win'
      const candidateInput: CreateWbsCandidateInput = {
        proposalId,
        intelligenceVersionId,
        tasks: [
          {
            wbsCode: '3.0',
            title: 'Override Test Task',
            description: candidateDescription,
            deliverable: 'New deliverable from AI',
            staffing: [
              {
                roleTitle: 'Tester',
                discipline: 'engineering',
                primeOrSub: 'prime',
                periodLabel: 'Base Year',
                hours: 60,
              },
            ],
          },
        ],
      }

      const candidateResult = await execCommand<CreateWbsCandidateResult>(
        await createCmd.execute(context, candidateInput)
      )

      // Get candidate task ID for conflict resolution
      const { data: candidateTask } = await supabase
        .from('wbs_tasks')
        .select('id')
        .eq('wbs_version_id', candidateResult.candidateVersionId)
        .eq('wbs_code', '3.0')
        .single()

      // 4. Accept candidate WITH accept_candidate resolution
      await execCommand<AcceptWbsCandidateResult>(
        await acceptCmd.execute(context, {
          candidateVersionId: candidateResult.candidateVersionId,
          expectedRowVersion: 1,
          conflictResolutions: [
            {
              taskId: candidateTask!.id,
              resolution: 'accept_candidate', // Explicitly override user's edits
            },
          ],
        })
      )

      // 5. Verify candidate's description was used (user's edits discarded)
      const { data: newActiveTask } = await supabase
        .from('wbs_tasks')
        .select('description, deliverable, user_modified')
        .eq('wbs_version_id', candidateResult.candidateVersionId)
        .eq('wbs_code', '3.0')
        .single()

      expect(newActiveTask?.description).toBe(candidateDescription)
      expect(newActiveTask?.deliverable).toBe('New deliverable from AI')
      // user_modified should be false since we accepted the candidate version
      expect(newActiveTask?.user_modified).toBe(false)
    })
  })
})
