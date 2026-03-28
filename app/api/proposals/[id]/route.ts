import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Transform snake_case DB response to camelCase for frontend
function transformProposal(p: Record<string, unknown>) {
  // Handle period_of_performance which is jsonb - extract display string if object
  let periodOfPerformance = ''
  if (p.period_of_performance) {
    if (typeof p.period_of_performance === 'string') {
      periodOfPerformance = p.period_of_performance
    } else if (typeof p.period_of_performance === 'object' && (p.period_of_performance as Record<string, unknown>).display) {
      periodOfPerformance = (p.period_of_performance as Record<string, unknown>).display as string
    }
  }

  return {
    id: p.id,
    title: p.title || 'Untitled Proposal',
    solicitation: p.solicitation_number || '',
    client: p.agency || '',
    status: p.status || 'draft',
    totalValue: p.total_value || 0,
    dueDate: p.due_date || null,
    updatedAt: p.updated_at || new Date().toISOString(),
    createdAt: p.created_at || new Date().toISOString(),
    teamSize: p.team_size || 0,
    progress: p.progress || 0,
    starred: p.starred || false,
    archived: p.archived || false,
    contractType: p.contract_type || 'tm',
    periodOfPerformance,
    workingData: p.working_data || {},
    strategy: p.strategy || {},
    requirements: p.requirements,
    wbsElements: p.wbs_elements,
  }
}

// GET - Fetch single proposal with requirements and WBS
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(`
      *,
      requirements (*),
      wbs_elements (*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ proposal: transformProposal(proposal) })
}

// PUT - Update proposal
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Build update object only with fields that were provided
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Map camelCase to snake_case and handle both formats
  if (body.title !== undefined) updateData.title = body.title
  if (body.agency !== undefined) updateData.agency = body.agency
  if (body.client !== undefined) updateData.agency = body.client
  if (body.solicitation_number !== undefined) updateData.solicitation_number = body.solicitation_number
  if (body.solicitation !== undefined) updateData.solicitation_number = body.solicitation
  if (body.contract_type !== undefined) updateData.contract_type = body.contract_type
  if (body.contractType !== undefined) updateData.contract_type = body.contractType
  if (body.status !== undefined) updateData.status = body.status
  if (body.due_date !== undefined) updateData.due_date = body.due_date
  if (body.dueDate !== undefined) updateData.due_date = body.dueDate
  if (body.total_value !== undefined) updateData.total_value = body.total_value
  if (body.totalValue !== undefined) updateData.total_value = body.totalValue
  if (body.team_size !== undefined) updateData.team_size = body.team_size
  if (body.teamSize !== undefined) updateData.team_size = body.teamSize
  if (body.progress !== undefined) updateData.progress = body.progress
  if (body.starred !== undefined) updateData.starred = body.starred
  if (body.archived !== undefined) updateData.archived = body.archived
  // period_of_performance is jsonb - convert string to object if needed
  if (body.period_of_performance !== undefined) {
    updateData.period_of_performance = typeof body.period_of_performance === 'string'
      ? { display: body.period_of_performance }
      : body.period_of_performance
  }
  if (body.periodOfPerformance !== undefined) {
    updateData.period_of_performance = typeof body.periodOfPerformance === 'string'
      ? { display: body.periodOfPerformance }
      : body.periodOfPerformance
  }
  if (body.description !== undefined) updateData.description = body.description
  if (body.working_data !== undefined) updateData.working_data = body.working_data
  if (body.workingData !== undefined) updateData.working_data = body.workingData
  if (body.strategy !== undefined) updateData.strategy = body.strategy

  console.log('[PUT /api/proposals] Updating proposal:', id)
  console.log('[PUT /api/proposals] Update data:', JSON.stringify(updateData, null, 2))

  const { data, error } = await supabase
    .from('proposals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[PUT /api/proposals] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ proposal: transformProposal(data) })
}

// DELETE - Delete proposal (cascades to requirements/wbs)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
