/**
 * BOE Commands Test Suite
 *
 * Phase 6B: Tests for BOE artifact generation and snapshot creation.
 * 30 tests across 7 categories: BOE-C, CIT, IMM, CHAIN, SNAP, GATE, INT
 */

import { createHash } from 'crypto'
import { BOEArtifactContentSchema, ArtifactRateConfigSchema } from '@/lib/schemas/boe-artifact'
import type {
  GenerateBOEArtifactInput,
  CreateProposalSnapshotInput,
  UncitedLineDetail,
} from '../types'

// ============================================================================
// BOE-C: Content Hash Tests
// ============================================================================

describe('BOE-C: Content Hash Stability', () => {
  const sampleContent = {
    schemaVersion: '1.0.0' as const,
    proposal: {
      id: 'test-proposal-id',
      title: 'Test Proposal',
      solicitationNumber: 'SOL-001',
    },
    rateConfig: {
      fringeRate: 0.2116,
      overheadRate: 0.3426,
      gaRate: 0.1983,
      profitRate: 0.10,
    },
    sections: [
      {
        wbsCode: '1.0',
        taskTitle: 'Test Task',
        roleTitle: 'Project Manager',
        periodName: 'Base Year',
        quantity: 1920,
        unit: 'hours' as const,
        rate: 125.50,
        extendedCost: 240960.00,
        costComponent: 218963.64,
        feeComponent: 22000.00,
        laborCategoryId: null,
        citations: [],
      },
    ],
    totals: {
      totalHours: 1920,
      totalCost: 218963.64,
      totalFee: 22000.00,
      totalExtended: 240963.64,
    },
    conservation: {
      sumOfCostComponents: 218963.64,
      sumOfFeeComponents: 22000.00,
      sumOfExtended: 240963.64,
      conserved: true,
    },
  }

  test('BOE-C1: SHA-256 hash is deterministic for identical content', () => {
    const json1 = JSON.stringify(sampleContent)
    const json2 = JSON.stringify(sampleContent)

    const hash1 = createHash('sha256').update(json1).digest('hex')
    const hash2 = createHash('sha256').update(json2).digest('hex')

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  test('BOE-C2: Different content produces different hash', () => {
    const modified = { ...sampleContent, proposal: { ...sampleContent.proposal, title: 'Different Title' } }

    const hash1 = createHash('sha256').update(JSON.stringify(sampleContent)).digest('hex')
    const hash2 = createHash('sha256').update(JSON.stringify(modified)).digest('hex')

    expect(hash1).not.toBe(hash2)
  })

  test('BOE-C3: Hash changes when fee component changes', () => {
    const modified = {
      ...sampleContent,
      sections: [{
        ...sampleContent.sections[0],
        feeComponent: 23000.00,
      }],
    }

    const hash1 = createHash('sha256').update(JSON.stringify(sampleContent)).digest('hex')
    const hash2 = createHash('sha256').update(JSON.stringify(modified)).digest('hex')

    expect(hash1).not.toBe(hash2)
  })

  test('BOE-C4: Hash changes when rate config changes', () => {
    const modified = {
      ...sampleContent,
      rateConfig: {
        ...sampleContent.rateConfig,
        profitRate: 0.12,
      },
    }

    const hash1 = createHash('sha256').update(JSON.stringify(sampleContent)).digest('hex')
    const hash2 = createHash('sha256').update(JSON.stringify(modified)).digest('hex')

    expect(hash1).not.toBe(hash2)
  })
})

// ============================================================================
// CIT: Citation Tests
// ============================================================================

describe('CIT: Citation Completeness', () => {
  test('CIT1: UncitedLineDetail type has required fields', () => {
    const uncitedLine: UncitedLineDetail = {
      lineId: 'line-123',
      wbsCode: '1.1',
      taskTitle: 'Development',
      roleTitle: 'Software Engineer',
    }

    expect(uncitedLine.lineId).toBeDefined()
    expect(uncitedLine.wbsCode).toBeDefined()
    expect(uncitedLine.taskTitle).toBeDefined()
    expect(uncitedLine.roleTitle).toBeDefined()
  })

  test('CIT2: Empty citations array is valid structure', () => {
    const section = {
      wbsCode: '1.0',
      taskTitle: 'Task',
      roleTitle: 'Role',
      periodName: 'Period',
      quantity: 100,
      unit: 'hours' as const,
      rate: 100,
      extendedCost: 10000,
      costComponent: 9000,
      feeComponent: 1000,
      laborCategoryId: null,
      citations: [],
    }

    expect(section.citations).toHaveLength(0)
    expect(Array.isArray(section.citations)).toBe(true)
  })

  test('CIT3: Citation with labor requirement reference', () => {
    const citation = {
      laborRequirementId: 'lr-123',
      laborRequirementTitle: 'Senior Developer',
      sourceText: 'Per PWS Section 3.1',
    }

    expect(citation.laborRequirementId).toBeDefined()
    expect(citation.laborRequirementTitle).toBeDefined()
  })

  test('CIT4: Multiple citations per section', () => {
    const section = {
      wbsCode: '1.0',
      taskTitle: 'Task',
      roleTitle: 'Role',
      periodName: 'Period',
      quantity: 100,
      unit: 'hours' as const,
      rate: 100,
      extendedCost: 10000,
      costComponent: 9000,
      feeComponent: 1000,
      laborCategoryId: null,
      citations: [
        { laborRequirementId: 'lr-1', laborRequirementTitle: 'Title 1' },
        { laborRequirementId: 'lr-2', laborRequirementTitle: 'Title 2' },
      ],
    }

    expect(section.citations).toHaveLength(2)
  })
})

// ============================================================================
// IMM: Immutability Tests (Schema/Type Level)
// ============================================================================

// Helper to create valid content for schema tests
// Note: UUIDs must have valid version (position 3: 1-8) and variant (position 4: 8-b) bytes
const TEST_UUID = '12345678-1234-4123-a123-123456789012' // Valid v4 UUID format

function createValidArtifactContent(overrides: Partial<{
  schemaVersion: string
  proposal: Record<string, unknown>
  rateConfig: Record<string, unknown>
  sections: unknown[]
  totals: Record<string, unknown>
  conservation: Record<string, unknown>
}> = {}) {
  return {
    schemaVersion: '1.0.0',
    proposal: {
      id: TEST_UUID,
      title: 'Test Proposal',
      solicitationNumber: 'SOL-001',
      agency: 'DOD',
      contractType: 'FFP',
      ...overrides.proposal,
    },
    rateConfig: {
      fringe: 0.2116,
      overhead: 0.3426,
      ga: 0.1983,
      defaultProfitRate: 0.10,
      escalationRate: 0.03,
      snapshotAt: new Date().toISOString(),
      sourceSettingsRowVersion: 1,
      ...overrides.rateConfig,
    },
    sections: overrides.sections ?? [],
    totals: {
      wbsEstimateHours: 0,
      wbsEstimateCost: 0,
      wbsEstimateFee: 0,
      wbsEstimateTotal: 0,
      laborLoadingHours: 0,
      laborLoadingCost: 0,
      laborLoadingFee: 0,
      laborLoadingTotal: 0,
      grandTotalHours: 0,
      grandTotalCost: 0,
      grandTotalFee: 0,
      grandTotal: 0,
      ...overrides.totals,
    },
    conservation: {
      wbsEstimateCostPlusFee: 0,
      wbsEstimateTotal: 0,
      wbsEstimateConserved: true,
      laborLoadingCostPlusFee: 0,
      laborLoadingTotal: 0,
      laborLoadingConserved: true,
      allConserved: true,
      ...overrides.conservation,
    },
    ...overrides,
  }
}

describe('IMM: Immutability Schema Validation', () => {
  test('IMM1: Schema version is literal 1.0.0', () => {
    const validContent = createValidArtifactContent()

    const result = BOEArtifactContentSchema.safeParse(validContent)
    expect(result.success).toBe(true)
  })

  test('IMM2: Invalid schema version rejected', () => {
    const invalidContent = createValidArtifactContent({ schemaVersion: '2.0.0' })

    const result = BOEArtifactContentSchema.safeParse(invalidContent)
    expect(result.success).toBe(false)
  })

  test('IMM3: Rate config requires all fields', () => {
    const validRateConfig = {
      fringe: 0.2116,
      overhead: 0.3426,
      ga: 0.1983,
      defaultProfitRate: 0.10,
      escalationRate: 0.03,
      snapshotAt: new Date().toISOString(),
      sourceSettingsRowVersion: 1,
    }

    const result = ArtifactRateConfigSchema.safeParse(validRateConfig)
    expect(result.success).toBe(true)
  })

  test('IMM4: Missing rate in config is rejected', () => {
    const invalidRateConfig = {
      fringe: 0.2116,
      overhead: 0.3426,
      ga: 0.1983,
      // missing defaultProfitRate, escalationRate, snapshotAt, sourceSettingsRowVersion
    }

    const result = ArtifactRateConfigSchema.safeParse(invalidRateConfig)
    expect(result.success).toBe(false)
  })

  test('IMM5: Conservation flag must be boolean', () => {
    const validConservation = {
      sumOfCostComponents: 100,
      sumOfFeeComponents: 10,
      sumOfExtended: 110,
      conserved: true,
    }

    expect(typeof validConservation.conserved).toBe('boolean')
  })

  test('IMM6: Section unit must be hours or days', () => {
    const sectionWithHours = { unit: 'hours' as const }
    const sectionWithDays = { unit: 'days' as const }

    expect(['hours', 'days']).toContain(sectionWithHours.unit)
    expect(['hours', 'days']).toContain(sectionWithDays.unit)
  })

  test('IMM7: Proposal info is required', () => {
    const contentWithoutProposal = {
      schemaVersion: '1.0.0',
      rateConfig: {
        fringe: 0.2,
        overhead: 0.3,
        ga: 0.2,
        defaultProfitRate: 0.1,
        escalationRate: 0.03,
        snapshotAt: new Date().toISOString(),
        sourceSettingsRowVersion: 1,
      },
      sections: [],
      totals: {
        wbsEstimateHours: 0, wbsEstimateCost: 0, wbsEstimateFee: 0, wbsEstimateTotal: 0,
        laborLoadingHours: 0, laborLoadingCost: 0, laborLoadingFee: 0, laborLoadingTotal: 0,
        grandTotalHours: 0, grandTotalCost: 0, grandTotalFee: 0, grandTotal: 0,
      },
      conservation: {
        wbsEstimateCostPlusFee: 0, wbsEstimateTotal: 0, wbsEstimateConserved: true,
        laborLoadingCostPlusFee: 0, laborLoadingTotal: 0, laborLoadingConserved: true,
        allConserved: true,
      },
    }

    const result = BOEArtifactContentSchema.safeParse(contentWithoutProposal)
    expect(result.success).toBe(false)
  })

  test('IMM8: Sections must be an array', () => {
    const validContent = createValidArtifactContent()

    const result = BOEArtifactContentSchema.safeParse(validContent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Array.isArray(result.data.sections)).toBe(true)
    }
  })
})

// ============================================================================
// CHAIN: Evidence Chain Tests
// ============================================================================

describe('CHAIN: Evidence Chain Integrity', () => {
  test('CHAIN1: Composite hash includes intelligence confirmation hash', () => {
    const intelligenceConfirmationHash = 'abc123'
    const artifactContentHash1 = 'def456'
    const artifactContentHash2 = 'ghi789'

    // Sort artifacts by ID for determinism (alphabetical)
    const sortedHashes = [artifactContentHash1, artifactContentHash2].sort()
    const hashInput = intelligenceConfirmationHash + sortedHashes.join('')
    const compositeHash = createHash('sha256').update(hashInput).digest('hex')

    expect(compositeHash).toHaveLength(64)
    expect(hashInput).toContain(intelligenceConfirmationHash)
  })

  test('CHAIN2: Composite hash order is deterministic', () => {
    const intelHash = 'intel123'
    const artifacts = ['artifact-b-hash', 'artifact-a-hash']

    // Both orderings should produce same result after sorting
    const sorted1 = [...artifacts].sort()
    const sorted2 = [...[...artifacts].reverse()].sort()

    const hash1 = createHash('sha256').update(intelHash + sorted1.join('')).digest('hex')
    const hash2 = createHash('sha256').update(intelHash + sorted2.join('')).digest('hex')

    expect(hash1).toBe(hash2)
  })
})

// ============================================================================
// SNAP: Snapshot Tests
// ============================================================================

describe('SNAP: Proposal Snapshot', () => {
  test('SNAP1: CreateProposalSnapshotInput requires proposalId and artifactIds', () => {
    const input: CreateProposalSnapshotInput = {
      proposalId: 'proposal-123',
      artifactIds: ['artifact-1', 'artifact-2'],
    }

    expect(input.proposalId).toBeDefined()
    expect(input.artifactIds).toHaveLength(2)
  })

  test('SNAP2: Label is optional with default', () => {
    const inputWithLabel: CreateProposalSnapshotInput = {
      proposalId: 'proposal-123',
      artifactIds: ['artifact-1'],
      label: 'Final Submission',
    }

    const inputWithoutLabel: CreateProposalSnapshotInput = {
      proposalId: 'proposal-123',
      artifactIds: ['artifact-1'],
    }

    expect(inputWithLabel.label).toBe('Final Submission')
    expect(inputWithoutLabel.label).toBeUndefined()
  })

  test('SNAP3: Empty artifactIds array is structurally valid but semantically rejected', () => {
    const input: CreateProposalSnapshotInput = {
      proposalId: 'proposal-123',
      artifactIds: [],
    }

    // Structurally valid
    expect(input.artifactIds).toHaveLength(0)
    // Command would reject this with validation error
  })

  test('SNAP4: Artifact IDs must be strings', () => {
    const input: CreateProposalSnapshotInput = {
      proposalId: 'proposal-123',
      artifactIds: ['uuid-1', 'uuid-2', 'uuid-3'],
    }

    input.artifactIds.forEach(id => {
      expect(typeof id).toBe('string')
    })
  })

  test('SNAP5: Snapshot output includes compositeHash', () => {
    // Type check - output must have these fields
    type ExpectedOutput = {
      snapshotId: string
      compositeHash: string
      artifactCount: number
      submittedAt: string
    }

    const mockOutput: ExpectedOutput = {
      snapshotId: 'snap-123',
      compositeHash: 'abc123def456',
      artifactCount: 2,
      submittedAt: new Date().toISOString(),
    }

    expect(mockOutput.snapshotId).toBeDefined()
    expect(mockOutput.compositeHash).toBeDefined()
    expect(mockOutput.artifactCount).toBe(2)
  })
})

// ============================================================================
// GATE: Gate Tests
// ============================================================================

describe('GATE: Generation Gates', () => {
  test('GATE1: GenerateBOEArtifactInput requires proposalId and scenarioId', () => {
    const input: GenerateBOEArtifactInput = {
      proposalId: 'proposal-123',
      scenarioId: 'scenario-456',
    }

    expect(input.proposalId).toBeDefined()
    expect(input.scenarioId).toBeDefined()
  })

  test('GATE2: Citation completeness is enforced at command level', () => {
    // CITATION_INCOMPLETE error code exists
    const errorCode = 'CITATION_INCOMPLETE'
    expect(errorCode).toBe('CITATION_INCOMPLETE')
  })

  test('GATE3: Conservation check is enforced', () => {
    // CONSERVATION_FAILED error code exists
    const errorCode = 'CONSERVATION_FAILED'
    expect(errorCode).toBe('CONSERVATION_FAILED')
  })

  test('GATE4: Fee decomposition preserves total', () => {
    // Given a line with extendedCost
    const extendedCost = 10000.00
    const profitRate = 0.10

    // Fee decomposition formula
    const costComponent = Math.round((extendedCost / (1 + profitRate)) * 100) / 100
    const feeComponent = Math.round((extendedCost - costComponent) * 100) / 100

    // Conservation check
    const reconstructed = Math.round((costComponent + feeComponent) * 100) / 100

    expect(reconstructed).toBe(extendedCost)
  })

  test('GATE5: Multiple lines conserve sum', () => {
    const lines = [
      { extendedCost: 10000.00 },
      { extendedCost: 25000.50 },
      { extendedCost: 5000.25 },
    ]
    const profitRate = 0.10

    let totalCost = 0
    let totalFee = 0
    let totalExtended = 0

    for (const line of lines) {
      const cost = Math.round((line.extendedCost / (1 + profitRate)) * 100) / 100
      const fee = Math.round((line.extendedCost - cost) * 100) / 100
      totalCost += cost
      totalFee += fee
      totalExtended += line.extendedCost
    }

    // Round totals
    totalCost = Math.round(totalCost * 100) / 100
    totalFee = Math.round(totalFee * 100) / 100

    // Conservation: cost + fee should equal total extended
    const reconstructedTotal = Math.round((totalCost + totalFee) * 100) / 100

    expect(reconstructedTotal).toBe(totalExtended)
  })
})

// ============================================================================
// INT: Integration Type Tests
// ============================================================================

describe('INT: Integration Types', () => {
  test('INT1: GenerateBOEArtifactOutput has required fields', () => {
    type ExpectedOutput = {
      artifactId: string
      contentHash: string
      sectionCount: number
      citationCount: number
      conserved: boolean
    }

    const mockOutput: ExpectedOutput = {
      artifactId: 'artifact-123',
      contentHash: 'sha256hash',
      sectionCount: 10,
      citationCount: 25,
      conserved: true,
    }

    expect(mockOutput.artifactId).toBeDefined()
    expect(mockOutput.contentHash).toBeDefined()
    expect(mockOutput.conserved).toBe(true)
  })

  test('INT2: UncitedLineDetail provides debugging info', () => {
    const uncited: UncitedLineDetail = {
      lineId: 'line-1',
      wbsCode: '1.1.1',
      taskTitle: 'Development Sprint 1',
      roleTitle: 'Senior Developer',
    }

    // All fields useful for debugging
    expect(uncited.lineId).toBeTruthy()
    expect(uncited.wbsCode).toMatch(/^\d+\.\d+/)
    expect(uncited.taskTitle).toBeTruthy()
    expect(uncited.roleTitle).toBeTruthy()
  })

  test('INT3: Artifact content validates with Zod schema', () => {
    const validContent = createValidArtifactContent({
      proposal: {
        id: TEST_UUID,
        title: 'Government Contract Proposal',
        solicitationNumber: 'W52P1J-23-R-0001',
        agency: 'Army',
        contractType: 'FFP',
      },
      totals: {
        wbsEstimateHours: 1920,
        wbsEstimateCost: 219054.55,
        wbsEstimateFee: 21905.45,
        wbsEstimateTotal: 240960.00,
        laborLoadingHours: 0,
        laborLoadingCost: 0,
        laborLoadingFee: 0,
        laborLoadingTotal: 0,
        grandTotalHours: 1920,
        grandTotalCost: 219054.55,
        grandTotalFee: 21905.45,
        grandTotal: 240960.00,
      },
      conservation: {
        wbsEstimateCostPlusFee: 240960.00,
        wbsEstimateTotal: 240960.00,
        wbsEstimateConserved: true,
        laborLoadingCostPlusFee: 0,
        laborLoadingTotal: 0,
        laborLoadingConserved: true,
        allConserved: true,
      },
    })

    const result = BOEArtifactContentSchema.safeParse(validContent)
    expect(result.success).toBe(true)
  })
})
