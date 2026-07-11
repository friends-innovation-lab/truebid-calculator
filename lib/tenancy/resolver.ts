/**
 * Tenant Resolver
 *
 * Resolves the current tenant context from a user session.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type TenantContext,
  type TenantRow,
  type TenantMembershipRow,
  tenantFromRow,
  membershipFromRow,
  NoTenantError,
  TenantSuspendedError,
} from './types'

/**
 * Resolve tenant context for the current authenticated user.
 *
 * For now, users have exactly one tenant (their company).
 * Future: Support multiple tenants and tenant switching.
 *
 * @param supabase - Authenticated Supabase client
 * @returns Tenant context with user's membership
 * @throws NoTenantError if user has no tenant
 * @throws TenantSuspendedError if tenant is not active
 */
export async function resolveTenantContext(
  supabase: SupabaseClient
): Promise<TenantContext> {
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Get user's active membership(s)
  // For now we take the first one; later we'll support tenant switching
  const { data: memberships, error: membershipError } = await supabase
    .from('tenant_memberships')
    .select(`
      id,
      tenant_id,
      user_id,
      role,
      status,
      joined_at,
      invited_by
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)

  if (membershipError) {
    console.error('[TenantResolver] Membership query error:', membershipError)
    throw new Error('Failed to resolve tenant membership')
  }

  if (!memberships || memberships.length === 0) {
    throw new NoTenantError(user.id)
  }

  const membershipRow = memberships[0] as TenantMembershipRow
  const membership = membershipFromRow(membershipRow)

  // Get the tenant
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', membership.tenantId)
    .single()

  if (tenantError || !tenantData) {
    console.error('[TenantResolver] Tenant query error:', tenantError)
    throw new Error('Failed to resolve tenant')
  }

  const tenantRow = tenantData as TenantRow
  const tenant = tenantFromRow(tenantRow)

  // Check tenant status
  if (tenant.status !== 'active') {
    throw new TenantSuspendedError(tenant.id, tenant.status)
  }

  return {
    tenant,
    membership,
    userId: user.id,
  }
}

/**
 * Get tenant context by company ID.
 *
 * Used during transition period when code still references company_id.
 *
 * @param supabase - Authenticated Supabase client
 * @param companyId - Company ID to look up
 * @returns Tenant context or null if not found
 */
export async function resolveTenantByCompanyId(
  supabase: SupabaseClient,
  companyId: string
): Promise<TenantContext | null> {
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Get tenant by company_id
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (tenantError || !tenantData) {
    return null
  }

  const tenantRow = tenantData as TenantRow
  const tenant = tenantFromRow(tenantRow)

  // Get user's membership in this tenant
  const { data: membershipData, error: membershipError } = await supabase
    .from('tenant_memberships')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (membershipError || !membershipData) {
    return null // User is not a member of this tenant
  }

  const membershipRow = membershipData as TenantMembershipRow
  const membership = membershipFromRow(membershipRow)

  return {
    tenant,
    membership,
    userId: user.id,
  }
}

/**
 * Check if user has at least one of the required roles.
 */
export function hasRole(
  context: TenantContext,
  allowedRoles: string[]
): boolean {
  return allowedRoles.includes(context.membership.role)
}

/**
 * Check if user is owner or admin.
 */
export function isAdmin(context: TenantContext): boolean {
  return hasRole(context, ['owner', 'admin'])
}
