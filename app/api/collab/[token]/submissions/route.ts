import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSubmissionSchema } from '@/lib/schemas/collab'

// Helper to validate token and get session (shared by GET and POST)
async function getSessionByToken(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const { data: session, error } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !session) {
    return { session: null, error: 'Invalid collaboration link', status: 404 }
  }
  if (session.status === 'closed') {
    return { session: null, error: 'This collaboration session has been closed', status: 410 }
  }
  if (session.status === 'expired' || (session.expires_at && new Date(session.expires_at) < new Date())) {
    return { session: null, error: 'This collaboration link has expired', status: 410 }
  }
  return { session, error: null, status: 200 }
}

// GET — fetch director's existing submissions (NO AUTH — public endpoint)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  const { session, error, status } = await getSessionByToken(supabase, token)
  if (!session) {
    return NextResponse.json({ error }, { status })
  }

  const { data: submissions, error: subError } = await supabase
    .from('wbs_submissions')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  return NextResponse.json({ submissions: submissions || [] })
}

// POST — create or update a submission (NO AUTH — public endpoint)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  const { session, error: sessionError, status: sessionStatus } = await getSessionByToken(supabase, token)
  if (!session) {
    return NextResponse.json({ error: sessionError }, { status: sessionStatus })
  }

  const body = await request.json()

  const result = createSubmissionSchema.safeParse(body)
  if (!result.success) {
    const flat = result.error.flatten()
    const messages = [
      ...Object.entries(flat.fieldErrors).map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`),
      ...flat.formErrors,
    ]
    return NextResponse.json({ error: messages.join('; ') || 'Invalid request data' }, { status: 400 })
  }

  const submissionData = result.data

  // Validate wbs_element_id is in assigned list (unless new element)
  if (!submissionData.is_new_element && submissionData.wbs_element_id) {
    if (!session.assigned_wbs_ids.includes(submissionData.wbs_element_id)) {
      return NextResponse.json(
        { error: 'WBS element is not assigned to this collaboration session' },
        { status: 403 }
      )
    }
  }

  // Check if a submission already exists for this WBS element in this session
  if (submissionData.wbs_element_id) {
    const { data: existing } = await supabase
      .from('wbs_submissions')
      .select('id')
      .eq('session_id', session.id)
      .eq('wbs_element_id', submissionData.wbs_element_id)
      .single()

    if (existing) {
      // Update existing submission
      const { data, error } = await supabase
        .from('wbs_submissions')
        .update({
          ...submissionData,
          status: 'pending', // Reset to pending on re-submission
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ submission: data })
    }
  }

  // Create new submission
  const { data, error } = await supabase
    .from('wbs_submissions')
    .insert({
      session_id: session.id,
      ...submissionData,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submission: data }, { status: 201 })
}
