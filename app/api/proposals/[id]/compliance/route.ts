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
  source: z.enum(['requirement', 'instruction']).default('requirement'),
  linked_wbs_ids: z.array(z.string().uuid()).optional(),
})

// GET - Fetch all compliance items for proposal with stats and WBS elements
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

  // Fetch compliance items and WBS elements in parallel
  const [itemsResult, wbsResult] = await Promise.all([
    supabase
      .from('compliance_items')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('wbs_elements')
      .select('id, wbs_number, title')
      .eq('proposal_id', id)
      .order('wbs_number', { ascending: true }),
  ])

  if (itemsResult.error) {
    console.error('[GET /compliance] Items error:', itemsResult.error)
    return NextResponse.json({ error: itemsResult.error.message }, { status: 500 })
  }

  if (wbsResult.error) {
    console.error('[GET /compliance] WBS error:', wbsResult.error)
    return NextResponse.json({ error: wbsResult.error.message }, { status: 500 })
  }

  const items = itemsResult.data || []
  const wbsElements = wbsResult.data || []

  // Build WBS lookup map
  const wbsMap = new Map(wbsElements.map(w => [w.id, { id: w.id, wbs_number: w.wbs_number, title: w.title }]))

  // Enrich items with linked WBS data
  const enrichedItems = items.map(item => {
    const linkedWbsIds = item.linked_wbs_ids || []
    const linkedWbs = linkedWbsIds
      .map((wbsId: string) => wbsMap.get(wbsId))
      .filter(Boolean)
    return { ...item, linkedWbs }
  })

  // Calculate stats including unlinked requirements count
  const requirementItems = items.filter(i => i.source !== 'instruction')
  const unlinkedRequirements = requirementItems.filter(
    i => !i.linked_wbs_ids || i.linked_wbs_ids.length === 0
  ).length

  const stats = {
    total: items.length,
    compliant: items.filter(i => i.compliance_status === 'compliant').length,
    partial: items.filter(i => i.compliance_status === 'partial').length,
    unaddressed: items.filter(i => i.compliance_status === 'unaddressed').length,
    exception: items.filter(i => i.compliance_status === 'exception').length,
    not_applicable: items.filter(i => i.compliance_status === 'not_applicable').length,
    unlinkedRequirements,
  }

  return NextResponse.json({ items: enrichedItems, stats, wbsElements })
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
