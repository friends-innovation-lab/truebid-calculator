/**
 * @jest-environment node
 *
 * Health endpoint tests
 *
 * Unit tests with mocked Supabase client.
 * Integration test against seeded local DB:
 *   supabase db reset && curl http://localhost:3000/api/health
 *   Expected: status 200, proposals_visible >= 1
 */

// Mock the Supabase client
const mockRpc = jest.fn()
const mockLimit = jest.fn()
const mockSelect = jest.fn(() => ({ limit: mockLimit }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

import { GET } from '@/app/api/health/route'

describe('Health endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.VERCEL_GIT_COMMIT_SHA
  })

  function setupMocks(options: {
    dbError?: boolean
    proposalsCount?: number
    rpcError?: boolean
  }) {
    const { dbError = false, proposalsCount = 0, rpcError = false } = options

    // DB connectivity check (tenants table)
    mockLimit.mockResolvedValue({
      data: dbError ? null : [{ id: 'tenant-1' }],
      error: dbError ? { message: 'Connection failed' } : null,
    })

    // RPC call for proposal count
    mockRpc.mockResolvedValue({
      data: rpcError ? null : proposalsCount,
      error: rpcError ? { message: 'RPC failed' } : null,
    })
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

    it('calls health_check_proposal_count RPC', async () => {
      await GET()

      expect(mockRpc).toHaveBeenCalledWith('health_check_proposal_count')
    })

    it('includes commit SHA from environment', async () => {
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123'
      setupMocks({ proposalsCount: 1 })

      const response = await GET()
      const json = await response.json()

      expect(json.version).toBe('abc123')
    })
  })

  describe('when DB is healthy but no proposals (503)', () => {
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

  describe('when DB connection fails (503)', () => {
    beforeEach(() => {
      setupMocks({ dbError: true })
    })

    it('returns 503 with db: fail', async () => {
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.db).toBe('fail')
      expect(json.proposals_visible).toBe(0)
    })
  })

  describe('when RPC fails (503)', () => {
    beforeEach(() => {
      setupMocks({ rpcError: true })
    })

    it('returns 503 with db: fail', async () => {
      const response = await GET()
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.db).toBe('fail')
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
 * Integration test (manual, against seeded local DB):
 *
 * 1. supabase db reset (applies migrations + seed)
 * 2. npm run dev
 * 3. curl http://localhost:3000/api/health
 *
 * Expected:
 *   - HTTP status: 200
 *   - db: "ok"
 *   - proposals_visible: 1 (seed creates 1 non-archived proposal)
 *   - version: "local"
 *
 * Zero-proposal test:
 *   UPDATE proposals SET archived = true;
 *   curl http://localhost:3000/api/health
 *   Expected: HTTP 503, proposals_visible: 0
 */
