import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sectionCreateSchema, sectionUpdateSchema, sectionBulkCreateSchema } from '@/lib/schemas/section'

// Transform camelCase to snake_case for database
function transformToDb(data: Record<string, unknown>) {
  return {
    parent_id: data.parentId ?? data.parent_id,
    sort_order: data.sortOrder ?? data.sort_order ?? 0,
    section_number: data.sectionNumber ?? data.section_number,
    title: data.title,
    summary: data.summary,
    content: data.content,
    instructions: data.instructions,
    compliance_item_ids: data.complianceItemIds ?? data.compliance_item_ids ?? [],
    requirement_refs: data.requirementRefs ?? data.requirement_refs ?? [],
    status: data.status ?? 'draft',
    target_word_count: data.targetWordCount ?? data.target_word_count,
    owner: data.owner,
    notes: data.notes,
    ai_generated: data.aiGenerated ?? data.ai_generated ?? false,
  }
}

// Transform snake_case to camelCase for frontend
function transformFromDb(row: Record<string, unknown>) {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    sectionNumber: row.section_number,
    title: row.title,
    summary: row.summary,
    content: row.content,
    instructions: row.instructions,
    complianceItemIds: row.compliance_item_ids,
    requirementRefs: row.requirement_refs,
    status: row.status,
    targetWordCount: row.target_word_count,
    actualWordCount: row.actual_word_count,
    owner: row.owner,
    notes: row.notes,
    aiGenerated: row.ai_generated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET - Fetch all sections for proposal
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

  const { data: sections, error } = await supabase
    .from('proposal_sections')
    .select('*')
    .eq('proposal_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[GET /sections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform to camelCase
  const transformedSections = (sections || []).map(s => transformFromDb(s as Record<string, unknown>))

  // Calculate stats
  const stats = {
    total: transformedSections.length,
    draft: transformedSections.filter(s => s.status === 'draft').length,
    inProgress: transformedSections.filter(s => s.status === 'in_progress').length,
    review: transformedSections.filter(s => s.status === 'review').length,
    complete: transformedSections.filter(s => s.status === 'complete').length,
  }

  return NextResponse.json({ sections: transformedSections, stats })
}

// POST - Create section(s)
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

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle bulk create (array) or single create
  const isBulk = Array.isArray(body)
  if (isBulk) {
    const validated = sectionBulkCreateSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validated.error.issues },
        { status: 400 }
      )
    }

    const dbRows = validated.data.map((item: Record<string, unknown>) => ({
      proposal_id: id,
      ...transformToDb(item),
    }))

    const { data: sections, error } = await supabase
      .from('proposal_sections')
      .insert(dbRows)
      .select()

    if (error) {
      console.error('[POST /sections] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const transformedSections = (sections || []).map(s => transformFromDb(s as Record<string, unknown>))
    return NextResponse.json({ sections: transformedSections, count: transformedSections.length }, { status: 201 })
  }

  const validated = sectionCreateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  const dbRow = {
    proposal_id: id,
    ...transformToDb(validated.data as Record<string, unknown>),
  }

  const { data: section, error } = await supabase
    .from('proposal_sections')
    .insert(dbRow)
    .select()
    .single()

  if (error) {
    console.error('[POST /sections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ section: transformFromDb(section as Record<string, unknown>) }, { status: 201 })
}

// PUT - Update a section
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await params // proposal id not needed for update, section id is in body

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sectionId, ...updateData } = body
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })
  }

  const validated = sectionUpdateSchema.safeParse(updateData)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  // Filter out undefined values
  const dbData = transformToDb(validated.data as Record<string, unknown>)
  const filteredData = Object.fromEntries(
    Object.entries(dbData).filter(([, v]) => v !== undefined)
  )

  // Calculate actual word count if content is updated
  if (filteredData.content) {
    const wordCount = (filteredData.content as string).split(/\s+/).filter(Boolean).length
    filteredData.actual_word_count = wordCount
  }

  const { data: section, error } = await supabase
    .from('proposal_sections')
    .update(filteredData)
    .eq('id', sectionId)
    .select()
    .single()

  if (error) {
    console.error('[PUT /sections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ section: transformFromDb(section as Record<string, unknown>) })
}

// DELETE - Delete a section
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sectionId = url.searchParams.get('sectionId')
  const deleteAll = url.searchParams.get('all') === 'true'

  if (!sectionId && !deleteAll) {
    return NextResponse.json({ error: 'sectionId or all=true is required' }, { status: 400 })
  }

  const { id: proposalId } = await params

  if (deleteAll) {
    const { error } = await supabase
      .from('proposal_sections')
      .delete()
      .eq('proposal_id', proposalId)

    if (error) {
      console.error('[DELETE /sections] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true, all: true })
  }

  const { error } = await supabase
    .from('proposal_sections')
    .delete()
    .eq('id', sectionId)

  if (error) {
    console.error('[DELETE /sections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true, id: sectionId })
}
