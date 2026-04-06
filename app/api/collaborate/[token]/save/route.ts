import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — Auto-save draft content (public, token-based)
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
    .select('id, expires_at, submission_status')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  // Only save if still pending
  if (link.submission_status !== 'pending') {
    return NextResponse.json({ error: 'Cannot save — already submitted' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('collab_section_links')
    .update({ submission_content: body.content })
    .eq('id', link.id)

  if (updateError) {
    console.error('[PATCH /api/collaborate/[token]/save] Error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
