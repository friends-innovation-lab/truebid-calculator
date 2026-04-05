'use client'

import { useMemo, useState, useCallback } from 'react'
import { useAppContext } from '@/contexts/app-context'
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

// ==================== COLORS ====================

const COLORS = {
  canvas: '#FBF9F5',
  surface: '#fff',
  border: '#E8E7E2',
  green: '#639922',
  amber: '#BA7517',
  red: '#A32D2D',
  ink: '#111110',
  muted: '#6B6A65',
}

// ==================== CHECK ICON COMPONENT ====================

function CheckIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') {
    return <Check className="w-4 h-4" style={{ color: COLORS.green }} />
  }
  if (status === 'warning') {
    return <AlertTriangle className="w-4 h-4" style={{ color: COLORS.amber }} />
  }
  return <X className="w-4 h-4" style={{ color: COLORS.red }} />
}

// ==================== CHECK ITEM COMPONENT ====================

function CheckItemRow({ item }: { item: CheckItem }) {
  const messageColor = item.status === 'pass'
    ? COLORS.green
    : item.status === 'warning'
      ? COLORS.amber
      : COLORS.red

  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <CheckIcon status={item.status} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.ink }}>{item.label}</div>
        {item.message && item.status !== 'pass' && (
          <div style={{ fontSize: 11, color: messageColor, marginTop: 2 }}>{item.message}</div>
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
    <div style={{
      background: COLORS.surface,
      border: `0.5px solid ${COLORS.border}`,
      borderRadius: 8,
      padding: 20,
      flex: 1,
      minWidth: 280,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0 }}>{title}</h3>
        <span style={{
          fontSize: 11,
          color: passCount === totalCount ? COLORS.green : COLORS.muted,
          fontWeight: 500,
        }}>
          {passCount}/{totalCount} passing
        </span>
      </div>
      <div>
        {items.map(item => (
          <CheckItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// ==================== READINESS BADGE COMPONENT ====================

function ReadinessBadge({ columns }: { columns: CheckColumn[] }) {
  const allItems = columns.flatMap(c => c.items)
  const failCount = allItems.filter(i => i.status === 'fail').length
  const warningCount = allItems.filter(i => i.status === 'warning').length
  const allPass = failCount === 0 && warningCount === 0

  let status: 'ready' | 'review' | 'not-ready'
  let label: string
  let bgColor: string
  let textColor: string

  if (allPass) {
    status = 'ready'
    label = 'Ready to submit'
    bgColor = '#EAF3DE'
    textColor = COLORS.green
  } else if (failCount === 0) {
    status = 'review'
    label = 'Review incomplete items'
    bgColor = '#FEF3C7'
    textColor = COLORS.amber
  } else {
    status = 'not-ready'
    label = `Not ready — ${failCount} item${failCount === 1 ? '' : 's'} need${failCount === 1 ? 's' : ''} attention`
    bgColor = '#FEE2E2'
    textColor = COLORS.red
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      background: bgColor,
      borderRadius: 8,
      marginBottom: 24,
    }}>
      {status === 'ready' && <Check className="w-5 h-5" style={{ color: textColor }} />}
      {status === 'review' && <AlertTriangle className="w-5 h-5" style={{ color: textColor }} />}
      {status === 'not-ready' && <X className="w-5 h-5" style={{ color: textColor }} />}
      <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{label}</span>
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
    <div style={{
      minHeight: '100%',
      background: COLORS.canvas,
      padding: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.ink,
            margin: 0,
            marginBottom: 4,
          }}>
            Review
          </h1>
          <p style={{
            fontSize: 13,
            color: COLORS.muted,
            margin: 0,
          }}>
            Pre-flight checklist
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.ink,
            background: COLORS.surface,
            border: `0.5px solid ${COLORS.border}`,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Readiness Badge */}
      <ReadinessBadge columns={columns} />

      {/* Three Column Layout */}
      <div style={{
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        {columns.map(col => (
          <ColumnCard key={col.title} {...col} />
        ))}
      </div>
    </div>
  )
}

export default ReviewPage
