import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// DELETE — delete a specific collab link
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, linkId } = await params

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Delete the collab link
  const { error } = await supabase
    .from('collab_section_links')
    .delete()
    .eq('id', linkId)
    .eq('proposal_id', proposalId)

  if (error) {
    console.error('[DELETE /api/proposals/[id]/collab-links/[linkId]] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
