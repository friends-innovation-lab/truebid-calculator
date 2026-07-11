import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — validate token and return BOE data (NO AUTH — public endpoint)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  // Look up share link by token
  const { data: shareLink, error: linkError } = await supabase
    .from('boe_share_links')
    .select('*')
    .eq('token', token)
    .single()

  if (linkError || !shareLink) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  // Check if link is active
  if (!shareLink.is_active) {
    return NextResponse.json({ error: 'This link has been deactivated' }, { status: 410 })
  }

  // Check if expired
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  // Fetch proposal with working_data and company_id
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, title, agency, contract_type, solicitation_number, working_data, total_value, period_of_performance, company_id')
    .eq('id', shareLink.proposal_id)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Fetch indirect rates from company_settings (canonical source)
  // This ensures BOE always reflects current company rates, not stale working_data snapshots
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('fringe_rate, overhead_rate, ga_rate')
    .eq('company_id', proposal.company_id)
    .single()

  // Update view count and last viewed timestamp
  await supabase
    .from('boe_share_links')
    .update({
      view_count: (shareLink.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', shareLink.id)

  const workingData = (proposal.working_data || {}) as Record<string, unknown>

  // Extract WBS elements with labor estimates
  const wbsElements = (workingData.estimateWbsElements || []) as {
    id: string
    wbsNumber: string
    title: string
    description?: string
    why?: string
    what?: string
    laborEstimates?: {
      roleId: string
      roleName: string
      hours: number
      rate?: number
    }[]
    totalHours?: number
    totalCost?: number
  }[]

  // Extract roles
  const selectedRoles = (workingData.selectedRoles || []) as {
    id: string
    name: string
    rate?: number
    hourlyRate?: number
    baseSalary?: number
    laborCategory?: string
    icLevel?: string
    hoursByYear?: Record<string, number>
    years?: Record<string, boolean>
  }[]

  // Use company_settings as canonical source for indirect rates
  // Rates are live: changing settings reprices all open proposals and shared BOE links
  const indirectRates = companySettings ? {
    fringe: companySettings.fringe_rate as number | undefined,
    overhead: companySettings.overhead_rate as number | undefined,
    ga: companySettings.ga_rate as number | undefined,
  } : null

  // Extract proposalSetup for option years
  const proposalSetup = workingData.proposalSetup as {
    optionYears?: number
  } | undefined

  // Build BOE summary
  const boeData = {
    proposal: {
      title: proposal.title,
      agency: proposal.agency,
      contractType: proposal.contract_type,
      solicitationNumber: proposal.solicitation_number,
      totalValue: proposal.total_value,
      optionYears: proposalSetup?.optionYears || 0,
    },
    wbsElements: wbsElements.map(el => ({
      id: el.id,
      wbsNumber: el.wbsNumber,
      title: el.title,
      description: el.why || el.what || el.description || '',
      laborEstimates: el.laborEstimates || [],
      totalHours: el.totalHours || 0,
      totalCost: el.totalCost || 0,
    })),
    roles: selectedRoles.map(r => ({
      id: r.id,
      name: r.name,
      rate: r.hourlyRate || r.baseSalary || r.rate || 0,
      laborCategory: r.laborCategory || r.icLevel || '',
      hoursByYear: r.hoursByYear || {},
      years: r.years || {},
    })),
    indirectRates: indirectRates || null,
    linkInfo: {
      expiresAt: shareLink.expires_at,
      viewCount: (shareLink.view_count || 0) + 1,
      approvalStatus: shareLink.approval_status || null,
      accountantNote: shareLink.accountant_note || null,
    },
  }

  return NextResponse.json(boeData)
}
