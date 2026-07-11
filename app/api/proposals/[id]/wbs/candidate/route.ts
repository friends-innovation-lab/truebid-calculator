/**
 * Phase 3: WBS Candidate API
 *
 * GET /api/proposals/[id]/wbs/candidate
 * Returns the latest WBS candidate with diff against active version.
 *
 * POST /api/proposals/[id]/wbs/candidate/accept
 * Accepts the candidate, making it active.
 *
 * POST /api/proposals/[id]/wbs/candidate/discard
 * Discards the candidate.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeWbsDiff, acceptWbsCandidate, discardWbsCandidate } from '@/lib/commands'
import type { ConflictResolution } from '@/lib/commands/wbs/types'

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
    // Find the latest candidate for this proposal
    const { data: candidate, error: candError } = await supabase
      .from('wbs_versions')
      .select('id, version_number, status, row_version, created_at, generation_job_note')
      .eq('proposal_id', proposalId)
      .in('status', ['generated_candidate', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (candError || !candidate) {
      // No candidate found - check if there's an active version
      const { data: active } = await supabase
        .from('wbs_versions')
        .select('id, version_number')
        .eq('proposal_id', proposalId)
        .eq('status', 'active')
        .single()

      return NextResponse.json({
        hasCandidate: false,
        hasActive: !!active,
        activeVersionId: active?.id ?? null,
        activeVersionNumber: active?.version_number ?? null,
      })
    }

    // Compute diff against active
    const diff = await computeWbsDiff(supabase, candidate.id)

    return NextResponse.json({
      hasCandidate: true,
      candidateVersionId: candidate.id,
      candidateVersionNumber: candidate.version_number,
      candidateStatus: candidate.status,
      candidateRowVersion: candidate.row_version,
      generationNote: candidate.generation_job_note,
      createdAt: candidate.created_at,
      hasActive: !!diff.activeVersionId,
      activeVersionId: diff.activeVersionId,
      diff: {
        totalTasks: diff.taskDiffs.length,
        addedTasks: diff.taskDiffs.filter(t => t.status === 'added').length,
        changedTasks: diff.taskDiffs.filter(t => t.status === 'changed').length,
        removedTasks: diff.taskDiffs.filter(t => t.status === 'removed').length,
        conflictTasks: diff.taskDiffs.filter(t => t.status === 'conflict').length,
        totalConflicts: diff.totalConflicts,
        taskDiffs: diff.taskDiffs.map(td => ({
          status: td.status,
          wbsCode: td.candidateTask?.wbsCode ?? td.activeTask?.wbsCode,
          title: td.candidateTask?.title ?? td.activeTask?.title,
          hasUserModifiedConflict: td.hasUserModifiedConflict,
          assignmentSummary: {
            total: td.assignmentDiffs.length,
            added: td.assignmentDiffs.filter(a => a.status === 'added').length,
            changed: td.assignmentDiffs.filter(a => a.status === 'changed').length,
            conflicts: td.assignmentDiffs.filter(a => a.hasUserModifiedConflict).length,
          },
        })),
      },
    })
  } catch (error) {
    console.error('[wbs/candidate] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  try {
    const body = await request.json()
    const { action, candidateVersionId, expectedRowVersion, conflictResolutions } = body as {
      action: 'accept' | 'discard'
      candidateVersionId: string
      expectedRowVersion: number
      conflictResolutions?: ConflictResolution[]
    }

    if (!action || !candidateVersionId || expectedRowVersion === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: action, candidateVersionId, expectedRowVersion'
      }, { status: 400 })
    }

    // Verify candidate belongs to this proposal
    const { data: candidate } = await supabase
      .from('wbs_versions')
      .select('proposal_id')
      .eq('id', candidateVersionId)
      .single()

    if (!candidate || candidate.proposal_id !== proposalId) {
      return NextResponse.json({ error: 'Candidate not found for this proposal' }, { status: 404 })
    }

    if (action === 'accept') {
      const result = await acceptWbsCandidate(supabase, {
        candidateVersionId,
        expectedRowVersion,
        conflictResolutions,
      })

      return NextResponse.json({
        success: true,
        action: 'accepted',
        activeVersionId: result.activeVersionId,
        supersededVersionId: result.supersededVersionId,
        conflictsResolved: result.conflictsResolved,
      })
    } else if (action === 'discard') {
      await discardWbsCandidate(supabase, {
        candidateVersionId,
        expectedRowVersion,
      })

      return NextResponse.json({
        success: true,
        action: 'discarded',
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "accept" or "discard"' }, { status: 400 })
    }
  } catch (error) {
    console.error('[wbs/candidate] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
