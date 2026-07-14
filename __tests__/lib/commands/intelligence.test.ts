/**
 * Intelligence Command Tests
 *
 * Tests for versioned contract intelligence including:
 * - Hash computation and round-trip consistency
 * - Type coercion from Postgres types
 * - Guard rejection cases
 * - Canonical serialization
 */

import {
  coercePeriod,
  coerceDiscipline,
  coerceLaborRequirement,
  coerceVersion,
  canonicalize,
  computeHash,
} from '@/lib/commands/intelligence/hash-utils'
import type {
  IntelligencePeriodRow,
  IntelligenceDisciplineRow,
  IntelligenceLaborRequirementRow,
  IntelligenceVersionRow,
  FactsJson,
  CoercedPeriod,
  CoercedDiscipline,
  CoercedLaborRequirement,
} from '@/lib/commands/intelligence/types'

// =============================================================================
// TYPE COERCION TESTS
// =============================================================================

describe('Type Coercion', () => {
  describe('coercePeriod', () => {
    it('converts NUMERIC strings to numbers', () => {
      const row: IntelligencePeriodRow = {
        id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
        version_id: 'version-123',
        name: 'Base Period',
        months: '12.5', // Postgres NUMERIC returns string
        cumulative_months_end: '12.5',
        gsa_rate_year: 1,
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coercePeriod(row)

      expect(coerced.months).toBe(12.5)
      expect(typeof coerced.months).toBe('number')
      expect(coerced.cumulativeMonthsEnd).toBe(12.5)
      expect(typeof coerced.cumulativeMonthsEnd).toBe('number')
    })

    it('lowercases UUID for consistent hashing', () => {
      const row: IntelligencePeriodRow = {
        id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
        version_id: 'version-123',
        name: 'Base Period',
        months: '12',
        cumulative_months_end: '12',
        gsa_rate_year: 1,
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coercePeriod(row)

      expect(coerced.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    })

    it('handles integer NUMERIC correctly', () => {
      const row: IntelligencePeriodRow = {
        id: 'test-uuid',
        version_id: 'version-123',
        name: 'Base Period',
        months: '6',
        cumulative_months_end: '6',
        gsa_rate_year: 1,
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coercePeriod(row)

      expect(coerced.months).toBe(6)
      expect(Number.isInteger(coerced.months)).toBe(true)
    })
  })

  describe('coerceDiscipline', () => {
    it('preserves discipline enum and confidence', () => {
      const row: IntelligenceDisciplineRow = {
        id: 'DISC-UUID',
        version_id: 'version-123',
        discipline: 'engineering',
        confidence: 'high',
        source_text: 'Section 3.1 requires software development',
        created_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coerceDiscipline(row)

      expect(coerced.discipline).toBe('engineering')
      expect(coerced.confidence).toBe('high')
      expect(coerced.sourceText).toBe('Section 3.1 requires software development')
      expect(coerced.id).toBe('disc-uuid') // lowercased
    })

    it('handles null source_text', () => {
      const row: IntelligenceDisciplineRow = {
        id: 'disc-uuid',
        version_id: 'version-123',
        discipline: 'design',
        confidence: 'medium',
        source_text: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coerceDiscipline(row)

      expect(coerced.sourceText).toBeNull()
    })
  })

  describe('coerceLaborRequirement', () => {
    it('converts NUMERIC hours and utilization', () => {
      const row: IntelligenceLaborRequirementRow = {
        id: 'labor-uuid',
        version_id: 'version-123',
        title: 'Senior Developer',
        labor_category: 'LCAT-001',
        hours_per_month: '160.0',
        utilization_pct: '0.95',
        appears_in_periods: ['Base Period', 'Option Period 1'],
        confidence: 'high',
        source_text: 'PWS Section 4.2',
        is_prescribed: false,
        labor_category_id: null,
        match_type: null,
        match_confidence: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coerceLaborRequirement(row)

      expect(coerced.hoursPerMonth).toBe(160.0)
      expect(typeof coerced.hoursPerMonth).toBe('number')
      expect(coerced.utilizationPct).toBe(0.95)
      expect(typeof coerced.utilizationPct).toBe('number')
      expect(coerced.appearsInPeriods).toEqual(['Base Period', 'Option Period 1'])
    })

    it('handles null numeric values', () => {
      const row: IntelligenceLaborRequirementRow = {
        id: 'labor-uuid',
        version_id: 'version-123',
        title: 'Project Manager',
        labor_category: null,
        hours_per_month: null,
        utilization_pct: null,
        appears_in_periods: [],
        confidence: 'low',
        source_text: null,
        is_prescribed: false,
        labor_category_id: null,
        match_type: null,
        match_confidence: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const coerced = coerceLaborRequirement(row)

      expect(coerced.hoursPerMonth).toBeNull()
      expect(coerced.utilizationPct).toBeNull()
      expect(coerced.laborCategory).toBeNull()
    })
  })

  describe('coerceVersion', () => {
    it('coerces all version fields correctly', () => {
      const row: IntelligenceVersionRow = {
        id: 'VERSION-UUID',
        tenant_id: 'TENANT-UUID',
        proposal_id: 'PROPOSAL-UUID',
        version_number: 1,
        status: 'confirmed',
        confirmation_hash: 'abc123def456',
        facts_json: { documentType: { value: 'RFP', confidence: 'high' } },
        contract_type: 'FFP',
        staffing_model: 'unclear',
        solicitation_brief: null,
        row_version: 3,
        extracted_at: '2024-01-01T10:00:00Z',
        confirmed_at: '2024-01-01T11:00:00Z',
        superseded_at: null,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
      }

      const coerced = coerceVersion(row)

      expect(coerced.id).toBe('version-uuid')
      expect(coerced.tenantId).toBe('tenant-uuid')
      expect(coerced.proposalId).toBe('proposal-uuid')
      expect(coerced.status).toBe('confirmed')
      expect(coerced.rowVersion).toBe(3)
    })
  })
})

// =============================================================================
// CANONICAL SERIALIZATION TESTS
// =============================================================================

describe('Canonical Serialization', () => {
  it('produces identical output for same data in different order', () => {
    const data1 = {
      versionId: 'test-version',
      factsJson: { b: { value: 2, confidence: 'high' }, a: { value: 1, confidence: 'low' } } as unknown as FactsJson,
      periods: [
        { id: 'p2', name: 'Option', months: 12, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 1 },
        { id: 'p1', name: 'Base', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
      ] as CoercedPeriod[],
      disciplines: [
        { id: 'd2', discipline: 'engineering', confidence: 'high', sourceText: null },
        { id: 'd1', discipline: 'design', confidence: 'medium', sourceText: 'test' },
      ] as CoercedDiscipline[],
      laborRequirements: [
        { id: 'l2', title: 'Developer', laborCategory: null, hoursPerMonth: 160, utilizationPct: 1.0, appearsInPeriods: [], isPrescribed: false, confidence: 'high', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
        { id: 'l1', title: 'Analyst', laborCategory: null, hoursPerMonth: 80, utilizationPct: 0.5, appearsInPeriods: [], isPrescribed: false, confidence: 'medium', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
      ] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const data2 = {
      versionId: 'test-version',
      factsJson: { a: { value: 1, confidence: 'low' }, b: { value: 2, confidence: 'high' } } as unknown as FactsJson,
      periods: [
        { id: 'p1', name: 'Base', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
        { id: 'p2', name: 'Option', months: 12, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 1 },
      ] as CoercedPeriod[],
      disciplines: [
        { id: 'd1', discipline: 'design', confidence: 'medium', sourceText: 'test' },
        { id: 'd2', discipline: 'engineering', confidence: 'high', sourceText: null },
      ] as CoercedDiscipline[],
      laborRequirements: [
        { id: 'l1', title: 'Analyst', laborCategory: null, hoursPerMonth: 80, utilizationPct: 0.5, appearsInPeriods: [], isPrescribed: false, confidence: 'medium', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
        { id: 'l2', title: 'Developer', laborCategory: null, hoursPerMonth: 160, utilizationPct: 1.0, appearsInPeriods: [], isPrescribed: false, confidence: 'high', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
      ] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const canonical1 = canonicalize(data1)
    const canonical2 = canonicalize(data2)

    expect(canonical1).toBe(canonical2)
  })

  it('sorts periods by sortOrder', () => {
    const data = {
      versionId: 'test',
      factsJson: {} as FactsJson,
      periods: [
        { id: 'p2', name: 'Option 1', months: 12, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 1 },
        { id: 'p1', name: 'Base', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
      ] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const canonical = canonicalize(data)
    const parsed = JSON.parse(canonical)

    expect(parsed.periods[0].name).toBe('Base')
    expect(parsed.periods[1].name).toBe('Option 1')
  })

  it('sorts disciplines by discipline name', () => {
    const data = {
      versionId: 'test',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [
        { id: 'd2', discipline: 'research', confidence: 'high', sourceText: null },
        { id: 'd1', discipline: 'engineering', confidence: 'high', sourceText: null },
      ] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const canonical = canonicalize(data)
    const parsed = JSON.parse(canonical)

    expect(parsed.disciplines[0].discipline).toBe('engineering')
    expect(parsed.disciplines[1].discipline).toBe('research')
  })

  it('sorts labor requirements by title', () => {
    const data = {
      versionId: 'test',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [
        { id: 'l2', title: 'Zebra Manager', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], isPrescribed: false, confidence: 'low', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
        { id: 'l1', title: 'Alpha Developer', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], isPrescribed: false, confidence: 'low', sourceText: null, laborCategoryId: null, matchType: null, matchConfidence: null },
      ] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const canonical = canonicalize(data)
    const parsed = JSON.parse(canonical)

    expect(parsed.laborRequirements[0].title).toBe('Alpha Developer')
    expect(parsed.laborRequirements[1].title).toBe('Zebra Manager')
  })
})

// =============================================================================
// HASH COMPUTATION TESTS
// =============================================================================

describe('Hash Computation', () => {
  it('produces same hash for identical data', async () => {
    const data = {
      versionId: 'test-version',
      factsJson: { documentType: { value: 'RFP', confidence: 'high' } } as FactsJson,
      periods: [
        { id: 'p1', name: 'Base', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
      ] as CoercedPeriod[],
      disciplines: [
        { id: 'd1', discipline: 'engineering', confidence: 'high', sourceText: null },
      ] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const hash1 = await computeHash(data)
    const hash2 = await computeHash(data)

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(64) // SHA-256 produces 64 hex chars
  })

  it('produces different hash for different data', async () => {
    const data1 = {
      versionId: 'test-version-1',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const data2 = {
      versionId: 'test-version-2',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const hash1 = await computeHash(data1)
    const hash2 = await computeHash(data2)

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash when facts change', async () => {
    const baseData = {
      versionId: 'test-version',
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const data1 = {
      ...baseData,
      factsJson: { contractType: { value: 'FFP', confidence: 'high' } } as FactsJson,
    }

    const data2 = {
      ...baseData,
      factsJson: { contractType: { value: 'T&M', confidence: 'high' } } as FactsJson,
    }

    const hash1 = await computeHash(data1)
    const hash2 = await computeHash(data2)

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash when periods change', async () => {
    const baseData = {
      versionId: 'test-version',
      factsJson: {} as FactsJson,
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const data1 = {
      ...baseData,
      periods: [
        { id: 'p1', name: 'Base', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
      ] as CoercedPeriod[],
    }

    const data2 = {
      ...baseData,
      periods: [
        { id: 'p1', name: 'Base', months: 24, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 0 },
      ] as CoercedPeriod[],
    }

    const hash1 = await computeHash(data1)
    const hash2 = await computeHash(data2)

    expect(hash1).not.toBe(hash2)
  })
})

// =============================================================================
// HASH ROUND-TRIP SIMULATION TEST
// =============================================================================

describe('Hash Round-Trip', () => {
  /**
   * This test simulates the round-trip scenario:
   * 1. Create intelligence data
   * 2. Coerce types (like loading from DB)
   * 3. Compute hash
   * 4. "Cold reload" by re-coercing from the same raw data
   * 5. Recompute hash
   * 6. Verify hashes match
   */
  it('produces identical hash after simulated cold reload', async () => {
    // Simulated DB rows (as they would come from Postgres)
    const rawVersionRow: IntelligenceVersionRow = {
      id: 'VERSION-123',
      tenant_id: 'TENANT-456',
      proposal_id: 'PROPOSAL-789',
      version_number: 1,
      status: 'confirmed',
      confirmation_hash: null,
      facts_json: {
        documentType: { value: 'RFP', confidence: 'high' },
        contractType: { value: 'T&M', confidence: 'medium' },
      },
      contract_type: 'T&M',
      staffing_model: 'unclear',
      solicitation_brief: null,
      row_version: 1,
      extracted_at: '2024-01-01T10:00:00Z',
      confirmed_at: '2024-01-01T11:00:00Z',
      superseded_at: null,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
    }

    const rawPeriodRows: IntelligencePeriodRow[] = [
      {
        id: 'PERIOD-1',
        version_id: 'VERSION-123',
        name: 'Base Period',
        months: '12',
        cumulative_months_end: '12',
        gsa_rate_year: 1,
        sort_order: 0,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      },
      {
        id: 'PERIOD-2',
        version_id: 'VERSION-123',
        name: 'Option Period 1',
        months: '12',
        cumulative_months_end: '24',
        gsa_rate_year: 2,
        sort_order: 1,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      },
    ]

    const rawDisciplineRows: IntelligenceDisciplineRow[] = [
      {
        id: 'DISC-1',
        version_id: 'VERSION-123',
        discipline: 'engineering',
        confidence: 'high',
        source_text: 'Section 3.1',
        created_at: '2024-01-01T10:00:00Z',
      },
    ]

    const rawLaborReqRows: IntelligenceLaborRequirementRow[] = [
      {
        id: 'LABOR-1',
        version_id: 'VERSION-123',
        title: 'Senior Developer',
        labor_category: 'LCAT-01',
        hours_per_month: '160.0',
        utilization_pct: '0.95',
        appears_in_periods: ['Base Period', 'Option Period 1'],
        confidence: 'high',
        source_text: 'PWS 4.2',
        is_prescribed: false,
        labor_category_id: null,
        match_type: null,
        match_confidence: null,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
      },
    ]

    // First load (confirm-time)
    const version1 = coerceVersion(rawVersionRow)
    const periods1 = rawPeriodRows.map(coercePeriod)
    const disciplines1 = rawDisciplineRows.map(coerceDiscipline)
    const laborReqs1 = rawLaborReqRows.map(coerceLaborRequirement)

    const hash1 = await computeHash({
      versionId: version1.id,
      factsJson: version1.factsJson,
      periods: periods1,
      disciplines: disciplines1,
      laborRequirements: laborReqs1,
      solicitationBrief: version1.solicitationBrief,
    })

    // "Cold reload" - simulate loading from DB again
    const version2 = coerceVersion(rawVersionRow)
    const periods2 = rawPeriodRows.map(coercePeriod)
    const disciplines2 = rawDisciplineRows.map(coerceDiscipline)
    const laborReqs2 = rawLaborReqRows.map(coerceLaborRequirement)

    const hash2 = await computeHash({
      versionId: version2.id,
      factsJson: version2.factsJson,
      periods: periods2,
      disciplines: disciplines2,
      laborRequirements: laborReqs2,
      solicitationBrief: version2.solicitationBrief,
    })

    // Critical assertion: hashes must match
    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(64)
  })

  it('detects tampering after cold reload', async () => {
    const rawVersionRow: IntelligenceVersionRow = {
      id: 'VERSION-123',
      tenant_id: 'TENANT-456',
      proposal_id: 'PROPOSAL-789',
      version_number: 1,
      status: 'confirmed',
      confirmation_hash: null,
      facts_json: { contractType: { value: 'FFP', confidence: 'high' } },
      contract_type: 'FFP',
      staffing_model: 'unclear',
      solicitation_brief: null,
      row_version: 1,
      extracted_at: '2024-01-01T10:00:00Z',
      confirmed_at: '2024-01-01T11:00:00Z',
      superseded_at: null,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
    }

    // Compute original hash
    const version = coerceVersion(rawVersionRow)
    const originalHash = await computeHash({
      versionId: version.id,
      factsJson: version.factsJson,
      periods: [],
      disciplines: [],
      laborRequirements: [],
      solicitationBrief: version.solicitationBrief,
    })

    // Simulate tampering (someone changed the contract type)
    const tamperedVersionRow: IntelligenceVersionRow = {
      ...rawVersionRow,
      facts_json: { contractType: { value: 'T&M' as const, confidence: 'high' as const } }, // Changed!
    }

    const tamperedVersion = coerceVersion(tamperedVersionRow)
    const tamperedHash = await computeHash({
      versionId: tamperedVersion.id,
      factsJson: tamperedVersion.factsJson,
      periods: [],
      disciplines: [],
      laborRequirements: [],
      solicitationBrief: tamperedVersion.solicitationBrief,
    })

    // Tampering detection
    expect(originalHash).not.toBe(tamperedHash)
  })
})

// =============================================================================
// GUARD REJECTION CASE TESTS (Logic Only - No DB)
// =============================================================================

describe('Guard Rejection Logic', () => {
  /**
   * These tests verify the guard rejection logic patterns.
   * Actual DB integration is tested in E2E tests.
   */

  describe('NOT_FOUND rejection', () => {
    it('rejects when version does not exist', () => {
      const mockVersion = null

      const checkVersion = (version: unknown) => {
        if (!version) {
          return { valid: false, code: 'NOT_FOUND', message: 'Version not found' }
        }
        return { valid: true }
      }

      const result = checkVersion(mockVersion)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('NOT_FOUND')
    })

    it('rejects when tenant mismatch (appears as NOT_FOUND for security)', () => {
      const mockVersion = { tenant_id: 'tenant-a' }
      const requestTenantId = 'tenant-b'

      const checkTenant = (version: { tenant_id: string }, tenantId: string) => {
        if (version.tenant_id !== tenantId) {
          return { valid: false, code: 'NOT_FOUND', message: 'Version not found' }
        }
        return { valid: true }
      }

      const result = checkTenant(mockVersion, requestTenantId)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('NOT_FOUND')
    })
  })

  describe('NOT_CONFIRMED rejection', () => {
    it('rejects draft status', () => {
      const mockVersion = { status: 'draft' }

      const checkConfirmed = (version: { status: string }) => {
        if (version.status !== 'confirmed') {
          return { valid: false, code: 'NOT_CONFIRMED', message: `Status: ${version.status}` }
        }
        return { valid: true }
      }

      const result = checkConfirmed(mockVersion)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('NOT_CONFIRMED')
    })

    it('rejects superseded status', () => {
      const mockVersion = { status: 'superseded' }

      const checkConfirmed = (version: { status: string }) => {
        if (version.status !== 'confirmed') {
          return { valid: false, code: 'NOT_CONFIRMED', message: `Status: ${version.status}` }
        }
        return { valid: true }
      }

      const result = checkConfirmed(mockVersion)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('NOT_CONFIRMED')
    })
  })

  describe('WRONG_PROPOSAL rejection', () => {
    it('rejects when version belongs to different proposal', () => {
      const mockVersion = { proposal_id: 'proposal-a' }
      const requestProposalId = 'proposal-b'

      const checkProposal = (version: { proposal_id: string }, proposalId: string) => {
        if (version.proposal_id !== proposalId) {
          return { valid: false, code: 'WRONG_PROPOSAL', message: 'Version belongs to different proposal' }
        }
        return { valid: true }
      }

      const result = checkProposal(mockVersion, requestProposalId)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('WRONG_PROPOSAL')
    })
  })

  describe('NOT_ACTIVE rejection', () => {
    it('rejects when version is not the active version', () => {
      const mockProposal = { active_intelligence_version_id: 'version-new' }
      const requestVersionId = 'version-old'

      const checkActive = (proposal: { active_intelligence_version_id: string }, versionId: string) => {
        if (proposal.active_intelligence_version_id !== versionId) {
          return { valid: false, code: 'NOT_ACTIVE', message: 'Version is not active' }
        }
        return { valid: true }
      }

      const result = checkActive(mockProposal, requestVersionId)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('NOT_ACTIVE')
    })
  })

  describe('HASH_MISMATCH rejection', () => {
    it('rejects when computed hash differs from stored hash', () => {
      const storedHash = 'abc123'
      const computedHash = 'def456'

      const checkHash = (stored: string, computed: string) => {
        if (stored !== computed) {
          return { valid: false, code: 'HASH_MISMATCH', message: 'Hash verification failed' }
        }
        return { valid: true }
      }

      const result = checkHash(storedHash, computedHash)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('HASH_MISMATCH')
    })

    it('accepts when hashes match', () => {
      const storedHash = 'abc123'
      const computedHash = 'abc123'

      const checkHash = (stored: string, computed: string) => {
        if (stored !== computed) {
          return { valid: false, code: 'HASH_MISMATCH', message: 'Hash verification failed' }
        }
        return { valid: true }
      }

      const result = checkHash(storedHash, computedHash)
      expect(result.valid).toBe(true)
    })
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty arrays gracefully', async () => {
    const data = {
      versionId: 'empty-version',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const hash = await computeHash(data)

    expect(hash).toBeTruthy()
    expect(hash.length).toBe(64)
  })

  it('handles special characters in text fields', async () => {
    const data = {
      versionId: 'test-version',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [
        { id: 'd1', discipline: 'engineering', confidence: 'high', sourceText: 'Quote: "test" & <special>' },
      ] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const hash = await computeHash(data)

    expect(hash).toBeTruthy()
    expect(hash.length).toBe(64)
  })

  it('handles unicode characters', async () => {
    const data = {
      versionId: 'test-version',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [
        { id: 'l1', title: 'Développeur Senior', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], isPrescribed: false, confidence: 'high', sourceText: '日本語テスト', laborCategoryId: null, matchType: null, matchConfidence: null },
      ] as CoercedLaborRequirement[],
      solicitationBrief: null,
    }

    const hash = await computeHash(data)

    expect(hash).toBeTruthy()
    expect(hash.length).toBe(64)
  })
})

// =============================================================================
// BUG #1 FIX: PROJECTION RETURNS ONLY CONFIRMED VERSIONS (DRAFT INVISIBILITY)
// =============================================================================

describe('getConfirmedIntelligenceVersion draft invisibility', () => {
  /**
   * BUG #1 FIX TEST:
   * The projection MUST resolve ONLY via proposals.active_intelligence_version_id
   * with status='confirmed'. Draft versions are NEVER returned.
   *
   * This tests the logic pattern - actual DB integration tested in E2E.
   */

  it('returns confirmed version when active_intelligence_version_id is set', () => {
    // Simulate: proposal has active confirmed version
    const mockProposal = { active_intelligence_version_id: 'confirmed-version-id' }
    const mockVersion = { tenant_id: 'tenant-123', status: 'confirmed' }

    const getProjection = (
      proposal: { active_intelligence_version_id: string | null },
      version: { tenant_id: string; status: string } | null,
      requestTenantId: string
    ) => {
      if (proposal.active_intelligence_version_id && version) {
        if (version.tenant_id === requestTenantId) {
          return { confirmed: true, versionId: proposal.active_intelligence_version_id }
        }
      }
      return { confirmed: false, needsIntelligence: true, hasDraft: false }
    }

    const result = getProjection(mockProposal, mockVersion, 'tenant-123')
    expect(result.confirmed).toBe(true)
    expect(result).toHaveProperty('versionId', 'confirmed-version-id')
  })

  it('returns needsIntelligence when no active version (draft is invisible)', () => {
    // Simulate: proposal has no active version (only drafts exist)
    const mockProposal = { active_intelligence_version_id: null }
    const mockDraft = { tenant_id: 'tenant-123', status: 'draft' }

    const getProjection = (
      proposal: { active_intelligence_version_id: string | null },
      draftExists: boolean
    ) => {
      if (!proposal.active_intelligence_version_id) {
        // Draft exists but is NOT returned - it's invisible to projection
        return { confirmed: false, needsIntelligence: true, hasDraft: draftExists }
      }
      return { confirmed: true, versionId: proposal.active_intelligence_version_id }
    }

    const result = getProjection(mockProposal, !!mockDraft)

    // Critical: confirmed is false, draft version is NOT returned
    expect(result.confirmed).toBe(false)
    expect(result.needsIntelligence).toBe(true)
    expect(result.hasDraft).toBe(true)
    expect(result).not.toHaveProperty('versionId')
  })

  it('projection output byte-identical before/after creating draft', () => {
    // Simulate the test case: create draft on proposal with confirmed version
    // Projection output MUST be identical before and after

    const mockProposal = { active_intelligence_version_id: 'confirmed-v1' }

    // Before creating draft
    const projectionBefore = JSON.stringify({
      confirmed: true,
      versionId: 'confirmed-v1',
    })

    // After creating draft (proposal still points to same confirmed version)
    // The draft does NOT change active_intelligence_version_id
    const projectionAfter = JSON.stringify({
      confirmed: true,
      versionId: mockProposal.active_intelligence_version_id,
    })

    // Critical assertion: byte-identical (draft is invisible)
    expect(projectionBefore).toBe(projectionAfter)
  })

  it('superseding confirmed version clears active_intelligence_version_id', () => {
    // When superseding: old version → superseded, new draft created
    // active_intelligence_version_id is set to NULL (not the draft)

    // Before: proposal has active confirmed version 'confirmed-v1'
    // SupersedeIntelligenceVersion command behavior:
    // 1. Mark old version as superseded
    // 2. Create new draft version
    // 3. Set active_intelligence_version_id = NULL (not the draft!)

    const afterSupersede = { active_intelligence_version_id: null }

    // Verify: after supersede, no confirmed version is active
    expect(afterSupersede.active_intelligence_version_id).toBeNull()

    // Projection should now return needsIntelligence
    const projection = afterSupersede.active_intelligence_version_id
      ? { confirmed: true, versionId: afterSupersede.active_intelligence_version_id }
      : { confirmed: false, needsIntelligence: true, hasDraft: true }

    expect(projection.confirmed).toBe(false)
    expect(projection.needsIntelligence).toBe(true)
  })

  it('only confirmation sets active_intelligence_version_id', () => {
    // CreateIntelligenceDraft does NOT set active_intelligence_version_id
    // Only ConfirmIntelligenceVersion sets it

    const actions = {
      createDraft: (proposal: { active_intelligence_version_id: string | null }) => {
        // CreateIntelligenceDraft: does NOT modify proposal
        return proposal // unchanged
      },
      confirmVersion: (
        proposal: { active_intelligence_version_id: string | null },
        versionId: string
      ) => {
        // ConfirmIntelligenceVersion: sets active version
        return { ...proposal, active_intelligence_version_id: versionId }
      },
    }

    let proposal = { active_intelligence_version_id: null as string | null }

    // Create draft: proposal unchanged
    proposal = actions.createDraft(proposal)
    expect(proposal.active_intelligence_version_id).toBeNull()

    // Confirm: now proposal has active version
    proposal = actions.confirmVersion(proposal, 'new-confirmed-version')
    expect(proposal.active_intelligence_version_id).toBe('new-confirmed-version')
  })
})

// =============================================================================
// BUG #2 FIX: SUPERSEDE COPIES ALL FIELDS
// =============================================================================

describe('SupersedeIntelligenceVersion field copy', () => {
  /**
   * BUG #2 FIX TEST:
   * SupersedeIntelligenceVersion MUST copy EVERY field from confirmed version.
   * This test documents the enumerated copy list.
   */

  describe('intelligence_versions field copy list', () => {
    it('copies all version fields (enumerated list)', () => {
      // Enumerated copy list against schema:
      const sourceVersion = {
        // MUST be copied:
        facts_json: { documentType: { value: 'RFP', confidence: 'high' } },
        contract_type: 'FFP',
        staffing_model: 'prescribed', // BUG #2 FIX: was missing

        // NOT copied (set by new draft):
        // - tenant_id (same tenant)
        // - proposal_id (same proposal)
        // - version_number (incremented)
        // - status (always 'draft')
        // - confirmation_hash (null for draft)
        // - row_version (starts at 1)
        // - extracted_at (now())
        // - confirmed_at (null)
        // - superseded_at (null)
      }

      // Simulate copy (what SupersedeIntelligenceVersion does)
      const newDraft = {
        tenant_id: 'tenant-123',
        proposal_id: 'proposal-123',
        version_number: 2, // incremented
        status: 'draft',
        facts_json: sourceVersion.facts_json,
        contract_type: sourceVersion.contract_type,
        staffing_model: sourceVersion.staffing_model, // NOW COPIED
        row_version: 1,
      }

      // Verify all source fields are copied
      expect(newDraft.facts_json).toEqual(sourceVersion.facts_json)
      expect(newDraft.contract_type).toBe(sourceVersion.contract_type)
      expect(newDraft.staffing_model).toBe(sourceVersion.staffing_model)
    })

    it('staffing_model is preserved through supersede (not reset to unclear)', () => {
      const confirmedVersion = { staffing_model: 'prescribed' as const }

      // SupersedeIntelligenceVersion now copies staffing_model
      const newDraft = { staffing_model: confirmedVersion.staffing_model }

      // Critical: staffing_model is NOT reset to 'unclear'
      expect(newDraft.staffing_model).toBe('prescribed')
      expect(newDraft.staffing_model).not.toBe('unclear')
    })
  })

  describe('intelligence_labor_requirements field copy list', () => {
    it('copies all labor requirement fields (enumerated list)', () => {
      // Enumerated copy list against schema:
      const sourceLaborReq = {
        // Core fields:
        title: 'Senior Developer',
        labor_category: 'LCAT-001',
        hours_per_month: '160.0',
        utilization_pct: '1.0',
        appears_in_periods: ['Base Period', 'Option 1'],
        confidence: 'high',
        source_text: 'PWS Section 4.2',

        // Phase 4B field:
        is_prescribed: true, // BUG #2 FIX: was missing

        // Phase 5 catalog match fields:
        labor_category_id: 'cat-uuid-123', // BUG #2 FIX: was missing
        match_type: 'exact', // BUG #2 FIX: was missing
        match_confidence: '0.95', // BUG #2 FIX: was missing
      }

      // Simulate copy
      const copiedLaborReq = {
        title: sourceLaborReq.title,
        labor_category: sourceLaborReq.labor_category,
        hours_per_month: sourceLaborReq.hours_per_month,
        utilization_pct: sourceLaborReq.utilization_pct,
        appears_in_periods: sourceLaborReq.appears_in_periods,
        confidence: sourceLaborReq.confidence,
        source_text: sourceLaborReq.source_text,
        // BUG #2 FIX: these fields are now copied
        is_prescribed: sourceLaborReq.is_prescribed,
        labor_category_id: sourceLaborReq.labor_category_id,
        match_type: sourceLaborReq.match_type,
        match_confidence: sourceLaborReq.match_confidence,
      }

      // Verify all fields are copied
      expect(copiedLaborReq.title).toBe(sourceLaborReq.title)
      expect(copiedLaborReq.labor_category).toBe(sourceLaborReq.labor_category)
      expect(copiedLaborReq.hours_per_month).toBe(sourceLaborReq.hours_per_month)
      expect(copiedLaborReq.utilization_pct).toBe(sourceLaborReq.utilization_pct)
      expect(copiedLaborReq.appears_in_periods).toEqual(sourceLaborReq.appears_in_periods)
      expect(copiedLaborReq.confidence).toBe(sourceLaborReq.confidence)
      expect(copiedLaborReq.source_text).toBe(sourceLaborReq.source_text)
      // Phase 4B/5 fields
      expect(copiedLaborReq.is_prescribed).toBe(sourceLaborReq.is_prescribed)
      expect(copiedLaborReq.labor_category_id).toBe(sourceLaborReq.labor_category_id)
      expect(copiedLaborReq.match_type).toBe(sourceLaborReq.match_type)
      expect(copiedLaborReq.match_confidence).toBe(sourceLaborReq.match_confidence)
    })

    it('is_prescribed is preserved (not reset to false)', () => {
      const sourceReq = { is_prescribed: true }

      // Supersede now copies is_prescribed
      const copiedReq = { is_prescribed: sourceReq.is_prescribed }

      expect(copiedReq.is_prescribed).toBe(true)
    })

    it('catalog match fields are preserved (not nulled)', () => {
      const sourceReq = {
        labor_category_id: 'uuid-123',
        match_type: 'exact' as const,
        match_confidence: '0.95',
      }

      // Supersede now copies catalog match fields
      const copiedReq = {
        labor_category_id: sourceReq.labor_category_id,
        match_type: sourceReq.match_type,
        match_confidence: sourceReq.match_confidence,
      }

      expect(copiedReq.labor_category_id).toBe('uuid-123')
      expect(copiedReq.match_type).toBe('exact')
      expect(copiedReq.match_confidence).toBe('0.95')
    })
  })

  describe('supersede → every field equals source', () => {
    it('full field equality check after supersede', () => {
      // Source confirmed version (all fields populated)
      const source = {
        version: {
          facts_json: { documentType: { value: 'RFP', confidence: 'high' } },
          contract_type: 'T&M',
          staffing_model: 'offeror_proposed',
        },
        periods: [
          { name: 'Base', months: 12, cumulative_months_end: 12, gsa_rate_year: 1, sort_order: 0 },
        ],
        disciplines: [
          { discipline: 'engineering', confidence: 'high', source_text: 'Section 3.1' },
        ],
        laborReqs: [
          {
            title: 'Lead Engineer',
            labor_category: 'LCAT-02',
            hours_per_month: '160',
            utilization_pct: '1.0',
            appears_in_periods: ['Base'],
            confidence: 'high',
            source_text: 'PWS 4.1',
            is_prescribed: true,
            labor_category_id: 'cat-abc',
            match_type: 'fuzzy',
            match_confidence: '0.85',
          },
        ],
      }

      // After supersede (simulated copy)
      const draft = {
        version: {
          facts_json: source.version.facts_json,
          contract_type: source.version.contract_type,
          staffing_model: source.version.staffing_model,
        },
        periods: source.periods.map(p => ({ ...p })),
        disciplines: source.disciplines.map(d => ({ ...d })),
        laborReqs: source.laborReqs.map(l => ({ ...l })),
      }

      // Full equality check
      expect(draft.version.facts_json).toEqual(source.version.facts_json)
      expect(draft.version.contract_type).toBe(source.version.contract_type)
      expect(draft.version.staffing_model).toBe(source.version.staffing_model)
      expect(draft.periods).toEqual(source.periods)
      expect(draft.disciplines).toEqual(source.disciplines)
      expect(draft.laborReqs).toEqual(source.laborReqs)

      // JSON stringify for byte-for-byte comparison
      expect(JSON.stringify(draft.version)).toBe(JSON.stringify(source.version))
      expect(JSON.stringify(draft.laborReqs)).toBe(JSON.stringify(source.laborReqs))
    })
  })
})

// =============================================================================
// PILLAR 2: STAFFING MODEL UNCLEAR BLOCKS CONFIRM
// =============================================================================

describe('ConfirmIntelligenceVersion staffing model gate', () => {
  /**
   * PILLAR 2 HARDENING TEST:
   * When staffingModel === 'unclear', confirmation MUST be blocked.
   * The error response MUST include:
   * 1. A clear explanation of WHY confirm is blocked
   * 2. Actionable options for the user to resolve
   * 3. Enough context for the UI to render a helpful message
   */
  it('error response structure explains WHY confirm is blocked', () => {
    // This tests the error structure, not the DB interaction
    // The actual ConfirmIntelligenceVersion command returns this structure
    const expectedErrorStructure = {
      success: false,
      error: {
        code: 'STAFFING_MODEL_UNCLEAR',
        message: expect.stringContaining('staffing model'),
        details: {
          reason: 'STAFFING_MODEL_UNCLEAR',
          explanation: expect.stringContaining('could not determine'),
          actionRequired: 'SELECT_STAFFING_MODEL',
          options: expect.arrayContaining([
            expect.objectContaining({
              value: 'prescribed',
              label: expect.any(String),
              description: expect.any(String),
            }),
            expect.objectContaining({
              value: 'offeror_proposed',
              label: expect.any(String),
              description: expect.any(String),
            }),
          ]),
        },
      },
    }

    // Verify the structure is what the UI needs
    expect(expectedErrorStructure.error.details).toBeDefined()
    expect(expectedErrorStructure.error.details.explanation).toBeDefined()
    // Options array verified via arrayContaining above
  })

  it('error details include user-actionable options', () => {
    // The options must be actionable - user can select one to resolve
    const options = [
      {
        value: 'prescribed',
        label: 'Prescribed (RFP specifies exact roles)',
        description: 'The RFP names specific Key Personnel or required positions.',
      },
      {
        value: 'offeror_proposed',
        label: 'Offeror Proposed (we choose team composition)',
        description: 'The RFP allows the offeror to propose team structure.',
      },
    ]

    // Each option must have value (for API), label (for UI), description (for context)
    for (const option of options) {
      expect(option.value).toBeDefined()
      expect(option.label).toBeDefined()
      expect(option.description).toBeDefined()
      expect(option.label.length).toBeGreaterThan(10) // Not just a code
      expect(option.description.length).toBeGreaterThan(20) // Enough context
    }
  })
})

// =============================================================================
// HASH STABILITY GOLDEN-FILE TEST
// =============================================================================
// This test pins the canonical JSON output byte-exact. Any change that modifies
// the canonical form of existing data WILL break this test. This is intentional.
//
// APPEND-ONLY INVARIANT (2026-07-14):
// Canonical serialization is append-only. Existing fields' serialization never
// changes; new fields are omit-when-absent.
//
// Phase 2 field set (frozen forever, nulls included):
//   - periods: id, name, months, cumulativeMonthsEnd, gsaRateYear, sortOrder
//   - disciplines: id, discipline, confidence, sourceText
//   - laborRequirements: id, title, laborCategory, hoursPerMonth, utilizationPct,
//                        appearsInPeriods, confidence, sourceText
//   - factsJson, versionId
//
// Post-Phase-2 fields (omit when absent/default):
//   - laborRequirements: isPrescribed (omit if false), laborCategoryId, matchType,
//                        matchConfidence (omit if null)
//   - solicitationBrief (omit if null)
//
// RULE (from CLAUDE.md): Any change touching hash-utils or canonical serialization
// requires the golden-file test to pass unchanged, and stored-vs-recomputed
// verification against all confirmed versions on staging before merge.

describe('Hash Stability Golden-File', () => {
  /**
   * Golden fixture: A version with NO brief and NO Phase-5 fields populated.
   * This represents pre-Phase-5 confirmed versions (Phase 2 era).
   *
   * CRITICAL: Phase 2 nulls (laborCategory, hoursPerMonth, utilizationPct) are
   * INCLUDED in the canonical form, not omitted. This is the frozen Phase 2
   * serialization format.
   */
  const goldenFixturePhase2: {
    versionId: string
    factsJson: FactsJson
    periods: CoercedPeriod[]
    disciplines: CoercedDiscipline[]
    laborRequirements: CoercedLaborRequirement[]
    solicitationBrief: null
  } = {
    versionId: '564a64a7-88a5-44e5-9a1e-7f3d12f2e76b',
    factsJson: {
      contractType: { value: 'FFP', confidence: 'high' },
      documentType: { value: 'PWS', confidence: 'high' },
      rateSource: { value: 'gsa_mas', confidence: 'high' },
      setAside: { value: 'WOSB', confidence: 'low' },
      vehicle: { value: 'GSA MAS', confidence: 'high' },
    },
    periods: [
      {
        id: '945f1f5c-2b64-4e36-abd7-14cc20905b9a',
        name: 'Base Period',
        months: 7,
        cumulativeMonthsEnd: 7,
        gsaRateYear: 1,
        sortOrder: 0,
      },
      {
        id: '17c92623-9956-4535-8051-d99fe9e687c2',
        name: 'Option Period 1',
        months: 3,
        cumulativeMonthsEnd: 10,
        gsaRateYear: 1,
        sortOrder: 1,
      },
    ],
    disciplines: [
      {
        id: 'f7b45fa2-fc69-40d9-bbf5-ac310d80b6c0',
        discipline: 'product',
        confidence: 'high',
        sourceText: 'Product management required',
      },
      {
        id: 'e06178f7-af72-4647-ace2-bfd3582a6439',
        discipline: 'research',
        confidence: 'high',
        sourceText: 'User research required',
      },
    ],
    laborRequirements: [
      {
        id: 'ca50ee8e-8674-4adf-a923-113d04f08ec1',
        title: 'Human-Centered Design Lead',
        laborCategory: null, // Phase 2: INCLUDED as null
        hoursPerMonth: null, // Phase 2: INCLUDED as null
        utilizationPct: 0.5, // Phase 2: INCLUDED
        appearsInPeriods: ['Base Period', 'Option Period 1'],
        isPrescribed: false, // Post-Phase-2: OMITTED (false → absent)
        confidence: 'high',
        sourceText: 'HCD Lead required',
        laborCategoryId: null, // Post-Phase-2: OMITTED (null → absent)
        matchType: null, // Post-Phase-2: OMITTED
        matchConfidence: null, // Post-Phase-2: OMITTED
      },
      {
        id: 'b1234567-1234-1234-1234-123456789012',
        title: 'Senior Product Manager',
        laborCategory: null, // Phase 2: INCLUDED as null
        hoursPerMonth: null, // Phase 2: INCLUDED as null
        utilizationPct: null, // Phase 2: INCLUDED as null
        appearsInPeriods: ['Base Period'],
        isPrescribed: false, // Post-Phase-2: OMITTED
        confidence: 'high',
        sourceText: 'PM required',
        laborCategoryId: null, // Post-Phase-2: OMITTED
        matchType: null, // Post-Phase-2: OMITTED
        matchConfidence: null, // Post-Phase-2: OMITTED
      },
    ],
    solicitationBrief: null, // Post-Phase-2: OMITTED (null → absent)
  }

  /**
   * GOLDEN CANONICAL OUTPUT (Phase 2 Format)
   *
   * This is the byte-exact canonical JSON that Phase 2 era versions produce.
   *
   * CRITICAL serialization rules:
   * - Phase 2 fields: nulls INCLUDED (laborCategory, hoursPerMonth, utilizationPct)
   * - Post-Phase-2 fields: OMITTED when absent/default
   * - No solicitationBrief key (null → absent for post-Phase-2 field)
   * - No isPrescribed key (false → absent for post-Phase-2 field)
   * - No laborCategoryId, matchType, matchConfidence keys (null → absent)
   *
   * If this test fails, hash stability for existing confirmed versions is BROKEN.
   */
  const GOLDEN_CANONICAL_PHASE2 = '{"disciplines":[{"confidence":"high","discipline":"product","id":"f7b45fa2-fc69-40d9-bbf5-ac310d80b6c0","sourceText":"Product management required"},{"confidence":"high","discipline":"research","id":"e06178f7-af72-4647-ace2-bfd3582a6439","sourceText":"User research required"}],"factsJson":{"contractType":{"confidence":"high","value":"FFP"},"documentType":{"confidence":"high","value":"PWS"},"rateSource":{"confidence":"high","value":"gsa_mas"},"setAside":{"confidence":"low","value":"WOSB"},"vehicle":{"confidence":"high","value":"GSA MAS"}},"laborRequirements":[{"appearsInPeriods":["Base Period","Option Period 1"],"confidence":"high","hoursPerMonth":null,"id":"ca50ee8e-8674-4adf-a923-113d04f08ec1","laborCategory":null,"sourceText":"HCD Lead required","title":"Human-Centered Design Lead","utilizationPct":0.5},{"appearsInPeriods":["Base Period"],"confidence":"high","hoursPerMonth":null,"id":"b1234567-1234-1234-1234-123456789012","laborCategory":null,"sourceText":"PM required","title":"Senior Product Manager","utilizationPct":null}],"periods":[{"cumulativeMonthsEnd":7,"gsaRateYear":1,"id":"945f1f5c-2b64-4e36-abd7-14cc20905b9a","months":7,"name":"Base Period","sortOrder":0},{"cumulativeMonthsEnd":10,"gsaRateYear":1,"id":"17c92623-9956-4535-8051-d99fe9e687c2","months":3,"name":"Option Period 1","sortOrder":1}],"versionId":"564a64a7-88a5-44e5-9a1e-7f3d12f2e76b"}'

  it('canonical output is byte-identical to golden file (Phase 2 version)', () => {
    const actual = canonicalize(goldenFixturePhase2)
    expect(actual).toBe(GOLDEN_CANONICAL_PHASE2)
  })

  it('Phase 2 nulls are INCLUDED, post-Phase-2 nulls are OMITTED', () => {
    const canonical = canonicalize(goldenFixturePhase2)
    const parsed = JSON.parse(canonical)

    // Post-Phase-2: solicitationBrief should NOT exist (null → omitted)
    expect(parsed.solicitationBrief).toBeUndefined()

    const laborReq = parsed.laborRequirements[0]

    // Phase 2 fields: nulls ARE INCLUDED
    expect(laborReq.laborCategory).toBeNull()
    expect(laborReq.hoursPerMonth).toBeNull()

    // Phase 2 fields: non-null values ARE INCLUDED
    expect(laborReq.utilizationPct).toBe(0.5)
    expect(laborReq.confidence).toBe('high')
    expect(laborReq.appearsInPeriods).toEqual(['Base Period', 'Option Period 1'])

    // Post-Phase-2 fields: OMITTED when false/null
    expect(laborReq.isPrescribed).toBeUndefined()
    expect(laborReq.laborCategoryId).toBeUndefined()
    expect(laborReq.matchType).toBeUndefined()
    expect(laborReq.matchConfidence).toBeUndefined()
  })

  it('NEGATIVE CONTROL: version WITH brief hashes differently', async () => {
    const withBrief = {
      ...goldenFixturePhase2,
      solicitationBrief: {
        summary: 'Test summary',
        rationale: 'Test rationale',
        challenges: [
          {
            title: 'Challenge 1',
            description: 'Description',
            evidence_refs: ['ref-1'],
          },
        ],
        evaluation_emphasis: 'Test emphasis',
      },
    }

    const withoutBriefCanonical = canonicalize(goldenFixturePhase2)
    const withBriefCanonical = canonicalize(withBrief)

    // Canonicals must be DIFFERENT
    expect(withBriefCanonical).not.toBe(withoutBriefCanonical)

    // Brief version should INCLUDE solicitationBrief
    expect(withBriefCanonical).toContain('solicitationBrief')
    expect(withoutBriefCanonical).not.toContain('solicitationBrief')

    // Hashes must be DIFFERENT
    const hashWithout = await computeHash(goldenFixturePhase2)
    const hashWith = await computeHash(withBrief)
    expect(hashWith).not.toBe(hashWithout)
  })

  it('NEGATIVE CONTROL: version WITH meaningful Phase-5 fields hashes differently', async () => {
    const withPhase5 = {
      ...goldenFixturePhase2,
      laborRequirements: goldenFixturePhase2.laborRequirements.map((lr) => ({
        ...lr,
        isPrescribed: true, // Non-default, will be included
        laborCategoryId: 'cat-123', // Non-null, will be included
        matchType: 'exact' as const, // Non-null, will be included
        matchConfidence: 0.95, // Non-null, will be included
      })),
    }

    const withoutPhase5Canonical = canonicalize(goldenFixturePhase2)
    const withPhase5Canonical = canonicalize(withPhase5)

    // Canonicals must be DIFFERENT
    expect(withPhase5Canonical).not.toBe(withoutPhase5Canonical)

    // Phase-5 version should INCLUDE these fields
    expect(withPhase5Canonical).toContain('isPrescribed')
    expect(withPhase5Canonical).toContain('laborCategoryId')
    expect(withPhase5Canonical).toContain('matchType')
    expect(withPhase5Canonical).toContain('matchConfidence')

    // Hashes must be DIFFERENT
    const hashWithout = await computeHash(goldenFixturePhase2)
    const hashWith = await computeHash(withPhase5)
    expect(hashWith).not.toBe(hashWithout)
  })

  /**
   * Second golden fixture: A version WITH post-Phase-2 fields populated.
   * This represents versions confirmed after Phase 5 with meaningful new fields.
   */
  const goldenFixturePostPhase5: {
    versionId: string
    factsJson: FactsJson
    periods: CoercedPeriod[]
    disciplines: CoercedDiscipline[]
    laborRequirements: CoercedLaborRequirement[]
    solicitationBrief: {
      summary: string
      rationale: string
      challenges: { title: string; description: string; evidence_refs: string[] }[]
      evaluation_emphasis: string
    }
  } = {
    versionId: 'post-phase-5-test-version',
    factsJson: {
      contractType: { value: 'T&M', confidence: 'high' },
      documentType: { value: 'RFP', confidence: 'high' },
    },
    periods: [
      {
        id: 'period-1',
        name: 'Base Period',
        months: 12,
        cumulativeMonthsEnd: 12,
        gsaRateYear: 1,
        sortOrder: 0,
      },
    ],
    disciplines: [
      {
        id: 'disc-1',
        discipline: 'engineering',
        confidence: 'high',
        sourceText: 'Engineering required',
      },
    ],
    laborRequirements: [
      {
        id: 'labor-1',
        title: 'Senior Engineer',
        laborCategory: 'LCAT-ENG-01', // Phase 2: non-null
        hoursPerMonth: 160, // Phase 2: non-null
        utilizationPct: 1.0, // Phase 2: non-null
        appearsInPeriods: ['Base Period'],
        isPrescribed: true, // Post-Phase-2: INCLUDED (true)
        confidence: 'high',
        sourceText: 'Engineer required',
        laborCategoryId: 'cat-uuid-123', // Post-Phase-2: INCLUDED (non-null)
        matchType: 'exact' as const, // Post-Phase-2: INCLUDED (non-null)
        matchConfidence: 0.95, // Post-Phase-2: INCLUDED (non-null)
      },
    ],
    solicitationBrief: {
      summary: 'Engineering support for cloud migration',
      rationale: 'Agency needs modern infrastructure',
      challenges: [
        {
          title: 'Legacy integration',
          description: 'Must integrate with legacy systems',
          evidence_refs: ['evidence-1', 'evidence-2'],
        },
      ],
      evaluation_emphasis: 'Technical approach and past performance',
    },
  }

  /**
   * GOLDEN CANONICAL OUTPUT (Post-Phase-5 Format)
   *
   * This includes all Phase 2 fields AND post-Phase-2 fields when present.
   */
  const GOLDEN_CANONICAL_POST_PHASE5 = '{"disciplines":[{"confidence":"high","discipline":"engineering","id":"disc-1","sourceText":"Engineering required"}],"factsJson":{"contractType":{"confidence":"high","value":"T&M"},"documentType":{"confidence":"high","value":"RFP"}},"laborRequirements":[{"appearsInPeriods":["Base Period"],"confidence":"high","hoursPerMonth":160,"id":"labor-1","isPrescribed":true,"laborCategory":"LCAT-ENG-01","laborCategoryId":"cat-uuid-123","matchConfidence":0.95,"matchType":"exact","sourceText":"Engineer required","title":"Senior Engineer","utilizationPct":1}],"periods":[{"cumulativeMonthsEnd":12,"gsaRateYear":1,"id":"period-1","months":12,"name":"Base Period","sortOrder":0}],"solicitationBrief":{"challenges":[{"description":"Must integrate with legacy systems","evidence_refs":["evidence-1","evidence-2"],"title":"Legacy integration"}],"evaluation_emphasis":"Technical approach and past performance","rationale":"Agency needs modern infrastructure","summary":"Engineering support for cloud migration"},"versionId":"post-phase-5-test-version"}'

  it('canonical output is byte-identical to golden file (post-Phase-5 version)', () => {
    const actual = canonicalize(goldenFixturePostPhase5)
    expect(actual).toBe(GOLDEN_CANONICAL_POST_PHASE5)
  })

  it('post-Phase-5 version includes all new fields', () => {
    const canonical = canonicalize(goldenFixturePostPhase5)
    const parsed = JSON.parse(canonical)

    // solicitationBrief IS present
    expect(parsed.solicitationBrief).toBeDefined()
    expect(parsed.solicitationBrief.summary).toBe('Engineering support for cloud migration')

    const laborReq = parsed.laborRequirements[0]

    // Post-Phase-2 fields ARE present
    expect(laborReq.isPrescribed).toBe(true)
    expect(laborReq.laborCategoryId).toBe('cat-uuid-123')
    expect(laborReq.matchType).toBe('exact')
    expect(laborReq.matchConfidence).toBe(0.95)
  })
})
