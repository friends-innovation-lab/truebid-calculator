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

// PUT - Bulk replace compliance items (delete all existing, insert new)
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

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Expect { items: [...] } with array of compliance items from extraction
  const items = body.items
  console.log('[PUT /compliance] Received items count:', items?.length || 0)
  console.log('[PUT /compliance] Body keys:', Object.keys(body))
  if (!Array.isArray(items)) {
    console.error('[PUT /compliance] items is not an array:', typeof items)
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 })
  }

  // Delete existing compliance items for this proposal
  const { error: deleteError } = await supabase
    .from('compliance_items')
    .delete()
    .eq('proposal_id', id)

  if (deleteError) {
    console.error('[PUT /compliance] Delete error:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Transform extraction format to DB format and insert
  // Extraction format: { ref, rfpSection, type, text, source, requirementId }
  // DB format: { requirement_text, requirement_ref, source, compliance_status, notes }
  // Map RFP section letter to proposal section name
  const sectionMap: Record<string, string> = {
    'L': 'Instructions',
    'M': 'Evaluation',
    'K': 'Representations',
    'J': 'Attachments',
    'C': 'Technical',
    'H': 'Special Provisions',
  }

  const insertData = items.map((item: {
    ref?: string
    rfpSection?: string
    type?: string
    text?: string
    source?: string
    requirementId?: string | null
  }) => ({
    proposal_id: id,
    requirement_text: item.text || '',
    requirement_ref: item.ref || '',
    proposal_section: sectionMap[item.rfpSection || ''] || `Section ${item.rfpSection || 'Unknown'}`,
    // Map rfpSection to source: L/M/K/J = instruction, C/H = requirement
    source: ['L', 'M', 'K', 'J'].includes(item.rfpSection || '') ? 'instruction' : 'requirement',
    compliance_status: 'unaddressed',
    // Store rfpSection and type in notes for display
    notes: `Section ${item.rfpSection || '?'} · ${item.type || 'unknown'} · ${item.source || ''}`,
  }))

  console.log('[PUT /compliance] Transformed insertData count:', insertData.length)

  if (insertData.length === 0) {
    console.warn('[PUT /compliance] No items to insert after transform!')
    return NextResponse.json({ items: [], count: 0 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('compliance_items')
    .insert(insertData)
    .select()

  if (insertError) {
    console.error('[PUT /compliance] Insert error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ items: inserted, count: inserted?.length || 0 })
}

// DELETE - Delete all compliance items for a proposal
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

  const { error } = await supabase
    .from('compliance_items')
    .delete()
    .eq('proposal_id', id)

  if (error) {
    console.error('[DELETE /compliance] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
