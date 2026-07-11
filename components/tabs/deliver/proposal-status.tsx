'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { collabApi, complianceApi, proposalsApi, sectionsApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react'

interface ChecklistItem {
  label: string
  description: string
  complete: boolean
  pending?: boolean // amber state (in progress, needs action)
}

export function ProposalStatus() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    solicitation,
    selectedRoles,
    estimateWbsElements,
    extractedRequirements,
  } = useAppContext()

  // Strategy status
  const [strategyStatus, setStrategyStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [strategyDescription, setStrategyDescription] = useState('No strategy captured')

  // Compliance matrix status
  const [complianceStatus, setComplianceStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [complianceDescription, setComplianceDescription] = useState('No compliance matrix generated')

  // Collab session status
  const [collabStatus, setCollabStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [collabDescription, setCollabDescription] = useState('No director reviews created')

  // Outline status
  const [outlineStatus, setOutlineStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [outlineDescription, setOutlineDescription] = useState('No outline generated')

  // Coaching status
  const [coachingStatus, setCoachingStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [coachingDescription, setCoachingDescription] = useState('No sections coached yet')

  // Technical volume locked status
  const [lockedStatus, setLockedStatus] = useState<'none' | 'pending' | 'complete'>('none')
  const [lockedDescription, setLockedDescription] = useState('No sections locked')

  // Load strategy data
  useEffect(() => {
    if (!proposalId) return
    async function checkStrategy() {
      try {
        const response = await proposalsApi.get(proposalId) as {
          proposal: {
            strategy?: {
              decision: string | null
              winThemes: string[]
              pastPerformanceStrength: string | null
            }
          }
        }
        const strategy = response.proposal?.strategy
        if (!strategy || !strategy.decision) {
          setStrategyStatus('none')
          setStrategyDescription('No strategy captured')
        } else {
          const hasWinThemes = strategy.winThemes?.some((t: string) => t.trim().length > 0)
          const hasPastPerformance = Boolean(strategy.pastPerformanceStrength)

          if (hasWinThemes && hasPastPerformance) {
            setStrategyStatus('complete')
            const decisionLabel = strategy.decision === 'bid' ? 'Bid' : strategy.decision === 'no-bid' ? 'No Bid' : 'Undecided'
            setStrategyDescription(`Decision: ${decisionLabel}`)
          } else {
            setStrategyStatus('pending')
            setStrategyDescription('Decision set, complete win themes and past performance')
          }
        }
      } catch {
        // Silently fail
      }
    }
    checkStrategy()
  }, [proposalId])

  // Load compliance matrix status
  useEffect(() => {
    if (!proposalId) return
    async function checkCompliance() {
      try {
        const response = await complianceApi.list(proposalId) as {
          items: { compliance_status: string }[]
          stats: { total: number; compliant: number; partial: number; exception: number }
        }
        const items = response.items || []
        const stats = response.stats

        if (items.length === 0) {
          setComplianceStatus('none')
          setComplianceDescription('No compliance matrix generated')
        } else {
          const allCompliant = stats.exception === 0 && stats.partial === 0
          if (allCompliant) {
            setComplianceStatus('complete')
            setComplianceDescription(`${stats.total} items, all compliant`)
          } else {
            setComplianceStatus('pending')
            const issues = stats.exception + stats.partial
            setComplianceDescription(`${stats.total} items, ${issues} need${issues === 1 ? 's' : ''} attention`)
          }
        }
      } catch {
        // Silently fail
      }
    }
    checkCompliance()
  }, [proposalId])

  useEffect(() => {
    if (!proposalId) return
    async function checkCollab() {
      try {
        const response = await collabApi.listSessions(proposalId) as {
          sessions: { status: string; pending_count: number; submission_count: number }[]
        }
        const sessions = response.sessions || []
        const openSessions = sessions.filter(s => s.status === 'open')

        if (openSessions.length === 0 && sessions.length === 0) {
          setCollabStatus('none')
          setCollabDescription('No director reviews created')
        } else if (openSessions.some(s => s.pending_count > 0)) {
          setCollabStatus('pending')
          const totalPending = openSessions.reduce((sum, s) => sum + s.pending_count, 0)
          setCollabDescription(`${totalPending} submission${totalPending !== 1 ? 's' : ''} pending your review`)
        } else if (openSessions.length > 0) {
          setCollabStatus('pending')
          setCollabDescription('Waiting for director submissions')
        } else {
          setCollabStatus('complete')
          setCollabDescription('All director reviews resolved')
        }
      } catch {
        // Silently fail — don't block the status page
      }
    }
    checkCollab()
  }, [proposalId])

  // Load outline status
  useEffect(() => {
    if (!proposalId) return
    async function checkOutline() {
      try {
        const response = await sectionsApi.list(proposalId) as {
          sections: { status: string }[]
          stats: { total: number; complete: number; draft: number; inProgress: number; review: number }
        }
        const sections = response.sections || []
        const stats = response.stats

        if (sections.length === 0) {
          setOutlineStatus('none')
          setOutlineDescription('No outline generated')
        } else {
          const allComplete = stats.complete === stats.total
          if (allComplete) {
            setOutlineStatus('complete')
            setOutlineDescription(`${stats.total} sections complete`)
          } else {
            setOutlineStatus('pending')
            const remaining = stats.total - stats.complete
            setOutlineDescription(`${stats.total} sections, ${remaining} not complete`)
          }
        }
      } catch {
        // Silently fail
      }
    }
    checkOutline()
  }, [proposalId])

  // Load coaching status
  useEffect(() => {
    if (!proposalId) return
    async function checkCoaching() {
      try {
        // First get sections
        const sectionsResponse = await sectionsApi.list(proposalId) as {
          sections: { id: string }[]
        }
        const sections = sectionsResponse.sections || []

        if (sections.length === 0) {
          setCoachingStatus('none')
          setCoachingDescription('No sections to coach')
          return
        }

        // Fetch coaching for each section
        let coachedCount = 0
        let belowThresholdCount = 0

        for (const section of sections) {
          try {
            const response = await fetch(
              `/api/proposals/${proposalId}/sections/${section.id}/coach`
            )
            if (response.ok) {
              const data = await response.json()
              if (data.history?.length > 0) {
                coachedCount++
                const latest = data.history[0]
                const scores = latest.scores || {}
                const avgScore = Object.values(scores).reduce((a: number, b) => a + (b as number), 0) / 5
                if (avgScore < 3.5) {
                  belowThresholdCount++
                }
              }
            }
          } catch {
            // Skip this section
          }
        }

        if (coachedCount === 0) {
          setCoachingStatus('none')
          setCoachingDescription('No sections coached yet')
        } else if (belowThresholdCount > 0) {
          setCoachingStatus('pending')
          setCoachingDescription(`${coachedCount} coached, ${belowThresholdCount} below 3.5 average`)
        } else if (coachedCount === sections.length) {
          setCoachingStatus('complete')
          setCoachingDescription(`All ${coachedCount} sections coached and passing`)
        } else {
          setCoachingStatus('pending')
          setCoachingDescription(`${coachedCount} of ${sections.length} sections coached`)
        }
      } catch {
        // Silently fail
      }
    }
    checkCoaching()
  }, [proposalId])

  // Load technical volume locked status
  useEffect(() => {
    if (!proposalId) return
    async function checkLocked() {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/export/technical-volume`)
        if (response.ok) {
          const data = await response.json()
          if (data.total === 0) {
            setLockedStatus('none')
            setLockedDescription('No sections created yet')
          } else if (data.allLocked) {
            setLockedStatus('complete')
            setLockedDescription(`All ${data.locked} sections locked`)
          } else if (data.locked > 0) {
            setLockedStatus('pending')
            setLockedDescription(`${data.locked} of ${data.total} sections locked`)
          } else {
            setLockedStatus('none')
            setLockedDescription('No sections locked')
          }
        }
      } catch {
        // Silently fail
      }
    }
    checkLocked()
  }, [proposalId])

  const totalValue = selectedRoles.reduce((sum, r) => {
    const activeYears = Object.values(r.years).filter(Boolean).length
    return sum + r.baseSalary * r.fte * activeYears
  }, 0)

  const items: ChecklistItem[] = [
    {
      label: 'Strategy captured',
      description: strategyDescription,
      complete: strategyStatus === 'complete',
      pending: strategyStatus === 'pending',
    },
    {
      label: 'Solicitation analyzed',
      description: solicitation.title ? `"${solicitation.title}"` : 'Upload and analyze an RFP document',
      complete: Boolean(solicitation.title || solicitation.solicitationNumber),
    },
    {
      label: 'Requirements reviewed',
      description: extractedRequirements.length > 0
        ? `${extractedRequirements.length} requirements extracted`
        : 'Extract requirements from your RFP',
      complete: extractedRequirements.length > 0,
    },
    {
      label: 'Compliance matrix reviewed',
      description: complianceDescription,
      complete: complianceStatus === 'complete',
      pending: complianceStatus === 'pending',
    },
    {
      label: 'WBS elements complete',
      description: estimateWbsElements.length > 0
        ? `${estimateWbsElements.length} WBS elements defined`
        : 'Create work breakdown structure elements',
      complete: estimateWbsElements.length > 0,
    },
    {
      label: 'Roles assigned',
      description: selectedRoles.length > 0
        ? `${selectedRoles.length} roles on the team`
        : 'Add roles to your team in Roles & Pricing',
      complete: selectedRoles.length > 0,
    },
    {
      label: 'Pricing set',
      description: totalValue > 0
        ? `Total value: $${totalValue.toLocaleString()}`
        : 'Set rates and calculate total contract value',
      complete: totalValue > 0,
    },
    {
      label: 'Director review resolved',
      description: collabDescription,
      complete: collabStatus === 'complete',
      pending: collabStatus === 'pending',
    },
    {
      label: 'Proposal outline complete',
      description: outlineDescription,
      complete: outlineStatus === 'complete',
      pending: outlineStatus === 'pending',
    },
    {
      label: 'Sections coached',
      description: coachingDescription,
      complete: coachingStatus === 'complete',
      pending: coachingStatus === 'pending',
    },
    {
      label: 'Technical volume locked',
      description: lockedDescription,
      complete: lockedStatus === 'complete',
      pending: lockedStatus === 'pending',
    },
  ]

  const completedCount = items.filter(i => i.complete).length
  const progress = Math.round((completedCount / items.length) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Proposal Status</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {completedCount} of {items.length} steps complete ({progress}%)
        </p>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card className="p-0 divide-y divide-gray-100 space-y-0">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 p-4">
            {item.complete ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : item.pending ? (
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${item.complete ? 'text-gray-900' : item.pending ? 'text-amber-700' : 'text-gray-500'}`}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </Card>

      {completedCount < items.length && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Complete all checklist items before generating your final proposal documents.
          </p>
        </div>
      )}
    </div>
  )
}
