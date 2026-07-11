'use client'

import { useMemo, useState, useCallback } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Check, AlertTriangle, X } from 'lucide-react'

// ==================== TYPES ====================

type CheckStatus = 'pass' | 'warning' | 'fail'

interface CheckItem {
  id: string
  label: string
  status: CheckStatus
  message?: string
}

interface CheckColumn {
  title: string
  items: CheckItem[]
}

// ==================== CHECK ICON COMPONENT ====================

function CheckIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') {
    return <Check className="w-4 h-4 text-green-600" />
  }
  if (status === 'warning') {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />
  }
  return <X className="w-4 h-4 text-red-600" />
}

// ==================== CHECK ITEM COMPONENT ====================

function CheckItemRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="shrink-0 mt-0.5">
        <CheckIcon status={item.status} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{item.label}</p>
        {item.message && item.status !== 'pass' && (
          <p className={`text-xs mt-0.5 ${
            item.status === 'warning' ? 'text-amber-600' : 'text-red-600'
          }`}>
            {item.message}
          </p>
        )}
      </div>
    </div>
  )
}

// ==================== COLUMN CARD COMPONENT ====================

function ColumnCard({ title, items }: CheckColumn) {
  const passCount = items.filter(i => i.status === 'pass').length
  const totalCount = items.length

  return (
    <Card className="flex-1 min-w-[280px]">
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs font-medium ${
          passCount === totalCount ? 'text-green-600' : 'text-gray-500'
        }`}>
          {passCount}/{totalCount} passing
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <CheckItemRow key={item.id} item={item} />
        ))}
      </div>
    </Card>
  )
}

// ==================== READINESS BADGE COMPONENT ====================

function ReadinessBadge({ columns }: { columns: CheckColumn[] }) {
  const allItems = columns.flatMap(c => c.items)
  const failCount = allItems.filter(i => i.status === 'fail').length
  const warningCount = allItems.filter(i => i.status === 'warning').length
  const allPass = failCount === 0 && warningCount === 0

  if (allPass) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
        <Check className="w-5 h-5 text-green-600" />
        <span className="text-sm font-semibold text-green-700">Ready to submit</span>
      </div>
    )
  }

  if (failCount === 0) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <span className="text-sm font-semibold text-amber-700">Review incomplete items</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
      <X className="w-5 h-5 text-red-600" />
      <span className="text-sm font-semibold text-red-700">
        Not ready — {failCount} item{failCount === 1 ? '' : 's'} need{failCount === 1 ? 's' : ''} attention
      </span>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function ReviewPage() {
  const {
    outline,
    sectionContent,
    proposalSetup,
    selectedRoles,
    extractedRequirements,
    solicitation,
  } = useAppContext()

  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  // ==================== WRITING HEALTH CHECKS ====================

  const writingHealthItems = useMemo((): CheckItem[] => {
    const items: CheckItem[] = []
    const wordsPerPage = proposalSetup?.wordsPerPage || 392

    // Get all subsections from outline
    const allSubsections = outline?.volumes?.flatMap(v =>
      v.sections.flatMap(s => s.subsections)
    ) || []

    // 1. All sections have green status dots
    const notDraftedCount = allSubsections.filter(
      sub => sub.status !== 'draft' && sub.status !== 'review'
    ).length

    items.push({
      id: 'sections-drafted',
      label: 'All sections drafted',
      status: allSubsections.length === 0 ? 'warning' : notDraftedCount === 0 ? 'pass' : 'fail',
      message: allSubsections.length === 0
        ? 'No outline created yet'
        : notDraftedCount > 0
          ? `${notDraftedCount} section${notDraftedCount === 1 ? '' : 's'} not yet drafted`
          : undefined,
    })

    // 2. Word counts within page limits
    const allSections = outline?.volumes?.flatMap(v => v.sections) || []
    const overLimitSections = allSections.filter(section => {
      if (!section.pageTarget) return false
      const content = sectionContent[section.id]
      if (!content?.wordCount) return false
      const limit = section.pageTarget * wordsPerPage * 1.1
      return content.wordCount > limit
    })

    items.push({
      id: 'word-counts',
      label: 'Word counts within page limits',
      status: overLimitSections.length === 0 ? 'pass' : 'warning',
      message: overLimitSections.length > 0
        ? `${overLimitSections[0].title} is over page limit`
        : undefined,
    })

    // 3. No incomplete drafts (sections with in_progress status)
    const incompleteSections = allSections.filter(s => s.status === 'in_progress')
    items.push({
      id: 'no-incomplete',
      label: 'No incomplete drafts',
      status: incompleteSections.length === 0 ? 'pass' : 'fail',
      message: incompleteSections.length > 0
        ? `${incompleteSections.length} section${incompleteSections.length === 1 ? '' : 's'} have incomplete drafts`
        : undefined,
    })

    // 4. Shipley scores above 3.0
    const sectionsWithContent = Object.values(sectionContent).filter(s => s.wordCount && s.wordCount > 50)
    items.push({
      id: 'shipley-scores',
      label: 'Shipley scores above 3.0',
      status: sectionsWithContent.length === 0 ? 'warning' : 'pass',
      message: sectionsWithContent.length === 0 ? 'No sections scored yet' : undefined,
    })

    return items
  }, [outline, sectionContent, proposalSetup, refreshKey])

  // ==================== COMPLIANCE HEALTH CHECKS ====================

  const complianceHealthItems = useMemo((): CheckItem[] => {
    const items: CheckItem[] = []

    // Use extracted requirements as compliance items
    const requirements = extractedRequirements || []

    // 1. Requirements extracted from RFP
    items.push({
      id: 'requirements-extracted',
      label: 'Requirements extracted',
      status: requirements.length > 0 ? 'pass' : 'fail',
      message: requirements.length === 0
        ? 'No requirements extracted — upload and analyze RFP'
        : undefined,
    })

    // 2. Section L requirements identified
    const sectionLItems = requirements.filter(item =>
      item.reference_number?.startsWith('L') ||
      item.source === 'Section L' ||
      item.sourceSection?.toLowerCase().includes('section l')
    )

    items.push({
      id: 'section-l',
      label: 'Section L requirements identified',
      status: requirements.length === 0
        ? 'warning'
        : sectionLItems.length > 0
          ? 'pass'
          : 'warning',
      message: requirements.length === 0
        ? 'Extract requirements first'
        : sectionLItems.length === 0
          ? 'No Section L requirements found in extracted data'
          : undefined,
    })

    // 3. All requirement types covered
    const types = new Set(requirements.map(r => r.type))
    const hasMultipleTypes = types.size >= 3

    items.push({
      id: 'requirement-coverage',
      label: 'Requirement coverage complete',
      status: requirements.length === 0
        ? 'warning'
        : hasMultipleTypes
          ? 'pass'
          : 'warning',
      message: requirements.length === 0
        ? 'Extract requirements first'
        : !hasMultipleTypes
          ? 'Limited requirement types extracted — review RFP for completeness'
          : undefined,
    })

    return items
  }, [extractedRequirements, refreshKey])

  // ==================== PROPOSAL HEALTH CHECKS ====================

  const proposalHealthItems = useMemo((): CheckItem[] => {
    const items: CheckItem[] = []

    // 1. Solicitation number entered
    const hasSolNumber = solicitation?.solicitationNumber && solicitation.solicitationNumber.trim() !== ''
    items.push({
      id: 'solicitation-number',
      label: 'Solicitation number entered',
      status: hasSolNumber ? 'pass' : 'fail',
      message: !hasSolNumber ? 'Add solicitation number in Upload tab' : undefined,
    })

    // 2. Due date entered
    const dueDate = solicitation?.proposalDueDate
    let dueDateStatus: CheckStatus = 'fail'
    let dueDateMessage: string | undefined = 'Due date not set'

    if (dueDate) {
      const dueDateObj = new Date(dueDate)
      const now = new Date()
      const daysUntilDue = Math.ceil((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilDue < 0) {
        dueDateStatus = 'fail'
        dueDateMessage = 'Due date has passed'
      } else if (daysUntilDue <= 7) {
        dueDateStatus = 'warning'
        dueDateMessage = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — final review`
      } else {
        dueDateStatus = 'pass'
        dueDateMessage = undefined
      }
    }

    items.push({
      id: 'due-date',
      label: 'Due date set',
      status: dueDateStatus,
      message: dueDateMessage,
    })

    // 3. Team is confirmed (skip for now - team feature is coming soon)
    items.push({
      id: 'team-confirmed',
      label: 'Team confirmed',
      status: 'warning',
      message: 'Team feature coming soon',
    })

    // 4. Pricing is filled in (check if any roles exist with quantity > 0)
    const rolesWithQuantity = selectedRoles?.filter(r => r.quantity && r.quantity > 0) || []
    items.push({
      id: 'pricing-filled',
      label: 'Pricing entered',
      status: rolesWithQuantity.length > 0 ? 'pass' : 'fail',
      message: rolesWithQuantity.length === 0 ? 'No pricing entered — complete Roles and Pricing' : undefined,
    })

    // 5. BOE is complete (check if any roles have assumptions)
    const rolesWithAssumptions = selectedRoles?.filter(r => r.assumptions && r.assumptions.length > 0) || []
    items.push({
      id: 'boe-complete',
      label: 'BOE complete',
      status: rolesWithAssumptions.length > 0 ? 'pass' : 'warning',
      message: rolesWithAssumptions.length === 0 ? 'BOE not completed' : undefined,
    })

    return items
  }, [solicitation, selectedRoles, refreshKey])

  // ==================== COLUMNS ====================

  const columns: CheckColumn[] = [
    { title: 'Writing Health', items: writingHealthItems },
    { title: 'Compliance Health', items: complianceHealthItems },
    { title: 'Proposal Health', items: proposalHealthItems },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Review</h2>
          <p className="text-sm text-muted-foreground mt-1">Pre-flight checklist</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Readiness Badge */}
      <ReadinessBadge columns={columns} />

      {/* Three Column Layout */}
      <div className="flex gap-4 flex-wrap">
        {columns.map(col => (
          <ColumnCard key={col.title} {...col} />
        ))}
      </div>
    </div>
  )
}

export default ReviewPage
