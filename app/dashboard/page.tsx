import { Dashboard } from '@/components/dashboard'
import { createClient } from '@/lib/supabase/server'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

// Types matching the Dashboard component
type ProposalStatus = 'draft' | 'in-review' | 'submitted' | 'won' | 'lost' | 'no-bid'
type ProposalPhase = 'Scope' | 'Staff' | 'Write' | 'Deliver'

// Transform snake_case DB response to camelCase for frontend
function transformProposal(p: Record<string, unknown>) {
  // Handle period_of_performance which is jsonb
  let periodOfPerformance = ''
  if (p.period_of_performance) {
    if (typeof p.period_of_performance === 'string') {
      periodOfPerformance = p.period_of_performance
    } else if (typeof p.period_of_performance === 'object' && (p.period_of_performance as Record<string, unknown>).display) {
      periodOfPerformance = (p.period_of_performance as Record<string, unknown>).display as string
    }
  }

  // Validate status is one of the allowed values
  const rawStatus = (p.status as string) || 'draft'
  const validStatuses: ProposalStatus[] = ['draft', 'in-review', 'submitted', 'won', 'lost', 'no-bid']
  const status: ProposalStatus = validStatuses.includes(rawStatus as ProposalStatus)
    ? rawStatus as ProposalStatus
    : 'draft'

  // Validate contract type
  const rawContractType = (p.contract_type as string) || 'tm'
  const validContractTypes = ['tm', 'ffp', 'cpff', 'hybrid'] as const
  const contractType = validContractTypes.includes(rawContractType as typeof validContractTypes[number])
    ? rawContractType as 'tm' | 'ffp' | 'cpff' | 'hybrid'
    : 'tm'

  return {
    id: p.id as string,
    title: (p.title as string) || 'Untitled Proposal',
    solicitation: (p.solicitation_number as string) || '',
    client: (p.agency as string) || (p.client as string) || '',
    agency: (p.agency as string) || (p.client as string) || '',
    status,
    totalValue: (p.total_value as number) || (p.estimated_value as number) || 0,
    dueDate: (p.due_date as string) || null,
    updatedAt: (p.updated_at as string) || new Date().toISOString(),
    createdAt: (p.created_at as string) || new Date().toISOString(),
    teamSize: (p.team_size as number) || 0,
    progress: (p.progress as number) || 0,
    starred: (p.starred as boolean) || false,
    archived: (p.archived as boolean) || false,
    contractType,
    periodOfPerformance,
    role: 'prime' as const,
    phase: 'Scope' as ProposalPhase,
    complianceGapCount: 0,
    lowestCoachingScore: null,
  }
}

async function getProposals() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!company) return []

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[Dashboard SSR] Failed to fetch proposals:', error)
      return []
    }

    return (data || []).map(transformProposal)
  } catch (error) {
    console.error('[Dashboard SSR] Error:', error)
    return []
  }
}

export default async function DashboardPage() {
  const initialProposals = await getProposals()

  return <Dashboard initialProposals={initialProposals} />
}
