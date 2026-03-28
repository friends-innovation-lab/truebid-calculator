import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch company settings
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // First get the company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', company.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

// POST - Create or update company settings (upsert)
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  const body = await request.json()

  // Only include fields that were actually sent — prevents overwriting
  // existing values with null when a partial update is made
  const upsertData: Record<string, unknown> = {
    company_id: company.id,
    updated_at: new Date().toISOString(),
  }
  if (body.fringe_rate !== undefined) upsertData.fringe_rate = body.fringe_rate
  if (body.overhead_rate !== undefined) upsertData.overhead_rate = body.overhead_rate
  if (body.ga_rate !== undefined) upsertData.ga_rate = body.ga_rate
  if (body.profit_rate !== undefined) upsertData.profit_rate = body.profit_rate
  if (body.escalation_rate !== undefined) upsertData.escalation_rate = body.escalation_rate
  if (body.salary_structure !== undefined) upsertData.salary_structure = body.salary_structure
  if (body.step_increase_percent !== undefined) upsertData.step_increase_percent = body.step_increase_percent

  const { data, error } = await supabase
    .from('company_settings')
    .upsert(upsertData, {
      onConflict: 'company_id'
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
