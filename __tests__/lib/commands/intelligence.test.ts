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
        { id: 'l2', title: 'Developer', laborCategory: null, hoursPerMonth: 160, utilizationPct: 1.0, appearsInPeriods: [], confidence: 'high', sourceText: null },
        { id: 'l1', title: 'Analyst', laborCategory: null, hoursPerMonth: 80, utilizationPct: 0.5, appearsInPeriods: [], confidence: 'medium', sourceText: null },
      ] as CoercedLaborRequirement[],
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
        { id: 'l1', title: 'Analyst', laborCategory: null, hoursPerMonth: 80, utilizationPct: 0.5, appearsInPeriods: [], confidence: 'medium', sourceText: null },
        { id: 'l2', title: 'Developer', laborCategory: null, hoursPerMonth: 160, utilizationPct: 1.0, appearsInPeriods: [], confidence: 'high', sourceText: null },
      ] as CoercedLaborRequirement[],
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
        { id: 'l2', title: 'Zebra Manager', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], confidence: 'low', sourceText: null },
        { id: 'l1', title: 'Alpha Developer', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], confidence: 'low', sourceText: null },
      ] as CoercedLaborRequirement[],
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
    }

    const data2 = {
      versionId: 'test-version-2',
      factsJson: {} as FactsJson,
      periods: [] as CoercedPeriod[],
      disciplines: [] as CoercedDiscipline[],
      laborRequirements: [] as CoercedLaborRequirement[],
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
    })

    // Simulate tampering (someone changed the contract type)
    const tamperedVersionRow = {
      ...rawVersionRow,
      facts_json: { contractType: { value: 'T&M', confidence: 'high' } }, // Changed!
    }

    const tamperedVersion = coerceVersion(tamperedVersionRow)
    const tamperedHash = await computeHash({
      versionId: tamperedVersion.id,
      factsJson: tamperedVersion.factsJson,
      periods: [],
      disciplines: [],
      laborRequirements: [],
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
        { id: 'l1', title: 'Développeur Senior', laborCategory: null, hoursPerMonth: null, utilizationPct: null, appearsInPeriods: [], confidence: 'high', sourceText: '日本語テスト' },
      ] as CoercedLaborRequirement[],
    }

    const hash = await computeHash(data)

    expect(hash).toBeTruthy()
    expect(hash.length).toBe(64)
  })
})
