import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch user's company
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[Companies API] Get error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data })
}

// POST - Create company
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('companies')
    .insert({
      owner_id: user.id,
      name: body.name,
      legal_name: body.legal_name,
      sam_uei: body.sam_uei,
      cage_code: body.cage_code,
      duns: body.duns,
      ein: body.ein,
      naics_codes: body.naics_codes,
      address: body.address,
    })
    .select()
    .single()

  if (error) {
    console.error('[Companies API] Create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data }, { status: 201 })
}

// PUT - Update company
export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Only include fields that were actually sent
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (body.name !== undefined) updateData.name = body.name
  if (body.legal_name !== undefined) updateData.legal_name = body.legal_name
  if (body.sam_uei !== undefined) updateData.sam_uei = body.sam_uei
  if (body.cage_code !== undefined) updateData.cage_code = body.cage_code
  if (body.duns !== undefined) updateData.duns = body.duns
  if (body.ein !== undefined) updateData.ein = body.ein
  if (body.naics_codes !== undefined) updateData.naics_codes = body.naics_codes
  if (body.address !== undefined) updateData.address = body.address

  const { data, error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[Companies API] Update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data })
}
