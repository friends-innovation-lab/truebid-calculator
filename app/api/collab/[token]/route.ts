import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — validate token and return session data (NO AUTH — public endpoint)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  // Look up session by token
  const { data: session, error: sessionError } = await supabase
    .from('collab_sessions')
    .select('*')
    .eq('token', token)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Invalid collaboration link' }, { status: 404 })
  }

  // Check if expired or closed
  if (session.status === 'closed') {
    return NextResponse.json({ error: 'This collaboration session has been closed' }, { status: 410 })
  }
  if (session.status === 'expired' || (session.expires_at && new Date(session.expires_at) < new Date())) {
    return NextResponse.json({ error: 'This collaboration link has expired' }, { status: 410 })
  }

  // Fetch proposal with working_data (WBS elements live in the JSONB blob)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, agency, contract_type, solicitation_number, working_data')
    .eq('id', session.proposal_id)
    .single()

  const workingData = (proposal?.working_data || {}) as Record<string, unknown>

  // Extract assigned WBS elements from working_data
  const allWbs = (workingData.estimateWbsElements || []) as
    { id: string; wbsNumber: string; title: string; description?: string; why?: string; what?: string }[]
  const assignedIds = new Set(session.assigned_wbs_ids || [])
  const wbsElements = allWbs.filter(el => assignedIds.has(el.id)).map(el => ({
    id: el.id,
    wbs_number: el.wbsNumber,
    title: el.title,
    description: el.why || el.what || el.description || '',
  }))

  // Extract role names from the proposal's selected roles
  const selectedRoles = (workingData.selectedRoles || []) as { name: string; id: string }[]
  const roleNames = selectedRoles.map(r => r.name).filter(Boolean)

  // Fallback: fetch company roles if no selected roles in working_data
  let companyRoleNames: string[] = []
  if (roleNames.length === 0) {
    // Find company via proposal
    const { data: proposalFull } = await supabase
      .from('proposals')
      .select('company_id')
      .eq('id', session.proposal_id)
      .single()
    if (proposalFull?.company_id) {
      const { data: companyRoles } = await supabase
        .from('company_roles')
        .select('title')
        .eq('company_id', proposalFull.company_id)
      companyRoleNames = (companyRoles || []).map((r: { title: string }) => r.title).filter(Boolean)
    }
  }

  // Fetch existing submissions for this session
  const { data: submissions } = await supabase
    .from('wbs_submissions')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    session: {
      id: session.id,
      reviewer_name: session.reviewer_name,
      reviewer_title: session.reviewer_title,
      status: session.status,
      expires_at: session.expires_at,
    },
    assigned_wbs_elements: wbsElements || [],
    existing_submissions: submissions || [],
    proposal_context: proposal ? {
      title: proposal.title,
      agency: proposal.agency,
      contract_type: proposal.contract_type,
      solicitation_number: proposal.solicitation_number,
    } : null,
    available_roles: roleNames.length > 0 ? roleNames : companyRoleNames,
  })
}
