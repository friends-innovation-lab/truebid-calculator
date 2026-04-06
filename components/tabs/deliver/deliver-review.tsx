'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { complianceApi, shareLinksApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'

// ==================== TYPES ====================

type CheckStatus = 'pass' | 'warning' | 'fail' | 'gray'

interface CheckItem {
  label: string
  status: CheckStatus
  message: string
  linkView?: string
  linkSection?: string
}

interface ShareLinkData {
  approvalStatus?: string | null
  approvedAt?: string | null
  accountantNote?: string | null
  reviewerEmail?: string | null
  linkType?: string | null
}

// ==================== HELPERS ====================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== MAIN COMPONENT ====================

export function DeliverReview() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    selectedRoles,
    estimateWbsElements,
    extractedRequirements,
    rateJustifications,
  } = useAppContext()

  // Compliance state
  const [complianceItems, setComplianceItems] = useState<{ compliance_status: string }[]>([])
  const [complianceStats, setComplianceStats] = useState<{
    total: number; compliant: number; partial: number; exception: number; not_addressed: number
  }>({ total: 0, compliant: 0, partial: 0, exception: 0, not_addressed: 0 })

  // Share link state
  const [allLinks, setAllLinks] = useState<ShareLinkData[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (!proposalId) return
    setRefreshing(true)
    try {
      const [compResponse, linkResponse] = await Promise.all([
        complianceApi.list(proposalId) as Promise<{
          items: { compliance_status: string }[]
          stats: { total: number; compliant: number; partial: number; exception: number; not_addressed?: number }
        }>,
        shareLinksApi.get(proposalId) as Promise<{
          shareLink: ShareLinkData | null
          allLinks?: ShareLinkData[]
        }>,
      ])

      setComplianceItems(compResponse.items || [])
      setComplianceStats({
        total: compResponse.stats?.total || 0,
        compliant: compResponse.stats?.compliant || 0,
        partial: compResponse.stats?.partial || 0,
        exception: compResponse.stats?.exception || 0,
        not_addressed: compResponse.stats?.not_addressed || 0,
      })

      setAllLinks(linkResponse.allLinks || (linkResponse.shareLink ? [linkResponse.shareLink] : []))
    } catch {
      // Silently fail
    } finally {
      setRefreshing(false)
    }
  }, [proposalId])

  useEffect(() => { loadData() }, [loadData])

  // ==================== READINESS CHECKS ====================

  const pricingComplete = selectedRoles.some(
    (r) => (r.billableHours || r.quantity || 0) > 0 && (r.baseSalary || r.hourlyRate || 0) > 0
  )

  const boeComplete = estimateWbsElements.length > 0

  const hasRateJustification = Object.values(rateJustifications || {}).some(
    (j) => j && typeof j === 'object' && ('narrative' in j ? Boolean((j as { narrative?: string }).narrative) : false)
  )

  const complianceAllAddressed = complianceStats.total > 0 &&
    complianceItems.every((item) => {
      const s = item.compliance_status
      return s === 'compliant' || s === 'exception' || s === 'na' || s === 'not_applicable'
    })
  const complianceFailCount = complianceItems.filter((item) => {
    const s = item.compliance_status
    return s === 'partial' || s === 'not_addressed' || s === '' || s === null
  }).length

  const requirementsAllReviewed = extractedRequirements.length > 0 &&
    extractedRequirements.every((r) => r.type !== null && r.type !== undefined)
  const unreviewedCount = extractedRequirements.filter(
    (r) => r.type === null || r.type === undefined
  ).length

  // BOE accountant check
  const accountantLink = allLinks.find(
    (l) => l.linkType === 'accountant' || (!l.linkType && l.reviewerEmail)
  )
  let boeAccountantStatus: CheckStatus = 'gray'
  let boeAccountantMessage = 'Not sent for review'
  if (accountantLink) {
    if (accountantLink.approvalStatus === 'approved') {
      boeAccountantStatus = 'pass'
      boeAccountantMessage = `Approved${accountantLink.approvedAt ? ` on ${formatDate(accountantLink.approvedAt)}` : ''}`
    } else if (accountantLink.approvalStatus === 'corrections_requested') {
      boeAccountantStatus = 'warning'
      boeAccountantMessage = `Corrections requested${accountantLink.accountantNote ? ` — ${accountantLink.accountantNote}` : ''}`
    } else {
      boeAccountantStatus = 'warning'
      boeAccountantMessage = 'Awaiting accountant review'
    }
  }

  const checkItems: CheckItem[] = [
    {
      label: 'Pricing complete',
      status: pricingComplete ? 'pass' : 'fail',
      message: 'Add roles and hours in Roles and Pricing',
      linkSection: 'staff',
      linkView: 'roles-pricing',
    },
    {
      label: 'BOE complete',
      status: boeComplete ? 'pass' : 'warning',
      message: 'BOE not completed',
      linkSection: 'staff',
      linkView: 'wbs-elements',
    },
    {
      label: 'Rate justification noted',
      status: hasRateJustification ? 'pass' : 'warning',
      message: 'Rate justification is empty',
      linkView: 'rate-justification',
    },
    {
      label: 'Compliance items addressed',
      status: complianceStats.total === 0 ? 'warning' : complianceAllAddressed ? 'pass' : 'fail',
      message: complianceStats.total === 0 ? 'No compliance matrix generated' : `${complianceFailCount} compliance items need attention`,
      linkSection: 'scope',
      linkView: 'requirements',
    },
    {
      label: 'Requirements accounted for',
      status: extractedRequirements.length === 0 ? 'warning' : requirementsAllReviewed ? 'pass' : 'warning',
      message: extractedRequirements.length === 0 ? 'No requirements extracted' : `${unreviewedCount} requirements unreviewed`,
      linkSection: 'scope',
      linkView: 'requirements',
    },
    {
      label: 'BOE approved by accountant',
      status: boeAccountantStatus,
      message: boeAccountantMessage,
    },
  ]

  const failCount = checkItems.filter((i) => i.status === 'fail').length
  const warningCount = checkItems.filter((i) => i.status === 'warning').length
  const allPass = failCount === 0 && warningCount === 0

  const iconMap = {
    pass: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    fail: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    gray: <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />,
  }

  // ==================== RENDER ====================

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Review</h2>
            <p className="text-sm text-muted-foreground mt-1">Pre-flight checklist</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            Refresh
          </Button>
        </div>

        {/* Readiness badge */}
        {allPass ? (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
            Ready to submit
          </div>
        ) : failCount > 0 ? (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            Not ready &mdash; {failCount} item{failCount !== 1 ? 's' : ''} need attention
          </div>
        ) : (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Review incomplete items
          </div>
        )}

        {/* Check items */}
        <Card className="p-0 divide-y divide-gray-100">
          {checkItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3 py-3 px-4">
              {iconMap[item.status]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                {item.status !== 'pass' && item.message && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
                )}
              </div>
              {item.status === 'pass' && (
                <span className="text-xs text-green-600 font-medium shrink-0">Pass</span>
              )}
              {item.status === 'warning' && (
                <span className="text-xs text-amber-600 font-medium shrink-0">Warning</span>
              )}
              {item.status === 'fail' && (
                <span className="text-xs text-red-600 font-medium shrink-0">Fail</span>
              )}
              {item.status === 'gray' && (
                <span className="text-xs text-gray-400 font-medium shrink-0">{item.message}</span>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
