/**
 * Phase 3: Projected Roles API
 *
 * GET /api/proposals/[id]/roles
 * Returns roles projected from staffing_assignments + working_data.
 *
 * Field-location split:
 * - Hours: from staffing_assignments (active WBS)
 * - Pricing: from working_data.roles
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { projectRoles } from '@/lib/roles-projection'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  try {
    const result = await projectRoles(supabase, proposalId)

    return NextResponse.json({
      roles: result.roles,
      hasActiveWbs: result.hasActiveWbs,
      wbsVersionId: result.wbsVersionId,
    })
  } catch (error) {
    console.error('[roles] Projection error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
