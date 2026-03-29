import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createContentItemSchema } from '@/lib/schemas/content-library'

// GET - List all content library items for the user's company
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Parse query params for filtering
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const tags = searchParams.get('tags')

  // Build query
  let query = supabase
    .from('content_library')
    .select('*')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('use_count', { ascending: false })

  // Filter by type if provided
  if (type) {
    query = query.eq('type', type)
  }

  // Filter by tags if provided (array contains)
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim())
    query = query.overlaps('tags', tagList)
  }

  const { data: items, error } = await query

  if (error) {
    console.error('[GET /content-library] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: items || [] })
}

// POST - Create a new content library item
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate request body
  const validated = createContentItemSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  const { data: item, error } = await supabase
    .from('content_library')
    .insert({
      company_id: company.id,
      type: validated.data.type,
      title: validated.data.title,
      content: validated.data.content,
      tags: validated.data.tags,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /content-library] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item }, { status: 201 })
}
