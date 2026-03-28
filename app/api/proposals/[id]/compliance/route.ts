import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createComplianceItemSchema = z.object({
  requirement_text: z.string().min(1),
  requirement_ref: z.string().optional(),
  proposal_section: z.string().optional(),
  owner: z.string().optional(),
  compliance_status: z.enum([
    'unaddressed',
    'compliant',
    'partial',
    'exception',
    'not_applicable'
  ]).default('unaddressed'),
  notes: z.string().optional(),
})

// GET - Fetch all compliance items for proposal with stats
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

  const { data: items, error } = await supabase
    .from('compliance_items')
    .select('*')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /compliance] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate stats
  const stats = {
    total: items?.length || 0,
    compliant: items?.filter(i => i.compliance_status === 'compliant').length || 0,
    partial: items?.filter(i => i.compliance_status === 'partial').length || 0,
    unaddressed: items?.filter(i => i.compliance_status === 'unaddressed').length || 0,
    exception: items?.filter(i => i.compliance_status === 'exception').length || 0,
    not_applicable: items?.filter(i => i.compliance_status === 'not_applicable').length || 0,
  }

  return NextResponse.json({ items: items || [], stats })
}

// POST - Create a single compliance item manually
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

  const validated = createComplianceItemSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  const { data: item, error } = await supabase
    .from('compliance_items')
    .insert({
      proposal_id: id,
      ...validated.data,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /compliance] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item }, { status: 201 })
}
