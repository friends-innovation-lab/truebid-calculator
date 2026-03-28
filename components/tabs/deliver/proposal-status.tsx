'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { collabApi, complianceApi, proposalsApi } from '@/lib/api'
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
