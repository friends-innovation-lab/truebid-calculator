'use client'

import { use } from 'react'
import { SectionNavigation } from '@/components/navigation/section-navigation'
import { useProposalSync } from '@/hooks/use-proposal-sync'

export default function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // Sync AppContext with Supabase for this proposal
  useProposalSync(id)

  return <SectionNavigation />
}
