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

  // Get assigned section/subsection IDs
  const assignedIds = new Set(link.section_ids || [])

  // Look up sections from outline in working_data
  interface OutlineSubsection {
    id: string
    number: string
    title: string
    pageTarget: number | null
    status: string
  }
  interface OutlineSection {
    id: string
    number: string
    title: string
    description: string | null
    complianceRefs: string[]
    requirementRefs: string[]
    subsections: OutlineSubsection[]
  }
  interface OutlineVolume {
    id: string
    title: string
    sections: OutlineSection[]
  }
  interface ProposalOutline {
    volumes: OutlineVolume[]
  }

  const workingData = proposal.working_data as { outline?: ProposalOutline } | null
  const outline = workingData?.outline

  // Build sections list from outline subsections that match assigned IDs
  const sections: { id: string; title: string; sectionNumber: string | null; sortOrder: number; summary: string | null; instructions: string | null; complianceItemIds: string[]; requirementRefs: string[] }[] = []
  let sortOrder = 0

  if (outline?.volumes) {
    for (const volume of outline.volumes) {
      for (const section of volume.sections) {
        // Check if any subsections are assigned
        for (const sub of section.subsections || []) {
          if (assignedIds.has(sub.id)) {
            sections.push({
              id: sub.id,
              title: sub.title,
              sectionNumber: sub.number || null,
              sortOrder: sortOrder++,
              summary: null,
              instructions: null,
              complianceItemIds: [],
              requirementRefs: [],
            })
          }
        }
      }
    }
  }

  // Fetch compliance items for these sections (if any have compliance IDs)
  const allComplianceIds = sections.flatMap(s => s.complianceItemIds || [])
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
    sections,
    complianceItems,
    winThemes,
    writingGuide,
  })
}
