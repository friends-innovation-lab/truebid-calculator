/**
 * Tenancy Module
 *
 * Multi-tenancy support for TrueBid.
 *
 * @example
 * import { resolveTenantContext, hasRole } from '@/lib/tenancy'
 *
 * const context = await resolveTenantContext(supabase)
 * if (hasRole(context, ['owner', 'admin', 'estimator'])) {
 *   // User can perform this action
 * }
 */

// Re-export types
export {
  type Tenant,
  type TenantStatus,
  type TenantRole,
  type MembershipStatus,
  type TenantMembership,
  type TenantContext,
  type TenantRow,
  type TenantMembershipRow,
  NoTenantError,
  TenantSuspendedError,
  tenantFromRow,
  membershipFromRow,
} from './types'

// Re-export resolver functions
export {
  resolveTenantContext,
  resolveTenantByCompanyId,
  hasRole,
  isAdmin,
} from './resolver'
