#!/usr/bin/env npx tsx
/**
 * Fix Staging Auth User
 *
 * This script fixes the staging auth issue where a user was inserted directly
 * into auth.users via SQL, bypassing GoTrue. GoTrue rejects logins for such users.
 *
 * What it does:
 * 1. Deletes the synthetic auth user (by email) if it exists
 * 2. Creates a new user via Supabase Admin API (GoTrue-compatible)
 * 3. Updates tenant_memberships to reference the new user_id
 * 4. Updates companies.owner_id to reference the new user_id
 *
 * Usage:
 *   STAGING_SUPABASE_URL=https://xxx.supabase.co \
 *   STAGING_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/fix-staging-auth.ts
 *
 * IMPORTANT: This script is for staging ONLY. Never run against production.
 */

import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const STAGING_URL = process.env.STAGING_SUPABASE_URL
const STAGING_KEY = process.env.STAGING_SERVICE_ROLE_KEY

// The user we need to fix
const TARGET_EMAIL = 'lapedra@cityfriends.tech'
const TARGET_FULL_NAME = 'Lapedra Tolson'

// Generate a secure random password (24 chars, alphanumeric)
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  const bytes = randomBytes(24)
  for (let i = 0; i < 24; i++) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

// Known IDs from seed.sql that need updating
const SEED_USER_ID = '11111111-1111-1111-1111-111111111111'
const SEED_COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const SEED_TENANT_ID = '44444444-4444-4444-4444-444444444444'

async function main() {
  // Validate environment
  if (!STAGING_URL || !STAGING_KEY) {
    console.error('ERROR: Missing required environment variables')
    console.error('  STAGING_SUPABASE_URL - Supabase project URL')
    console.error('  STAGING_SERVICE_ROLE_KEY - Service role key')
    process.exit(1)
  }

  // Verify this is staging, not production
  if (STAGING_URL.includes('qtotsijebcpddipmzstb')) {
    console.error('ERROR: This looks like production! Aborting.')
    console.error('Production ref: qtotsijebcpddipmzstb')
    console.error('This script is for staging only.')
    process.exit(1)
  }

  if (!STAGING_URL.includes('tcobyquewjootwxpqijq')) {
    console.warn('WARNING: URL does not match known staging ref (tcobyquewjootwxpqijq)')
    console.warn(`Got: ${STAGING_URL}`)
    console.warn('Proceeding anyway - verify this is correct!')
  }

  console.log('=== Fix Staging Auth User ===')
  console.log(`Target URL: ${STAGING_URL}`)
  console.log(`Target email: ${TARGET_EMAIL}`)
  console.log('')

  const supabase = createClient(STAGING_URL, STAGING_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Step 1: Check if user already exists in GoTrue (not the broken SQL-inserted one)
  console.log('Step 1: Checking for existing GoTrue user...')

  // Try to get user by the seed ID - if this errors, the SQL-inserted user isn't in GoTrue
  const { data: existingById, error: getByIdError } =
    await supabase.auth.admin.getUserById(SEED_USER_ID)

  if (getByIdError) {
    console.log(`  Seed user not in GoTrue: ${getByIdError.message}`)
    console.log('  (This is expected - the SQL-inserted user bypassed GoTrue)')
  } else if (existingById) {
    console.log(`  Found existing GoTrue user with seed ID: ${existingById.user.email}`)
    // This would be unexpected - delete it
    await supabase.auth.admin.deleteUser(SEED_USER_ID)
    console.log('  Deleted existing GoTrue user')
  }

  // Also check by email via getUserByEmail (if available) or by trying to create
  // We'll just proceed to create - if email is taken in GoTrue, it will fail

  // Step 2: Create new user via Admin API
  console.log('')
  console.log('Step 2: Creating new user via Admin API...')

  const generatedPassword = generatePassword()

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: TARGET_EMAIL,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: TARGET_FULL_NAME,
    },
  })

  if (createError) {
    console.error('  Failed to create user:', createError.message)
    process.exit(1)
  }

  console.log(`  Created new user: ${newUser.user.id}`)
  console.log(`  Email confirmed: ${newUser.user.email_confirmed_at ? 'yes' : 'no'}`)

  const newUserId = newUser.user.id

  // Step 3: Update tenant_memberships
  console.log('')
  console.log('Step 3: Updating tenant_memberships...')

  // First, delete any existing membership for the old synthetic user
  const { error: deleteMembershipError } = await supabase
    .from('tenant_memberships')
    .delete()
    .eq('user_id', SEED_USER_ID)

  if (deleteMembershipError) {
    console.log(`  (Could not delete old membership: ${deleteMembershipError.message})`)
  }

  // Also delete any membership for the new user (in case of re-run)
  await supabase.from('tenant_memberships').delete().eq('user_id', newUserId)

  // Check if tenant exists
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', SEED_TENANT_ID)
    .single()

  if (tenant) {
    // Insert new membership
    const { error: insertMembershipError } = await supabase.from('tenant_memberships').insert({
      tenant_id: SEED_TENANT_ID,
      user_id: newUserId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    if (insertMembershipError) {
      console.error('  Failed to create membership:', insertMembershipError.message)
    } else {
      console.log(`  Created tenant membership for user ${newUserId}`)
    }
  } else {
    console.log('  Tenant not found - will need manual tenant setup')
  }

  // Step 4: Update companies.owner_id
  console.log('')
  console.log('Step 4: Updating companies.owner_id...')

  const { data: company } = await supabase
    .from('companies')
    .select('id, owner_id')
    .eq('id', SEED_COMPANY_ID)
    .single()

  if (company) {
    const { error: updateOwnerError } = await supabase
      .from('companies')
      .update({ owner_id: newUserId })
      .eq('id', SEED_COMPANY_ID)

    if (updateOwnerError) {
      console.error('  Failed to update owner_id:', updateOwnerError.message)
    } else {
      console.log(`  Updated company owner_id from ${company.owner_id} to ${newUserId}`)
    }
  } else {
    console.log('  Company not found - may need manual setup')
  }

  // Step 5: Update tenants.created_by
  console.log('')
  console.log('Step 5: Updating tenants.created_by...')

  const { error: updateTenantError } = await supabase
    .from('tenants')
    .update({ created_by: newUserId })
    .eq('id', SEED_TENANT_ID)

  if (updateTenantError) {
    console.log(`  (Could not update created_by: ${updateTenantError.message})`)
  } else {
    console.log(`  Updated tenant created_by to ${newUserId}`)
  }

  // Summary
  console.log('')
  console.log('=== Summary ===')
  console.log(`New user ID: ${newUserId}`)
  console.log(`Email: ${TARGET_EMAIL}`)
  console.log(`Password: ${generatedPassword}`)
  console.log('')
  console.log('IMPORTANT: Save this password securely. It is not stored anywhere.')
  console.log('')
  console.log('Next steps:')
  console.log('1. Test login on the staging preview deployment')
  console.log('2. Verify dashboard loads correctly')
  console.log('')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
