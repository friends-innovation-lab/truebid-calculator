import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCollabSessionSchema } from '@/lib/schemas/collab'

// GET — list all collab sessions for a proposal with submission counts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  const { data, error } = await supabase
    .from('collab_sessions')
    .select(`
      *,
      wbs_submissions (id, status)
    `)
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sessions = (data || []).map(session => ({
    ...session,
    submission_count: session.wbs_submissions?.length || 0,
    pending_count: session.wbs_submissions?.filter((s: { status: string }) => s.status === 'pending').length || 0,
  }))

  return NextResponse.json({ sessions })
}

// POST — create a new collab session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params
  const body = await request.json()

  const result = createCollabSessionSchema.safeParse(body)
  if (!result.success) {
    const flat = result.error.flatten()
    const messages = [
      ...Object.entries(flat.fieldErrors).map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`),
      ...flat.formErrors,
    ]
    return NextResponse.json({ error: messages.join('; ') || 'Invalid request data' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('collab_sessions')
    .insert({
      proposal_id: proposalId,
      reviewer_name: result.data.reviewer_name,
      reviewer_title: result.data.reviewer_title,
      assigned_wbs_ids: result.data.assigned_wbs_ids,
      created_by: user.id,
      expires_at: result.data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const origin = request.headers.get('origin') || ''
  const review_url = `${origin}/collab/${data.token}`

  return NextResponse.json({ session: data, review_url }, { status: 201 })
}
