import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — List collab section links for a proposal
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

  const { data: links, error } = await supabase
    .from('collab_section_links')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/proposals/[id]/collab-links] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ links: links || [] })
}

// POST — Create a new collab section link
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

  const { linkType, label, reviewerEmail, sectionIds, expiresAt } = body

  if (!linkType || !sectionIds?.length) {
    return NextResponse.json({ error: 'linkType and sectionIds are required' }, { status: 400 })
  }

  // Get company_id from proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('company_id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const { data: link, error: insertError } = await supabase
    .from('collab_section_links')
    .insert({
      proposal_id: proposalId,
      company_id: proposal.company_id,
      link_type: linkType,
      label: label || null,
      reviewer_email: reviewerEmail || null,
      section_ids: sectionIds,
      expires_at: expiresAt || null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[POST /api/proposals/[id]/collab-links] Error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ link })
}
