import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch requirements for a proposal (with optional pagination)
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
    .from('requirements')
    .select('*', isPaginated ? { count: 'exact' } : undefined)
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  // Apply pagination if requested
  if (isPaginated) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data: requirements, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform DB format to component format
  // DB: { reference_number, title, description, source, priority, type }
  // Component: { ref, type, text, source, status }
  const transformed = (requirements || []).map((req: Record<string, unknown>) => ({
    id: req.id,
    ref: req.reference_number || '',
    type: req.type || 'shall',
    text: req.description || req.title || '',
    source: req.source || '',
    status: req.status || 'unaddressed',
    proposalSection: req.proposal_section || null,
    wbsLinks: req.wbs_links || [],
    owner: req.owner || null,
  }))

  // Include pagination metadata if paginated
  if (isPaginated) {
    const total = count || 0
    const totalPages = Math.ceil(total / limit)
    return NextResponse.json({
      requirements: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  }

  return NextResponse.json({ requirements: transformed })
}

// Helper function to extract title from requirement text
function extractTitle(text: string): string {
  // Take first 100 chars or up to first period/newline
  const firstLine = text.split(/[.\n]/)[0].trim()
  return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine
}

// Helper function to map extraction type to priority
function mapTypeToPriority(type: string): string {
  const typeMap: Record<string, string> = {
    'shall': 'high',
    'must': 'high',
    'required': 'high',
    'should': 'medium',
    'may': 'low',
    'optional': 'low',
  }
  return typeMap[type?.toLowerCase()] || 'medium'
}

// POST - Create requirements (supports bulk insert)
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
  const requirements = Array.isArray(body) ? body : [body]

  // Map from extraction format to DB format
  // Extraction format: { id, text, type, sourceSection, title?, pageNumber? }
  // DB format: { reference_number, title, description, type, source, priority }
  const insertData = requirements.map(req => ({
    proposal_id: id,
    reference_number: req.reference_number || req.id || '',
    title: req.title || extractTitle(req.text || req.description || ''),
    description: req.description || req.text || '',
    source: req.source || req.sourceSection || '',
    priority: req.priority || mapTypeToPriority(req.type),
    type: req.type || 'shall',
  }))

  const { data, error } = await supabase
    .from('requirements')
    .insert(insertData)
    .select()

  if (error) {
    console.log('[POST requirements] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requirements: data })
}

// PUT - Update a requirement (e.g., link to WBS)
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

  // Expect { reqId, linked_wbs_id } in body
  const { reqId, linked_wbs_id } = body

  if (!reqId) {
    return NextResponse.json({ error: 'reqId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('requirements')
    .update({ linked_wbs_id })
    .eq('id', reqId)
    .eq('proposal_id', id)
    .select()

  if (error) {
    console.log('[PUT requirements] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requirement: data?.[0] })
}

// DELETE - Delete requirements (single by reqId, or all with ?all=true)
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
  const { searchParams } = new URL(request.url)
  const reqId = searchParams.get('reqId')
  const deleteAll = searchParams.get('all') === 'true'

  if (deleteAll) {
    // Delete all requirements for this proposal
    const { error } = await supabase
      .from('requirements')
      .delete()
      .eq('proposal_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: 'all' })
  }

  if (reqId) {
    // Delete single requirement
    const { error } = await supabase
      .from('requirements')
      .delete()
      .eq('id', reqId)
      .eq('proposal_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: reqId })
  }

  return NextResponse.json({ error: 'Either reqId or all=true is required' }, { status: 400 })
}
