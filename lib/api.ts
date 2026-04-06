// Helper functions for API calls

const API_BASE = '/api'
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with automatic retry for transient failures (5xx errors)
 * Uses exponential backoff: 100ms, 200ms, 400ms
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options)
      // Don't retry client errors (4xx) or success
      if (response.ok || response.status < 500) {
        return response
      }
      // Server error (5xx) — will retry
      lastError = new Error(`Server error: ${response.status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Don't retry if aborted intentionally (not timeout)
      if (lastError.name === 'AbortError' && options.signal?.aborted) {
        throw lastError
      }
    }

    // Don't wait after the last attempt
    if (attempt < retries - 1) {
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// User Profile
export const userApi = {
  getProfile: () =>
    fetchWithRetry(`${API_BASE}/user/profile`).then(handleResponse),

  updateProfile: (data: { fullName?: string; avatarUrl?: string }) =>
    fetchWithRetry(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return fetchWithRetry(`${API_BASE}/user/avatar`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse)
  },

  deleteAvatar: () =>
    fetchWithRetry(`${API_BASE}/user/avatar`, {
      method: 'DELETE',
    }).then(handleResponse),
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  // Safely parse JSON (handles HTML error pages)
  let data: T
  try {
    data = JSON.parse(text)
  } catch {
    // Response is not JSON (likely HTML error page)
    const preview = text.slice(0, 200).replace(/\s+/g, ' ')
    throw new Error(
      response.ok
        ? `Invalid JSON response: ${preview}`
        : `API error ${response.status}: ${preview}`
    )
  }

  if (!response.ok) {
    const errorMessage = (data as { error?: string }).error || `API error ${response.status}`
    throw new Error(errorMessage)
  }

  return data
}

// Companies
export const companiesApi = {
  get: () =>
    fetchWithRetry(`${API_BASE}/companies`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Company Settings
export const settingsApi = {
  get: () =>
    fetchWithRetry(`${API_BASE}/companies/settings`).then(handleResponse),

  save: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Company Roles
export const rolesApi = {
  list: () =>
    fetchWithRetry(`${API_BASE}/companies/roles`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id: string) =>
    fetchWithRetry(`${API_BASE}/companies/roles?id=${id}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Proposals
export const proposalsApi = {
  list: () =>
    fetchWithRetry(`${API_BASE}/proposals`).then(handleResponse),

  get: (id: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${id}`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${id}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Requirements
export const requirementsApi = {
  list: (proposalId: string, options?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.page) params.set('page', String(options.page))
    if (options?.limit) params.set('limit', String(options.limit))
    const queryString = params.toString()
    const url = `${API_BASE}/proposals/${proposalId}/requirements${queryString ? `?${queryString}` : ''}`
    return fetchWithRetry(url).then(handleResponse)
  },

  create: (proposalId: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/requirements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string, reqId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/requirements?reqId=${reqId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  deleteAll: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/requirements?all=true`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// WBS Elements
export const wbsApi = {
  list: (proposalId: string, options?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.page) params.set('page', String(options.page))
    if (options?.limit) params.set('limit', String(options.limit))
    const queryString = params.toString()
    const url = `${API_BASE}/proposals/${proposalId}/wbs${queryString ? `?${queryString}` : ''}`
    return fetchWithRetry(url).then(handleResponse)
  },

  create: (proposalId: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/wbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/wbs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string, wbsId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/wbs?wbsId=${wbsId}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Collab Sessions (authenticated — proposal owner)
export const collabApi = {
  listSessions: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions`).then(handleResponse),

  createSession: (proposalId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateSession: (proposalId: string, sessionId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteSession: (proposalId: string, sessionId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  listSubmissions: (proposalId: string, sessionId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}/submissions`).then(handleResponse),

  reviewSubmission: (proposalId: string, sessionId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}/submissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Collaborator API (token-based — no auth, used by directors)
export const collaboratorApi = {
  getSession: (token: string) =>
    fetchWithRetry(`${API_BASE}/collab/${token}`).then(handleResponse),

  getSubmissions: (token: string) =>
    fetchWithRetry(`${API_BASE}/collab/${token}/submissions`).then(handleResponse),

  submitReview: (token: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/collab/${token}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Share Links (authenticated — proposal owner)
export const shareLinksApi = {
  get: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/share-link`).then(handleResponse),

  create: (proposalId: string, data?: { expiresInDays?: number; reviewerEmail?: string; label?: string; linkType?: string }) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    }).then(handleResponse),

  update: (proposalId: string, data: { isActive?: boolean; expiresInDays?: number }) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/share-link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/share-link`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Public BOE API (token-based — no auth, used by external viewers)
export const publicBoeApi = {
  get: (token: string) =>
    fetchWithRetry(`${API_BASE}/boe/${token}`).then(handleResponse),
}

// Content Library
export const contentLibraryApi = {
  list: (type?: string) => {
    const params = type ? `?type=${type}` : ''
    return fetchWithRetry(`${API_BASE}/content-library${params}`).then(handleResponse)
  },

  get: (itemId: string) =>
    fetchWithRetry(`${API_BASE}/content-library/${itemId}`).then(handleResponse),

  create: (data: { type: string; title: string; content?: Record<string, unknown>; tags?: string[] }) =>
    fetchWithRetry(`${API_BASE}/content-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (itemId: string, data: { title?: string; content?: Record<string, unknown>; tags?: string[]; is_active?: boolean }) =>
    fetchWithRetry(`${API_BASE}/content-library/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (itemId: string) =>
    fetchWithRetry(`${API_BASE}/content-library/${itemId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  recordUse: (itemId: string, proposalId: string) =>
    fetchWithRetry(`${API_BASE}/content-library/${itemId}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: proposalId }),
    }).then(handleResponse),
}

// Proposal Sections (Technical Volume Outline)
export const sectionsApi = {
  list: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections`).then(handleResponse),

  create: (proposalId: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, sectionId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, ...data }),
    }).then(handleResponse),

  delete: (proposalId: string, sectionId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections?sectionId=${sectionId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  deleteAll: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections?all=true`, {
      method: 'DELETE',
    }).then(handleResponse),

  generate: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections/generate`, {
      method: 'POST',
    }).then(handleResponse),

  regenerate: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/sections/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate: true }),
    }).then(handleResponse),
}

// Compliance Matrix
export const complianceApi = {
  list: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance`).then(handleResponse),

  generate: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance/generate`, {
      method: 'POST',
    }).then(handleResponse),

  regenerate: (proposalId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    }).then(handleResponse),

  // Bulk replace all compliance items for a proposal (from extraction)
  bulkReplace: (proposalId: string, items: Array<Record<string, unknown>>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }).then(handleResponse),

  create: (proposalId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, itemId: string, data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string, itemId: string) =>
    fetchWithRetry(`${API_BASE}/proposals/${proposalId}/compliance/${itemId}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// GSA Rates
export const gsaRatesApi = {
  list: () =>
    fetchWithRetry(`${API_BASE}/companies/gsa-rates`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies/gsa-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (data: Record<string, unknown>) =>
    fetchWithRetry(`${API_BASE}/companies/gsa-rates`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id: string) =>
    fetchWithRetry(`${API_BASE}/companies/gsa-rates?id=${id}`, {
      method: 'DELETE',
    }).then(handleResponse),
}
