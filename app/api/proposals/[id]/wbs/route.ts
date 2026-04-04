import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch WBS elements for a proposal (with optional pagination)
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
  const { searchParams } = new URL(request.url)

  // Pagination params (optional - if not provided, returns all)
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')
  const isPaginated = pageParam !== null || limitParam !== null

  const page = Math.max(1, parseInt(pageParam || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(limitParam || '50', 10)))
  const offset = (page - 1) * limit

  let query = supabase
    .from('wbs_elements')
    .select('*', isPaginated ? { count: 'exact' } : undefined)
    .eq('proposal_id', id)
    .order('wbs_number', { ascending: true })

  // Apply pagination if requested
  if (isPaginated) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Include pagination metadata if paginated
  if (isPaginated) {
    const total = count || 0
    const totalPages = Math.ceil(total / limit)
    return NextResponse.json({
      wbsElements: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  }

  return NextResponse.json({ wbsElements: data || [] })
}

// POST - Create WBS elements (bulk insert from AI generation)
export async function POST(
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

  // Handle both single and bulk inserts
  const elements = Array.isArray(body) ? body : [body]

  // DB schema: id, proposal_id, wbs_number, title, description, hours, labor_cost
  const insertData = elements.map(el => ({
    proposal_id: id,
    wbs_number: el.wbs_number || el.wbsNumber || '',
    title: el.title || '',
    description: el.description || el.what || '',
    hours: el.hours || el.labor_hours || 0,
    labor_cost: el.labor_cost || el.laborCost || 0,
  }))

  const { data, error } = await supabase
    .from('wbs_elements')
    .insert(insertData)
    .select()

  if (error) {
    console.log('[POST wbs] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wbsElements: data }, { status: 201 })
}

// PUT - Update WBS element
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'WBS Element ID required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('wbs_elements')
    .update({
      wbs_number: body.wbs_number || body.wbsNumber,
      title: body.title,
      description: body.description || body.what,
      hours: body.hours || body.labor_hours,
      labor_cost: body.labor_cost || body.laborCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    console.log('[PUT wbs] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ wbsElement: data })
}

// DELETE - Delete WBS element
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const wbsId = searchParams.get('wbsId')

  if (!wbsId) {
    return NextResponse.json({ error: 'WBS Element ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('wbs_elements')
    .delete()
    .eq('id', wbsId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
