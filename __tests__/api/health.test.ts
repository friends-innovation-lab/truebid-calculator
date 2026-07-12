/**
 * @jest-environment node
 *
 * Health endpoint tests
 *
 * Unit tests with mocked Supabase client.
 * Integration test against seeded local DB requires running:
 *   supabase db reset && npm run test -- __tests__/api/health.test.ts
 */

// Mock setup must be hoisted
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
}))

import { GET } from '@/app/api/health/route'
import { createServiceClient } from '@/lib/supabase/server'

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>

describe('Health endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.VERCEL_GIT_COMMIT_SHA
  })

  function setupMocks(options: {
    companiesError?: boolean
    proposalsCount?: number
    proposalsError?: boolean
  }) {
    const { companiesError = false, proposalsCount = 0, proposalsError = false } = options

    const mockEq = jest.fn().mockResolvedValue({
      count: proposalsError ? null : proposalsCount,
      error: proposalsError ? { message: 'Query failed' } : null,
    })

    const mockLimit = jest.fn().mockResolvedValue({
      data: companiesError ? null : [{ id: 'company-1' }],
      error: companiesError ? { message: 'Connection failed' } : null,
    })

    const mockSelect = jest.fn()
      .mockReturnValueOnce({ limit: mockLimit })
      .mockReturnValueOnce({ eq: mockEq })

    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select: mockSelect }),
    } as unknown as ReturnType<typeof createServiceClient>)
  }

  describe('when DB is healthy with proposals', () => {
    beforeEach(() => {
      setupMocks({ proposalsCount: 2 })
    })

    it('returns 200 with correct JSON', async () => {
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.db).toBe('ok')
      expect(json.proposals_visible).toBe(2)
      expect(json.version).toBe('local')
      expect(json.timestamp).toBeDefined()
    })

    it('includes commit SHA from environment', async () => {
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123'
      setupMocks({ proposalsCount: 1 })

      const response = await GET()
      const json = await response.json()

      expect(json.version).toBe('abc123')
    })
  })

  describe('when DB is healthy but no proposals', () => {
    beforeEach(() => {
      setupMocks({ proposalsCount: 0 })
    })

    it('returns 503 when proposals_visible is 0', async () => {
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.db).toBe('ok')
      expect(json.proposals_visible).toBe(0)
    })
  })

  describe('when DB connection fails', () => {
    beforeEach(() => {
      setupMocks({ companiesError: true })
    })

    it('returns 503 with db: fail', async () => {
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.db).toBe('fail')
      expect(json.proposals_visible).toBe(0)
    })
  })

  describe('Cache-Control header', () => {
    beforeEach(() => {
      setupMocks({ proposalsCount: 1 })
    })

    it('sets no-store to prevent caching', async () => {
      const response = await GET()

      expect(response.headers.get('Cache-Control')).toBe('no-store')
    })
  })
})

/**
 * Integration test expectation (run manually against seeded local DB):
 *
 * After `supabase db reset`, the seed creates 1 non-archived proposal.
 * Hitting http://localhost:3000/api/health should return:
 *   - status: 200
 *   - db: "ok"
 *   - proposals_visible: 1
 *   - version: "local"
 */
