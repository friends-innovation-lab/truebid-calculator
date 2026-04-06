import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — Fetch collaborate link data (public, no auth)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  // Find link by token
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

  // Check if already submitted
  if (link.submission_status === 'submitted' || link.submission_status === 'approved') {
    return NextResponse.json({
      status: link.submission_status,
      submittedAt: link.submitted_at,
      message: 'Your submission has been received. Thank you.',
    })
  }

  // Update last_accessed_at
  await supabase
    .from('collab_section_links')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', link.id)

  // Fetch proposal data
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, title, solicitation_number, agency, working_data, strategy')
    .eq('id', link.proposal_id)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Fetch assigned sections
  const { data: sections } = await supabase
    .from('proposal_sections')
    .select('id, title, section_number, sort_order, summary, content, content_text, instructions, compliance_item_ids, requirement_refs')
    .in('id', link.section_ids || [])
    .order('sort_order', { ascending: true })

  // Fetch compliance items for these sections
  const allComplianceIds = (sections || []).flatMap(
    (s: { compliance_item_ids: string[] | null }) => s.compliance_item_ids || []
  )
  let complianceItems: { id: string; reference_number: string; requirement_text: string; compliance_status: string }[] = []
  if (allComplianceIds.length > 0) {
    const { data: items } = await supabase
      .from('compliance_items')
      .select('id, reference_number, requirement_text, compliance_status')
      .in('id', allComplianceIds)
    complianceItems = items || []
  }

  // Extract win themes from strategy
  const strategy = proposal.strategy as { winThemes?: string[]; decision?: string } | null
  const winThemes = strategy?.winThemes || []

  // Get writing guide from company settings
  let writingGuide = null
  if (link.company_id) {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('writing_guide')
      .eq('company_id', link.company_id)
      .single()
    writingGuide = settings?.writing_guide || null
  }

  return NextResponse.json({
    link: {
      id: link.id,
      linkType: link.link_type,
      label: link.label,
      reviewerName: link.reviewer_name,
      reviewerEmail: link.reviewer_email,
      submissionStatus: link.submission_status,
      submissionContent: link.submission_content,
      sectionIds: link.section_ids,
    },
    proposal: {
      id: proposal.id,
      title: proposal.title,
      solicitationNumber: proposal.solicitation_number,
      agency: proposal.agency,
    },
    sections: (sections || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      title: s.title,
      sectionNumber: s.section_number,
      sortOrder: s.sort_order,
      summary: s.summary,
      instructions: s.instructions,
      complianceItemIds: s.compliance_item_ids || [],
      requirementRefs: s.requirement_refs || [],
    })),
    complianceItems,
    winThemes,
    writingGuide,
  })
}
