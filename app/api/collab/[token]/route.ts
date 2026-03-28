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

  // Extract assigned WBS elements from working_data
  const allWbs = (proposal?.working_data as Record<string, unknown>)?.estimateWbsElements as
    { id: string; wbsNumber: string; title: string; description?: string; why?: string; what?: string }[] || []
  const assignedIds = new Set(session.assigned_wbs_ids || [])
  const wbsElements = allWbs.filter(el => assignedIds.has(el.id)).map(el => ({
    id: el.id,
    wbs_number: el.wbsNumber,
    title: el.title,
    description: el.why || el.what || el.description || '',
  }))

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
  })
}
