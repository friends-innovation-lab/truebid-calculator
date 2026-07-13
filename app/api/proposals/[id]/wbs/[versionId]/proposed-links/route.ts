/**
 * Proposed Requirement Links API
 *
 * GET  - List all proposed links for a WBS version
 * POST - Accept or reject proposed link(s)
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTenantContext } from '@/lib/tenancy'
import { runCommand } from '@/lib/commands'
import {
  createAcceptProposedLinkCommand,
  createRejectProposedLinkCommand,
} from '@/lib/commands/wbs'

interface RequirementLinkRow {
  id: string
  requirement_id: string
  wbs_task_id: string
  status: 'proposed' | 'accepted' | 'rejected'
  link_source: 'ai' | 'user'
  suggesting_evidence: string | null
  proposed_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

interface WbsTaskRow {
  id: string
  wbs_code: string
  title: string
  wbs_version_id: string
}

interface RequirementRow {
  id: string
  requirement_id: string
  title: string
  text: string
}

/**
 * GET - List all proposed links for a WBS version
 *
 * Returns links grouped by WBS task for easier UI display.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, versionId } = await params

  try {
    // Verify the WBS version exists and belongs to the proposal
    const { data: wbsVersion, error: versionError } = await supabase
      .from('wbs_versions')
      .select('id, proposal_id, status')
      .eq('id', versionId)
      .single()

    if (versionError || !wbsVersion) {
      return NextResponse.json({ error: 'WBS version not found' }, { status: 404 })
    }

    if (wbsVersion.proposal_id !== proposalId) {
      return NextResponse.json(
        { error: 'WBS version does not belong to this proposal' },
        { status: 404 }
      )
    }

    // Get all tasks for this WBS version
    const { data: tasks, error: tasksError } = await supabase
      .from('wbs_tasks')
      .select('id, wbs_code, title, wbs_version_id')
      .eq('wbs_version_id', versionId)
      .order('wbs_code')

    if (tasksError) {
      console.error('[GET proposed-links] Tasks error:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    const taskIds = (tasks as WbsTaskRow[]).map((t) => t.id)

    if (taskIds.length === 0) {
      return NextResponse.json({
        proposedLinks: [],
        summary: { total: 0, proposed: 0, accepted: 0, rejected: 0 },
      })
    }

    // Get all requirement links for these tasks
    const { data: links, error: linksError } = await supabase
      .from('requirement_links')
      .select('*')
      .in('wbs_task_id', taskIds)

    if (linksError) {
      console.error('[GET proposed-links] Links error:', linksError)
      return NextResponse.json({ error: linksError.message }, { status: 500 })
    }

    const typedLinks = (links || []) as RequirementLinkRow[]

    // Get requirement details for all linked requirements
    const requirementIds = [...new Set(typedLinks.map((l) => l.requirement_id))]
    const requirementMap = new Map<string, RequirementRow>()

    if (requirementIds.length > 0) {
      const { data: requirements } = await supabase
        .from('requirements')
        .select('id, requirement_id, title, text')
        .in('id', requirementIds)

      if (requirements) {
        for (const r of requirements as RequirementRow[]) {
          requirementMap.set(r.id, r)
        }
      }
    }

    // Build task map for enrichment
    const taskMap = new Map<string, WbsTaskRow>()
    for (const t of tasks as WbsTaskRow[]) {
      taskMap.set(t.id, t)
    }

    // Enrich links with task and requirement info
    const enrichedLinks = typedLinks.map((link) => {
      const task = taskMap.get(link.wbs_task_id)
      const requirement = requirementMap.get(link.requirement_id)

      return {
        id: link.id,
        status: link.status,
        linkSource: link.link_source,
        suggestingEvidence: link.suggesting_evidence,
        proposedAt: link.proposed_at,
        resolvedAt: link.resolved_at,
        task: task
          ? {
              id: task.id,
              wbsCode: task.wbs_code,
              title: task.title,
            }
          : null,
        requirement: requirement
          ? {
              id: requirement.id,
              requirementId: requirement.requirement_id,
              title: requirement.title,
              text: requirement.text,
            }
          : null,
      }
    })

    // Compute summary
    const summary = {
      total: enrichedLinks.length,
      proposed: enrichedLinks.filter((l) => l.status === 'proposed').length,
      accepted: enrichedLinks.filter((l) => l.status === 'accepted').length,
      rejected: enrichedLinks.filter((l) => l.status === 'rejected').length,
    }

    return NextResponse.json({
      proposedLinks: enrichedLinks.filter((l) => l.status === 'proposed'),
      allLinks: enrichedLinks,
      summary,
    })
  } catch (error) {
    console.error('[GET proposed-links] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Accept or reject proposed link(s)
 *
 * Body:
 * {
 *   action: 'accept' | 'reject',
 *   linkIds: string[]  // or 'all' to process all proposed links
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, versionId } = await params

  let body: {
    action?: 'accept' | 'reject'
    linkIds?: string[] | 'all'
  } = {}

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.action || !['accept', 'reject'].includes(body.action)) {
    return NextResponse.json(
      { error: 'action must be "accept" or "reject"' },
      { status: 400 }
    )
  }

  if (!body.linkIds) {
    return NextResponse.json(
      { error: 'linkIds is required (array of IDs or "all")' },
      { status: 400 }
    )
  }

  try {
    // Resolve tenant context (validates auth and provides tenant info)
    await resolveTenantContext(supabase)

    // Verify the WBS version exists and belongs to the proposal
    const { data: wbsVersion, error: versionError } = await supabase
      .from('wbs_versions')
      .select('id, proposal_id')
      .eq('id', versionId)
      .single()

    if (versionError || !wbsVersion) {
      return NextResponse.json({ error: 'WBS version not found' }, { status: 404 })
    }

    if (wbsVersion.proposal_id !== proposalId) {
      return NextResponse.json(
        { error: 'WBS version does not belong to this proposal' },
        { status: 404 }
      )
    }

    // Get link IDs to process
    let linkIds: string[]

    if (body.linkIds === 'all') {
      // Get all tasks for this WBS version
      const { data: tasks } = await supabase
        .from('wbs_tasks')
        .select('id')
        .eq('wbs_version_id', versionId)

      const taskIds = (tasks || []).map((t: { id: string }) => t.id)

      // Get all proposed links for these tasks
      const { data: proposedLinks } = await supabase
        .from('requirement_links')
        .select('id')
        .in('wbs_task_id', taskIds)
        .eq('status', 'proposed')

      linkIds = (proposedLinks || []).map((l: { id: string }) => l.id)
    } else {
      linkIds = body.linkIds
    }

    if (linkIds.length === 0) {
      return NextResponse.json({
        processed: 0,
        results: [],
      })
    }

    // Process each link
    const results: Array<{
      linkId: string
      success: boolean
      error?: string
    }> = []

    for (const linkId of linkIds) {
      try {
        let success = false
        let errorMessage: string | undefined

        if (body.action === 'accept') {
          const command = createAcceptProposedLinkCommand(supabase)
          const result = await runCommand(supabase, command, { linkId })
          success = result.success
          if (!success) {
            errorMessage = result.error?.message || 'Unknown error'
          }
        } else {
          const command = createRejectProposedLinkCommand(supabase)
          const result = await runCommand(supabase, command, { linkId })
          success = result.success
          if (!success) {
            errorMessage = result.error?.message || 'Unknown error'
          }
        }

        if (success) {
          results.push({ linkId, success: true })
        } else {
          results.push({ linkId, success: false, error: errorMessage })
        }
      } catch (error) {
        results.push({
          linkId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      processed: results.length,
      succeeded: successCount,
      failed: results.length - successCount,
      results,
    })
  } catch (error) {
    console.error('[POST proposed-links] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
