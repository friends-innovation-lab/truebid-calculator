import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { reviewSubmissionSchema } from '@/lib/schemas/collab'

// GET — get all submissions for a session
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await params

  const { data, error } = await supabase
    .from('wbs_submissions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submissions: data || [] })
}

// PUT — review a submission (accept, modify, or reject)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const result = reviewSubmissionSchema.safeParse(body)
  if (!result.success) {
    const flat = result.error.flatten()
    const messages = [
      ...Object.entries(flat.fieldErrors).map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`),
      ...flat.formErrors,
    ]
    return NextResponse.json({ error: messages.join('; ') || 'Invalid request data' }, { status: 400 })
  }

  const { submissionId, status, owner_response, modified_values } = result.data

  // Update the submission status
  const { data: submission, error: subError } = await supabase
    .from('wbs_submissions')
    .update({
      status,
      owner_response,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single()

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // If accepted: apply proposed values to the WBS element
  if (status === 'accepted' && submission.wbs_element_id) {
    const wbsUpdate: Record<string, unknown> = {}
    if (submission.proposed_title) wbsUpdate.title = submission.proposed_title
    if (submission.proposed_hours) wbsUpdate.hours = submission.proposed_hours
    if (submission.proposed_estimation_method) wbsUpdate.estimation_method = submission.proposed_estimation_method

    if (Object.keys(wbsUpdate).length > 0) {
      await supabase
        .from('wbs_elements')
        .update(wbsUpdate)
        .eq('id', submission.wbs_element_id)
    }
  }

  // If modified: apply owner's modified values to WBS element
  if (status === 'modified' && submission.wbs_element_id && modified_values) {
    const wbsUpdate: Record<string, unknown> = {}
    if (modified_values.title) wbsUpdate.title = modified_values.title
    if (modified_values.hours !== undefined) wbsUpdate.hours = modified_values.hours
    if (modified_values.description) wbsUpdate.description = modified_values.description

    if (Object.keys(wbsUpdate).length > 0) {
      await supabase
        .from('wbs_elements')
        .update(wbsUpdate)
        .eq('id', submission.wbs_element_id)
    }
  }

  return NextResponse.json({ submission })
}
