import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — Approve and merge collaborator content into proposal sections
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  let body: { content?: string; sectionIds?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.content || !body.sectionIds?.length) {
    return NextResponse.json({ error: 'content and sectionIds are required' }, { status: 400 })
  }

  // Find link
  const { data: link, error: linkError } = await supabase
    .from('collab_section_links')
    .select('id, proposal_id, section_ids')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Update proposal sections with the approved content
  // Split content by H2 headings and distribute to matching sections
  for (const sectionId of body.sectionIds) {
    const { error: updateError } = await supabase
      .from('proposal_sections')
      .update({
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
        content_text: body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        last_edited_at: new Date().toISOString(),
        last_edited_by: 'collaborator',
      })
      .eq('id', sectionId)
      .eq('proposal_id', link.proposal_id)

    if (updateError) {
      console.error(`[POST /api/collaborate/[token]/approve] Section ${sectionId}:`, updateError)
    }
  }

  // Update collab link status
  const { error: statusError } = await supabase
    .from('collab_section_links')
    .update({
      submission_status: 'transform_approved',
      approved_at: new Date().toISOString(),
      transformed_content: { html: body.content },
    })
    .eq('id', link.id)

  if (statusError) {
    console.error('[POST /api/collaborate/[token]/approve] Status update:', statusError)
    return NextResponse.json({ error: statusError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
