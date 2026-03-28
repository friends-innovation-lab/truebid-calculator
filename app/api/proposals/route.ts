import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { proposalCreateSchema } from '@/lib/schemas/proposal'

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
    client: p.agency || p.client || '',
    status: p.status || 'draft',
    totalValue: p.total_value || p.estimated_value || 0,
    dueDate: p.due_date || null,
    updatedAt: p.updated_at || new Date().toISOString(),
    createdAt: p.created_at || new Date().toISOString(),
    teamSize: p.team_size || 0,
    progress: p.progress || 0,
    starred: p.starred || false,
    archived: p.archived || false,
    contractType: p.contract_type || 'tm',
    periodOfPerformance,
  }
}

// GET - Fetch all proposals for user's company
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ proposals: [] })
  }

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('company_id', company.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform all proposals to camelCase
  const proposals = (data || []).map(transformProposal)
  return NextResponse.json({ proposals })
}

// POST - Create a new proposal
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  const raw = await request.json()

  const result = proposalCreateSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const body = result.data

  // Handle period_of_performance - convert string to jsonb object
  let periodOfPerformance = null
  const popValue = body.period_of_performance || body.periodOfPerformance
  if (popValue) {
    periodOfPerformance = typeof popValue === 'string' ? { display: popValue } : popValue
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      company_id: company.id,
      title: body.title || 'Untitled Proposal',
      agency: body.agency || body.client,
      solicitation_number: body.solicitation_number || body.solicitation,
      contract_type: body.contract_type || body.contractType || 'tm',
      status: body.status || 'draft',
      due_date: body.due_date || body.dueDate,
      total_value: body.total_value || body.totalValue || 0,
      team_size: body.team_size || body.teamSize || 0,
      progress: body.progress || 0,
      starred: body.starred || false,
      archived: body.archived || false,
      period_of_performance: periodOfPerformance,
      description: body.description,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ proposal: transformProposal(data) }, { status: 201 })
}
