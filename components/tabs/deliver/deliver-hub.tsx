'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { complianceApi, shareLinksApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  Download,
  Share2,
  ArrowRight,
} from 'lucide-react'

// ==================== TYPES ====================

type CheckStatus = 'pass' | 'warning' | 'fail' | 'gray'

interface CheckItem {
  label: string
  status: CheckStatus
}

interface ShareLinkData {
  approvalStatus?: string | null
  approvedAt?: string | null
  reviewerEmail?: string | null
  linkType?: string | null
}

// ==================== MAIN COMPONENT ====================

export function DeliverHub({ onNavigate }: { onNavigate?: (viewId: string) => void }) {
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
  const [complianceStats, setComplianceStats] = useState<{ total: number }>({ total: 0 })

  // Share link state
  const [allLinks, setAllLinks] = useState<ShareLinkData[]>([])

  // Load compliance data
  useEffect(() => {
    if (!proposalId) return
    async function loadCompliance() {
      try {
        const response = await complianceApi.list(proposalId) as {
          items: { compliance_status: string }[]
          stats: { total: number }
        }
        setComplianceItems(response.items || [])
        setComplianceStats({ total: response.stats?.total || 0 })
      } catch {
        // Silently fail
      }
    }
    loadCompliance()
  }, [proposalId])

  // Load share links
  useEffect(() => {
    if (!proposalId) return
    async function loadLinks() {
      try {
        const data = await shareLinksApi.get(proposalId) as {
          shareLink: ShareLinkData | null
          allLinks?: ShareLinkData[]
        }
        setAllLinks(data.allLinks || (data.shareLink ? [data.shareLink] : []))
      } catch {
        // Silently fail
      }
    }
    loadLinks()
  }, [proposalId])

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
  const requirementsAllReviewed = extractedRequirements.length > 0 &&
    extractedRequirements.every((r) => r.type !== null && r.type !== undefined)

  // BOE accountant check
  const accountantLink = allLinks.find(
    (l) => l.linkType === 'accountant' || (!l.linkType && l.reviewerEmail)
  )
  let boeAccountantStatus: CheckStatus = 'gray'
  if (accountantLink) {
    boeAccountantStatus = accountantLink.approvalStatus === 'approved' ? 'pass' :
      accountantLink.approvalStatus === 'corrections_requested' ? 'warning' : 'warning'
  }

  const checkItems: CheckItem[] = [
    { label: 'Pricing complete', status: pricingComplete ? 'pass' : 'fail' },
    { label: 'BOE complete', status: boeComplete ? 'pass' : 'warning' },
    { label: 'Rate justification noted', status: hasRateJustification ? 'pass' : 'warning' },
    {
      label: 'Compliance items addressed',
      status: complianceStats.total === 0 ? 'warning' : complianceAllAddressed ? 'pass' : 'fail',
    },
    {
      label: 'Requirements accounted for',
      status: extractedRequirements.length === 0 ? 'warning' : requirementsAllReviewed ? 'pass' : 'warning',
    },
    { label: 'BOE approved by accountant', status: boeAccountantStatus },
  ]

  const failCount = checkItems.filter((i) => i.status === 'fail').length
  const warningCount = checkItems.filter((i) => i.status === 'warning').length
  const allPass = failCount === 0 && warningCount === 0

  const iconMap = {
    pass: <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    fail: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    gray: <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />,
  }

  // ==================== RENDER ====================

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Deliver</h2>
          <p className="text-sm text-muted-foreground mt-1">Package and send your proposal</p>
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

        {/* Compact checklist */}
        <Card className="p-0 divide-y divide-gray-100">
          {checkItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-2.5 px-4">
              {iconMap[item.status]}
              <span className="text-sm text-gray-900">{item.label}</span>
            </div>
          ))}
        </Card>

        {/* Quick-action cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Review</h3>
            <p className="text-sm text-muted-foreground flex-1">Check all items before submitting</p>
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onNavigate?.('deliver-review')}
            >
              Go to Review <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Download className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Export</h3>
            <p className="text-sm text-muted-foreground flex-1">Download your proposal package</p>
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onNavigate?.('deliver-export')}
            >
              Go to Export <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Share</h3>
            <p className="text-sm text-muted-foreground flex-1">Manage access and send for review</p>
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onNavigate?.('deliver-share')}
            >
              Go to Share <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
