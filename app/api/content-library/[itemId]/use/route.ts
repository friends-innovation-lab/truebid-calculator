import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { recordUseSchema } from '@/lib/schemas/content-library'

// POST - Record that this item was used in a proposal
export async function POST(
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
  const validated = recordUseSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  // Verify the item exists and belongs to this company
  const { data: existingItem, error: fetchError } = await supabase
    .from('content_library')
    .select('id, use_count')
    .eq('id', itemId)
    .eq('company_id', company.id)
    .single()

  if (fetchError || !existingItem) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Increment use_count and set last_used_at
  const { data: item, error } = await supabase
    .from('content_library')
    .update({
      use_count: (existingItem.use_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error) {
    console.error('[POST /content-library/item/use] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item })
}
