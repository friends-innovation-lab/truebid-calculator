import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateComplianceItemSchema = z.object({
  requirement_text: z.string().min(1).optional(),
  requirement_ref: z.string().optional(),
  proposal_section: z.string().optional(),
  owner: z.string().optional(),
  compliance_status: z.enum([
    'unaddressed',
    'compliant',
    'partial',
    'exception',
    'not_applicable'
  ]).optional(),
  notes: z.string().optional(),
  linked_wbs_ids: z.array(z.string().uuid()).optional(),
})

// PUT - Update a compliance item
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, itemId } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validated = updateComplianceItemSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.issues },
      { status: 400 }
    )
  }

  const { data: item, error } = await supabase
    .from('compliance_items')
    .update({
      ...validated.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('proposal_id', id)
    .select()
    .single()

  if (error) {
    console.error('[PUT /compliance/item] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with linked WBS data if linked_wbs_ids exists
  let enrichedItem = item
  if (item.linked_wbs_ids && item.linked_wbs_ids.length > 0) {
    const { data: wbsElements } = await supabase
      .from('wbs_elements')
      .select('id, wbs_number, title')
      .in('id', item.linked_wbs_ids)

    if (wbsElements) {
      enrichedItem = {
        ...item,
        linkedWbs: wbsElements,
      }
    }
  } else {
    enrichedItem = {
      ...item,
      linkedWbs: [],
    }
  }

  return NextResponse.json({ item: enrichedItem })
}

// DELETE - Remove a compliance item
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, itemId } = await params

  const { error } = await supabase
    .from('compliance_items')
    .delete()
    .eq('id', itemId)
    .eq('proposal_id', id)

  if (error) {
    console.error('[DELETE /compliance/item] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
