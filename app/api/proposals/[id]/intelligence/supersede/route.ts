/**
 * Supersede Intelligence Version API
 *
 * POST - Create a new draft from the current confirmed version
 *
 * Used when users want to edit confirmed intelligence.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  runCommand,
  createSupersedeIntelligenceVersionCommand,
} from '@/lib/commands'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  try {
    const command = createSupersedeIntelligenceVersionCommand(supabase)
    const result = await runCommand(supabase, command, {
      proposalId,
    })

    if (!result.success) {
      const status =
        result.error?.code === 'NOT_FOUND'
          ? 404
          : result.error?.code === 'INVALID_STATE'
            ? 400
            : 500
      return NextResponse.json({ error: result.error?.message }, { status })
    }

    return NextResponse.json({
      newVersion: {
        id: result.data?.newVersionId,
        versionNumber: result.data?.newVersionNumber,
      },
      supersededVersionId: result.data?.supersededVersionId,
    })
  } catch (error) {
    console.error('[POST /intelligence/supersede] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
