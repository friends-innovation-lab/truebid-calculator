import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateContentItemSchema } from '@/lib/schemas/content-library'

// GET - Fetch a single content library item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { itemId } = await params

  // Get user's company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const { data: item, error } = await supabase
    .from('content_library')
    .select('*')
    .eq('id', itemId)
    .eq('company_id', company.id)
    .single()

  if (error) {
    console.error('[GET /content-library/item] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  return NextResponse.json({ item })
}

// PUT - Update a content library item
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { itemId } = await params

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
  const validated = updateContentItemSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  const { data: item, error } = await supabase
    .from('content_library')
    .update({
      ...validated.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error) {
    console.error('[PUT /content-library/item] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item })
}

// DELETE - Soft delete a content library item (set is_active = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { itemId } = await params

  // Get user's company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Soft delete by setting is_active = false
  const { error } = await supabase
    .from('content_library')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('company_id', company.id)

  if (error) {
    console.error('[DELETE /content-library/item] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
