/**
 * Tenancy Types
 *
 * Type definitions for multi-tenancy support.
 */

/**
 * Tenant represents an organization in the system.
 */
export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  companyId: string | null
  createdAt: string
  createdBy: string | null
  updatedAt: string
}

export type TenantStatus = 'active' | 'suspended' | 'deleted'

/**
 * Membership role within a tenant.
 *
 * - owner: Full control, billing, can delete tenant
 * - admin: Manage users, settings, but not billing
 * - estimator: Pricing/BOE work (primary role for TrueBid v1)
 * - writer: Proposal text editing (frozen in Phase 1)
 * - reviewer: Approvals and review workflows
 * - accountant: Rate management, indirect rates
 */
export type TenantRole =
  | 'owner'
  | 'admin'
  | 'estimator'
  | 'writer'
  | 'reviewer'
  | 'accountant'

/**
 * Membership status.
 */
export type MembershipStatus = 'active' | 'invited' | 'suspended'

/**
 * User's membership in a tenant.
 */
export interface TenantMembership {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  status: MembershipStatus
  joinedAt: string
  invitedBy: string | null
}

/**
 * Resolved tenant context for a user.
 * This is what gets passed to commands for authorization.
 */
export interface TenantContext {
  tenant: Tenant
  membership: TenantMembership
  userId: string
}

/**
 * Database row types (snake_case to match Supabase)
 */
export interface TenantRow {
  id: string
  name: string
  slug: string
  status: TenantStatus
  company_id: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export interface TenantMembershipRow {
  id: string
  tenant_id: string
  user_id: string
  role: TenantRole
  status: MembershipStatus
  joined_at: string
  invited_by: string | null
}

/**
 * Error thrown when user has no active tenant membership.
 */
export class NoTenantError extends Error {
  constructor(userId: string) {
    super(`User ${userId} has no active tenant membership`)
    this.name = 'NoTenantError'
  }
}

/**
 * Error thrown when tenant is in a non-active state.
 */
export class TenantSuspendedError extends Error {
  constructor(tenantId: string, status: TenantStatus) {
    super(`Tenant ${tenantId} is ${status}`)
    this.name = 'TenantSuspendedError'
  }
}

/**
 * Transform database row to domain type.
 */
export function tenantFromRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    companyId: row.company_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}

export function membershipFromRow(row: TenantMembershipRow): TenantMembership {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    invitedBy: row.invited_by,
  }
}
