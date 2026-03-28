// Helper functions for API calls

const API_BASE = '/api'

// User Profile
export const userApi = {
  getProfile: () =>
    fetch(`${API_BASE}/user/profile`).then(handleResponse),

  updateProfile: (data: { fullName?: string; avatarUrl?: string }) =>
    fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return fetch(`${API_BASE}/user/avatar`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse)
  },

  deleteAvatar: () =>
    fetch(`${API_BASE}/user/avatar`, {
      method: 'DELETE',
    }).then(handleResponse),
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'API request failed')
  }
  return response.json()
}

// Companies
export const companiesApi = {
  get: () =>
    fetch(`${API_BASE}/companies`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/companies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Company Settings
export const settingsApi = {
  get: () =>
    fetch(`${API_BASE}/companies/settings`).then(handleResponse),

  save: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/companies/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Company Roles
export const rolesApi = {
  list: () =>
    fetch(`${API_BASE}/companies/roles`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/companies/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/companies/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id: string) =>
    fetch(`${API_BASE}/companies/roles?id=${id}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Proposals
export const proposalsApi = {
  list: () =>
    fetch(`${API_BASE}/proposals`).then(handleResponse),

  get: (id: string) =>
    fetch(`${API_BASE}/proposals/${id}`).then(handleResponse),

  create: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (id: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (id: string) =>
    fetch(`${API_BASE}/proposals/${id}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Requirements
export const requirementsApi = {
  list: (proposalId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/requirements`).then(handleResponse),

  create: (proposalId: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    fetch(`${API_BASE}/proposals/${proposalId}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${proposalId}/requirements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string, reqId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/requirements?reqId=${reqId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  deleteAll: (proposalId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/requirements?all=true`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// WBS Elements
export const wbsApi = {
  list: (proposalId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/wbs`).then(handleResponse),

  create: (proposalId: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    fetch(`${API_BASE}/proposals/${proposalId}/wbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  update: (proposalId: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${proposalId}/wbs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  delete: (proposalId: string, wbsId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/wbs?wbsId=${wbsId}`, {
      method: 'DELETE',
    }).then(handleResponse),
}

// Collab Sessions (authenticated — proposal owner)
export const collabApi = {
  listSessions: (proposalId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions`).then(handleResponse),

  createSession: (proposalId: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  updateSession: (proposalId: string, sessionId: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  deleteSession: (proposalId: string, sessionId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}`, {
      method: 'DELETE',
    }).then(handleResponse),

  listSubmissions: (proposalId: string, sessionId: string) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}/submissions`).then(handleResponse),

  reviewSubmission: (proposalId: string, sessionId: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/proposals/${proposalId}/collab-sessions/${sessionId}/submissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}

// Collaborator API (token-based — no auth, used by directors)
export const collaboratorApi = {
  getSession: (token: string) =>
    fetch(`${API_BASE}/collab/${token}`).then(handleResponse),

  getSubmissions: (token: string) =>
    fetch(`${API_BASE}/collab/${token}/submissions`).then(handleResponse),

  submitReview: (token: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/collab/${token}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
}
