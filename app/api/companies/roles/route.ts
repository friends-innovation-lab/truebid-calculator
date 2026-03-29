import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Transform database row (snake_case) to frontend format (camelCase)
function transformRoleFromDb(dbRole: Record<string, unknown>) {
  return {
    id: dbRole.id,
    title: dbRole.title || '',
    laborCategory: dbRole.labor_category || '',
    description: dbRole.description || '',
    functionalResponsibilities: dbRole.functional_responsibilities || '',
    education: dbRole.education || undefined,
    certifications: dbRole.certifications || [],
    levels: dbRole.salary_levels || [],
    blsOccCode: dbRole.soc_code || '',
    blsOccTitle: dbRole.soc_title || '',
    gsaLaborCategory: dbRole.gsa_labor_category || '',
    gsaSin: dbRole.gsa_sin || '',
    scaCode: dbRole.sca_code || '',
    scaOccupation: dbRole.sca_occupation || '',
  }
}

// Transform frontend format (camelCase) to database format (snake_case)
function transformRoleToDb(role: Record<string, unknown>) {
  return {
    title: role.title,
    labor_category: role.laborCategory,
    description: role.description,
    functional_responsibilities: role.functionalResponsibilities,
    education: role.education,
    certifications: role.certifications,
    salary_levels: role.levels,
    soc_code: role.blsOccCode,
    soc_title: role.blsOccTitle,
    gsa_labor_category: role.gsaLaborCategory,
    gsa_sin: role.gsaSin,
    sca_code: role.scaCode,
    sca_occupation: role.scaOccupation,
  }
}

// GET - Fetch all company roles
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
    return NextResponse.json({ roles: [] })
  }

  const { data, error } = await supabase
    .from('company_roles')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform to frontend format
  const roles = (data || []).map(transformRoleFromDb)
  return NextResponse.json({ roles })
}

// POST - Create a new role
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
  const dbData = transformRoleToDb(body)

  const { data, error } = await supabase
    .from('company_roles')
    .insert({
      company_id: company.id,
      ...dbData,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role: transformRoleFromDb(data) }, { status: 201 })
}

// PUT - Update a role (expects id in body)
export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'Role ID required' }, { status: 400 })
  }

  const dbData = transformRoleToDb(body)

  const { data, error } = await supabase
    .from('company_roles')
    .update({
      ...dbData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role: transformRoleFromDb(data) })
}

// DELETE - Delete a role
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Role ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('company_roles')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
