import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — Send submission back for revision (authenticated, proposal owner only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
  const { token } = await params

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { note?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Note is optional
  }

  // Find link
  const { data: link, error: linkError } = await supabase
    .from('collab_section_links')
    .select('id, proposal_id, submission_status')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', link.proposal_id)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Update link: set status back to pending and save reviewer note
  const { error: updateError } = await supabase
    .from('collab_section_links')
    .update({
      submission_status: 'pending',
      reviewer_note: body.note || null,
      submitted_at: null, // Clear submitted timestamp
    })
    .eq('id', link.id)

  if (updateError) {
    console.error('[POST /api/collaborate/[token]/send-back] Error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Sent back for revision' })
}
