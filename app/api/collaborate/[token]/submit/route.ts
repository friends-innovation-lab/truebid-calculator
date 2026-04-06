import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — Submit collaborator draft (public, token-based)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  let body: { content?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Find link
  const { data: link, error: linkError } = await supabase
    .from('collab_section_links')
    .select('*')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  // Check not already submitted
  if (link.submission_status !== 'pending') {
    return NextResponse.json({ error: 'This link has already been submitted' }, { status: 409 })
  }

  // Update to submitted
  const { error: updateError } = await supabase
    .from('collab_section_links')
    .update({
      submission_status: 'submitted',
      submitted_at: new Date().toISOString(),
      submission_content: body.content || link.submission_content,
    })
    .eq('id', link.id)

  if (updateError) {
    console.error('[PATCH /api/collaborate/[token]/submit] Error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Submission received' })
}
