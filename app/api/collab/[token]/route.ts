import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — validate token and return session data (NO AUTH — public endpoint)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
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

  // Fetch assigned WBS elements
  const { data: wbsElements } = await supabase
    .from('wbs_elements')
    .select('*')
    .in('id', session.assigned_wbs_ids || [])

  // Fetch existing submissions for this session
  const { data: submissions } = await supabase
    .from('wbs_submissions')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  // Fetch proposal context (minimal — just what the director needs)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, agency, contract_type, solicitation_number')
    .eq('id', session.proposal_id)
    .single()

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
