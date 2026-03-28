'use client'

import { useAppContext } from '@/contexts/app-context'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'

interface ChecklistItem {
  label: string
  description: string
  complete: boolean
}

export function ProposalStatus() {
  const {
    solicitation,
    selectedRoles,
    estimateWbsElements,
    extractedRequirements,
  } = useAppContext()

  const totalValue = selectedRoles.reduce((sum, r) => {
    const activeYears = Object.values(r.years).filter(Boolean).length
    return sum + r.baseSalary * r.fte * activeYears
  }, 0)

  const items: ChecklistItem[] = [
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
      description: 'All review comments addressed',
      // TODO: Wire to real review/comment system post-launch
      complete: false,
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
            ) : (
              <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${item.complete ? 'text-gray-900' : 'text-gray-500'}`}>
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
