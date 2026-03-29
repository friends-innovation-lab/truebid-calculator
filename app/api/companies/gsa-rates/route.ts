import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all GSA rates for the company
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ rates: [] })
  }

  const { data, error } = await supabase
    .from('gsa_rates')
    .select('*')
    .eq('company_id', company.id)
    .order('sin', { ascending: true })
    .order('labor_category', { ascending: true })

  if (error) {
    console.error('[GSA Rates API] Get error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform snake_case to camelCase
  const rates = (data || []).map(r => ({
    id: r.id,
    laborCategory: r.labor_category,
    sin: r.sin,
    scheduleName: r.schedule_name,
    year1Rate: r.year_1_rate,
    year2Rate: r.year_2_rate,
    year3Rate: r.year_3_rate,
    year4Rate: r.year_4_rate,
    year5Rate: r.year_5_rate,
    yearsExperience: r.years_experience,
    education: r.education,
    educationSubstitution: r.education_substitution,
    notes: r.notes,
  }))

  return NextResponse.json({ rates })
}

// POST - Create a new GSA rate
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('gsa_rates')
    .insert({
      company_id: company.id,
      labor_category: body.laborCategory,
      sin: body.sin,
      schedule_name: body.scheduleName || 'GSA MAS',
      year_1_rate: body.year1Rate,
      year_2_rate: body.year2Rate,
      year_3_rate: body.year3Rate,
      year_4_rate: body.year4Rate,
      year_5_rate: body.year5Rate,
      years_experience: body.yearsExperience,
      education: body.education,
      education_substitution: body.educationSubstitution,
      notes: body.notes,
    })
    .select()
    .single()

  if (error) {
    console.error('[GSA Rates API] Create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rate: {
      id: data.id,
      laborCategory: data.labor_category,
      sin: data.sin,
      scheduleName: data.schedule_name,
      year1Rate: data.year_1_rate,
      year2Rate: data.year_2_rate,
      year3Rate: data.year_3_rate,
      year4Rate: data.year_4_rate,
      year5Rate: data.year_5_rate,
      yearsExperience: data.years_experience,
      education: data.education,
      educationSubstitution: data.education_substitution,
      notes: data.notes,
    }
  }, { status: 201 })
}

// PUT - Update a GSA rate (expects id in body)
export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'Rate ID required' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (body.laborCategory !== undefined) updateData.labor_category = body.laborCategory
  if (body.sin !== undefined) updateData.sin = body.sin
  if (body.scheduleName !== undefined) updateData.schedule_name = body.scheduleName
  if (body.year1Rate !== undefined) updateData.year_1_rate = body.year1Rate
  if (body.year2Rate !== undefined) updateData.year_2_rate = body.year2Rate
  if (body.year3Rate !== undefined) updateData.year_3_rate = body.year3Rate
  if (body.year4Rate !== undefined) updateData.year_4_rate = body.year4Rate
  if (body.year5Rate !== undefined) updateData.year_5_rate = body.year5Rate
  if (body.yearsExperience !== undefined) updateData.years_experience = body.yearsExperience
  if (body.education !== undefined) updateData.education = body.education
  if (body.educationSubstitution !== undefined) updateData.education_substitution = body.educationSubstitution
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data, error } = await supabase
    .from('gsa_rates')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    console.error('[GSA Rates API] Update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rate: {
      id: data.id,
      laborCategory: data.labor_category,
      sin: data.sin,
      scheduleName: data.schedule_name,
      year1Rate: data.year_1_rate,
      year2Rate: data.year_2_rate,
      year3Rate: data.year_3_rate,
      year4Rate: data.year_4_rate,
      year5Rate: data.year_5_rate,
      yearsExperience: data.years_experience,
      education: data.education,
      educationSubstitution: data.education_substitution,
      notes: data.notes,
    }
  })
}

// DELETE - Delete a GSA rate
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Rate ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('gsa_rates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[GSA Rates API] Delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
