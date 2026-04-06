'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { complianceApi, shareLinksApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Loader2,
  Copy,
  Check,
  Link2,
  Trash2,
  Plus,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateBOEDocument, downloadBOE } from '@/lib/boe-export'

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
  id: string
  token: string
  isActive: boolean
  expiresAt: string | null
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  approvalStatus?: string | null
  accountantNote?: string | null
  approvedAt?: string | null
  reviewerEmail?: string | null
  label?: string | null
  linkType?: string | null
}

// ==================== HELPERS ====================

function getLastExported(proposalId: string, type: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`export-${proposalId}-${type}`)
}

function setLastExported(proposalId: string, type: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`export-${proposalId}-${type}`, new Date().toISOString())
}

function formatExportDate(isoString: string | null): string {
  if (!isoString) return 'Never exported'
  const date = new Date(isoString)
  return `Last exported ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

// ==================== SECTION HEADER ====================

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

// ==================== CHECK ITEM ROW ====================

function CheckItemRow({ item }: { item: CheckItem }) {
  const iconMap = {
    pass: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    fail: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    gray: <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />,
  }

  return (
    <div className="flex items-start gap-3 py-3 px-4">
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
  )
}

// ==================== EXPORT CARD ====================

function ExportCard({
  title,
  description,
  buttonLabel,
  isLoading,
  onExport,
  lastExported,
}: {
  title: string
  description: string
  buttonLabel: string
  isLoading: boolean
  onExport: () => void
  lastExported: string | null
}) {
  return (
    <Card className="p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className={`text-xs ${lastExported ? 'text-muted-foreground' : 'text-gray-400'}`}>
          {formatExportDate(lastExported)}
        </span>
        <Button size="sm" onClick={onExport} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {buttonLabel}
        </Button>
      </div>
    </Card>
  )
}

// ==================== MAIN COMPONENT ====================

export function DeliverHub() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    selectedRoles,
    estimateWbsElements,
    extractedRequirements,
    solicitation,
    proposalSetup,
    rateJustifications,
  } = useAppContext()

  // Compliance state
  const [complianceItems, setComplianceItems] = useState<
    { compliance_status: string; requirement_text?: string; section_reference?: string; notes?: string; reference_number?: string }[]
  >([])
  const [complianceStats, setComplianceStats] = useState<{
    total: number
    compliant: number
    partial: number
    exception: number
    not_addressed: number
  }>({ total: 0, compliant: 0, partial: 0, exception: 0, not_addressed: 0 })

  // Share link state
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null)
  const [allLinks, setAllLinks] = useState<ShareLinkData[]>([])
  const [shareLoading, setShareLoading] = useState(true)

  // BOE review form
  const [showSendForm, setShowSendForm] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendLabel, setSendLabel] = useState('')
  const [sendLoading, setSendLoading] = useState(false)

  // Create link dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createLinkType, setCreateLinkType] = useState('accountant')
  const [createLabel, setCreateLabel] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createExpiry, setCreateExpiry] = useState('30')
  const [createLoading, setCreateLoading] = useState(false)

  // Export loading
  const [loadingExport, setLoadingExport] = useState<string | null>(null)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null)

  // Load compliance data
  useEffect(() => {
    if (!proposalId) return
    async function loadCompliance() {
      try {
        const response = await complianceApi.list(proposalId) as {
          items: { compliance_status: string; requirement_text?: string; section_reference?: string; notes?: string; reference_number?: string }[]
          stats: { total: number; compliant: number; partial: number; exception: number; not_addressed?: number }
        }
        setComplianceItems(response.items || [])
        setComplianceStats({
          total: response.stats?.total || 0,
          compliant: response.stats?.compliant || 0,
          partial: response.stats?.partial || 0,
          exception: response.stats?.exception || 0,
          not_addressed: response.stats?.not_addressed || 0,
        })
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
        setShareLink(data.shareLink)
        setAllLinks(data.allLinks || (data.shareLink ? [data.shareLink] : []))
      } catch {
        // Silently fail
      } finally {
        setShareLoading(false)
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
      boeAccountantMessage = 'Corrections requested'
    } else {
      boeAccountantStatus = 'warning'
      boeAccountantMessage = 'Awaiting accountant review'
    }
  }

  const checkItems: CheckItem[] = [
    {
      label: 'Pricing complete',
      status: pricingComplete ? 'pass' : 'fail',
      message: 'Add roles and hours in Roles & Pricing',
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
      status: complianceStats.total === 0
        ? 'warning'
        : complianceAllAddressed
          ? 'pass'
          : 'fail',
      message: complianceStats.total === 0
        ? 'No compliance matrix generated'
        : `${complianceFailCount} compliance items need attention`,
      linkSection: 'scope',
      linkView: 'requirements',
    },
    {
      label: 'Requirements accounted for',
      status: extractedRequirements.length === 0
        ? 'warning'
        : requirementsAllReviewed
          ? 'pass'
          : 'warning',
      message: extractedRequirements.length === 0
        ? 'No requirements extracted'
        : `${unreviewedCount} requirements unreviewed`,
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

  // ==================== EXPORT HANDLERS ====================

  const handleTechnicalVolumeExport = useCallback(async () => {
    if (!proposalId) return
    setLoadingExport('technical-volume')
    try {
      const response = await fetch(`/api/proposals/${proposalId}/export/technical-volume`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }
      const blob = await response.blob()
      const title = solicitation?.title || 'Proposal'
      const filename = `${title}-Technical-Volume-${todayString()}.docx`
      downloadBlob(blob, filename)
      setLastExported(proposalId, 'technical-volume')
      toast.success('Technical Volume downloaded')
    } catch (error) {
      console.error('Technical volume export failed:', error)
      toast.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setLoadingExport(null)
    }
  }, [proposalId, solicitation])

  const handlePricingExport = useCallback(async () => {
    setLoadingExport('pricing-summary')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const fringeRate = 0.2116
      const overheadRate = 0.3426
      const gaRate = 0.1983

      // Sheet 1 - Summary
      const summaryRows = selectedRoles.map((role) => {
        const baseRate = role.hourlyRate || role.baseSalary || 0
        const hours = role.billableHours || role.quantity || 0
        const fringe = baseRate * fringeRate
        const overhead = baseRate * overheadRate
        const ga = baseRate * gaRate
        const loadedRate = baseRate + fringe + overhead + ga
        const totalCost = loadedRate * hours
        return {
          'Role': role.title || role.name,
          'Labor Category': role.laborCategory || role.icLevel || '',
          'Hours': hours,
          'Base Rate': baseRate,
          'Fringe (21.16%)': fringe,
          'Overhead (34.26%)': overhead,
          'G&A (19.83%)': ga,
          'Loaded Rate': loadedRate,
          'Total Cost': totalCost,
        }
      })
      const ws1 = XLSX.utils.json_to_sheet(summaryRows)
      XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

      // Sheet 2 - By Year
      const optionYears = proposalSetup?.optionYears || 0
      const yearLabels = ['Base Year']
      for (let i = 1; i <= optionYears; i++) yearLabels.push(`Option Year ${i}`)

      const byYearRows: Record<string, unknown>[] = []
      selectedRoles.forEach((role) => {
        yearLabels.forEach((yearLabel, idx) => {
          const yearKey = idx === 0 ? 'base' : `option${idx}`
          const isActive = role.years[yearKey as keyof typeof role.years]
          if (!isActive) return
          const baseRate = role.hourlyRate || role.baseSalary || 0
          const escalation = Math.pow(1 + (proposalSetup?.escalationRate || 0.03), idx)
          const adjustedRate = baseRate * escalation
          const hours = role.hoursByYear
            ? role.hoursByYear[idx === 0 ? 'baseYear' : `oy${idx}` as keyof typeof role.hoursByYear] || 0
            : role.billableHours || role.quantity || 0
          const fringe = adjustedRate * fringeRate
          const overhead = adjustedRate * overheadRate
          const ga = adjustedRate * gaRate
          const loadedRate = adjustedRate + fringe + overhead + ga
          byYearRows.push({
            'Year': yearLabel,
            'Role': role.title || role.name,
            'Labor Category': role.laborCategory || role.icLevel || '',
            'Hours': hours,
            'Base Rate': adjustedRate,
            'Fringe (21.16%)': fringe,
            'Overhead (34.26%)': overhead,
            'G&A (19.83%)': ga,
            'Loaded Rate': loadedRate,
            'Total Cost': loadedRate * hours,
          })
        })
      })
      const ws2 = XLSX.utils.json_to_sheet(byYearRows)
      XLSX.utils.book_append_sheet(wb, ws2, 'By Year')

      // Sheet 3 - Indirect Rates
      const indirectRows = [
        { 'Rate Type': 'Fringe', 'Percentage': '21.16%', 'Basis': 'Direct labor' },
        { 'Rate Type': 'Overhead', 'Percentage': '34.26%', 'Basis': 'Direct labor + fringe' },
        { 'Rate Type': 'G&A', 'Percentage': '19.83%', 'Basis': 'Total cost input' },
        { 'Rate Type': '', 'Percentage': '', 'Basis': '' },
        { 'Rate Type': 'Rate basis', 'Percentage': '2,080 hours', 'Basis': '' },
      ]
      const ws3 = XLSX.utils.json_to_sheet(indirectRows)
      XLSX.utils.book_append_sheet(wb, ws3, 'Indirect Rates')

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const title = solicitation?.title || 'Proposal'
      downloadBlob(blob, `${title}-Pricing-Summary-${todayString()}.xlsx`)
      setLastExported(proposalId, 'pricing-summary')
      toast.success('Pricing Summary downloaded')
    } catch (error) {
      console.error('Pricing export failed:', error)
      toast.error('Export failed')
    } finally {
      setLoadingExport(null)
    }
  }, [selectedRoles, solicitation, proposalSetup, proposalId])

  const handleBOEExport = useCallback(async () => {
    setLoadingExport('boe')
    try {
      const wbsElements = (estimateWbsElements || []).map((el) => ({
        id: el.id,
        wbsNumber: el.wbsNumber || '',
        title: el.title || '',
        description: el.description || '',
        sowReference: undefined,
        clin: undefined,
        technicalApproach: '',
        assumptions: [] as string[],
        laborEstimates: (el.laborEstimates || []).map((labor) => ({
          id: labor.id,
          roleId: labor.roleId,
          roleName: labor.roleName || '',
          hoursByPeriod: labor.hoursByPeriod || { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 },
          rationale: labor.rationale || '',
        })),
        risks: [] as Array<{
          id: string; description: string; probability: 1 | 2 | 3 | 4 | 5
          impact: 1 | 2 | 3 | 4 | 5; mitigation: string
          status: 'identified' | 'mitigating' | 'accepted' | 'resolved'
        }>,
        dependencies: [] as Array<{
          id: string; targetWbsId: string
          type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'
          description: string
        }>,
        qualityScore: 0,
      }))

      const requirements = (extractedRequirements || []).map((req) => ({
        id: req.id,
        referenceNumber: req.reference_number || req.id,
        title: req.title || '',
        description: req.description || req.text || '',
        type: (req.type?.toLowerCase() === 'shall' ? 'shall' :
          req.type?.toLowerCase() === 'should' ? 'should' :
          req.type?.toLowerCase() === 'will' ? 'will' : 'may') as 'shall' | 'should' | 'will' | 'may',
        linkedWbsIds: [] as string[],
      }))

      const contractPeriods = [
        { key: 'base' as const, label: 'Base' },
        { key: 'option1' as const, label: 'Option 1' },
        { key: 'option2' as const, label: 'Option 2' },
        { key: 'option3' as const, label: 'Option 3' },
        { key: 'option4' as const, label: 'Option 4' },
      ]

      const blob = await generateBOEDocument({
        wbsElements,
        requirements,
        contractPeriods,
        contractTitle: solicitation?.title || 'Government Contract',
        companyName: 'Friends From The City, LLC',
        rfpNumber: solicitation?.solicitationNumber || 'TBD',
      })

      const title = solicitation?.title || 'Proposal'
      downloadBOE(blob, `${title}-BOE-${todayString()}.pdf`)
      setLastExported(proposalId, 'boe')
      toast.success('BOE downloaded')
    } catch (error) {
      console.error('BOE export failed:', error)
      toast.error('Export failed')
    } finally {
      setLoadingExport(null)
    }
  }, [estimateWbsElements, extractedRequirements, solicitation, proposalId])

  const handleComplianceExport = useCallback(async () => {
    setLoadingExport('compliance-matrix')
    try {
      // Use pdfmake for PDF generation
      const pdfMakeModule = await import('pdfmake/build/pdfmake')
      const pdfFontsModule = await import('pdfmake/build/vfs_fonts')
      const pdfMake = pdfMakeModule.default || pdfMakeModule
       
      const fontsModule = pdfFontsModule as any
      if (fontsModule.pdfMake?.vfs) {
        pdfMake.vfs = fontsModule.pdfMake.vfs
      } else if (fontsModule.default?.pdfMake?.vfs) {
        pdfMake.vfs = fontsModule.default.pdfMake.vfs
      } else if (fontsModule.vfs) {
        pdfMake.vfs = fontsModule.vfs
      }

      const statusColors: Record<string, string> = {
        compliant: '#16a34a',
        partial: '#d97706',
        exception: '#2563eb',
        not_addressed: '#dc2626',
      }

      const tableBody = [
        [
          { text: 'Ref', bold: true, fillColor: '#f3f4f6' },
          { text: 'Requirement', bold: true, fillColor: '#f3f4f6' },
          { text: 'Section', bold: true, fillColor: '#f3f4f6' },
          { text: 'Status', bold: true, fillColor: '#f3f4f6' },
          { text: 'Notes', bold: true, fillColor: '#f3f4f6' },
        ],
        ...complianceItems.map((item) => [
          { text: item.reference_number || '', fontSize: 9 },
          { text: item.requirement_text || '', fontSize: 9 },
          { text: item.section_reference || '', fontSize: 9 },
          {
            text: (item.compliance_status || 'not_addressed').replace('_', ' '),
            fontSize: 9,
            color: statusColors[item.compliance_status] || '#6b7280',
          },
          { text: item.notes || '', fontSize: 9 },
        ]),
      ]

      const docDefinition = {
        pageOrientation: 'landscape' as const,
        content: [
          { text: 'Compliance Matrix', style: 'header' },
          { text: solicitation?.title || 'Proposal', style: 'subheader' },
          { text: ' ' },
          {
            table: {
              headerRows: 1,
              widths: [60, '*', 80, 80, '*'],
              body: tableBody,
            },
            layout: 'lightHorizontalLines',
          },
        ],
        styles: {
          header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] as [number, number, number, number] },
          subheader: { fontSize: 11, color: '#6b7280', margin: [0, 0, 0, 8] as [number, number, number, number] },
        },
      }

      pdfMake.createPdf(docDefinition).download(
        `${solicitation?.title || 'Proposal'}-Compliance-Matrix-${todayString()}.pdf`
      )

      setLastExported(proposalId, 'compliance-matrix')
      toast.success('Compliance Matrix downloaded')
    } catch (error) {
      console.error('Compliance matrix export failed:', error)
      toast.error('Export failed')
    } finally {
      setLoadingExport(null)
    }
  }, [complianceItems, solicitation, proposalId])

  // ==================== SHARE HANDLERS ====================

  const handleSendBOEForReview = async () => {
    if (!sendEmail.trim()) return
    setSendLoading(true)
    try {
      const data = await shareLinksApi.create(proposalId, {
        expiresInDays: 30,
        reviewerEmail: sendEmail.trim(),
        label: sendLabel.trim() || undefined,
        linkType: 'accountant',
      }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      setAllLinks((prev) => [...prev, data.shareLink])
      setShowSendForm(false)
      setSendEmail('')
      setSendLabel('')
      toast.success('BOE review link created')
    } catch (error) {
      console.error('Failed to create review link:', error)
      toast.error('Failed to create review link')
    } finally {
      setSendLoading(false)
    }
  }

  const handleCreateLink = async () => {
    if (!createEmail.trim()) return
    setCreateLoading(true)
    try {
      const expiryDays = createExpiry === 'none' ? 9999 : Number(createExpiry)
      const data = await shareLinksApi.create(proposalId, {
        expiresInDays: expiryDays,
        reviewerEmail: createEmail.trim(),
        label: createLabel.trim() || undefined,
        linkType: createLinkType,
      }) as { shareLink: ShareLinkData }
      setAllLinks((prev) => [...prev, data.shareLink])
      setShowCreateDialog(false)
      setCreateEmail('')
      setCreateLabel('')
      toast.success('Link created')
    } catch (error) {
      console.error('Failed to create link:', error)
      toast.error('Failed to create link')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCopyLink = async (token: string, linkId: string) => {
    const url = `${window.location.origin}/boe/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(linkId)
      toast.success('Link copied')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    try {
      await shareLinksApi.delete(proposalId)
      setAllLinks((prev) => prev.filter((l) => l.id !== linkId))
      if (shareLink?.id === linkId) setShareLink(null)
      setRevokeId(null)
      toast.success('Link revoked')
    } catch {
      toast.error('Failed to revoke link')
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* ====== SECTION 1: READINESS ====== */}
        <section className="space-y-4">
          <SectionHeader title="Readiness" subtitle="Verify before you export" />

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

          <Card className="p-0 divide-y divide-gray-100">
            {checkItems.map((item) => (
              <CheckItemRow key={item.label} item={item} />
            ))}
          </Card>
        </section>

        {/* ====== SECTION 2: EXPORT ====== */}
        <section className="space-y-4">
          <SectionHeader title="Export" subtitle="Download your proposal package" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExportCard
              title="Technical Volume"
              description="Word document with all proposal sections. H1-H4 heading styles for InDesign."
              buttonLabel="Download .docx"
              isLoading={loadingExport === 'technical-volume'}
              onExport={handleTechnicalVolumeExport}
              lastExported={getLastExported(proposalId, 'technical-volume')}
            />
            <ExportCard
              title="Pricing Summary"
              description="Excel reference for completing the government pricing template. Varies per contract."
              buttonLabel="Download .xlsx"
              isLoading={loadingExport === 'pricing-summary'}
              onExport={handlePricingExport}
              lastExported={getLastExported(proposalId, 'pricing-summary')}
            />
            <ExportCard
              title="Basis of Estimate"
              description="PDF of the complete Basis of Estimate."
              buttonLabel="Download PDF"
              isLoading={loadingExport === 'boe'}
              onExport={handleBOEExport}
              lastExported={getLastExported(proposalId, 'boe')}
            />
            <ExportCard
              title="Compliance Matrix"
              description="PDF table of all compliance requirements and their status. Include as an attachment if required."
              buttonLabel="Download PDF"
              isLoading={loadingExport === 'compliance-matrix'}
              onExport={handleComplianceExport}
              lastExported={getLastExported(proposalId, 'compliance-matrix')}
            />
          </div>
        </section>

        {/* ====== SECTION 3: SHARE ====== */}
        <section className="space-y-6">
          <SectionHeader title="Share" subtitle="Manage access to this proposal" />

          {/* Sub-section A: BOE Accountant Review */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">BOE Accountant Review</h3>

            <Card className="p-6">
              {shareLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !accountantLink ? (
                /* STATE 1: No link sent yet */
                <div>
                  {!showSendForm ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Send the BOE to your accountant for review before finalizing.
                      </p>
                      <Button size="sm" onClick={() => setShowSendForm(true)}>
                        <Send className="w-4 h-4 mr-2" />
                        Send BOE for Review
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          type="email"
                          placeholder="accountant@example.com"
                          value={sendEmail}
                          onChange={(e) => setSendEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Label (optional)</label>
                        <Input
                          placeholder="e.g., Q2 Rate Review"
                          value={sendLabel}
                          onChange={(e) => setSendLabel(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSendBOEForReview} disabled={sendLoading || !sendEmail.trim()}>
                          {sendLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Send Link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowSendForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : accountantLink.approvalStatus === 'approved' ? (
                /* STATE 4: Approved */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                    <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">
                    Approved
                  </span>
                  {accountantLink.approvedAt && (
                    <p className="text-xs text-muted-foreground">Approved on {formatDate(accountantLink.approvedAt)}</p>
                  )}
                </div>
              ) : accountantLink.approvalStatus === 'corrections_requested' ? (
                /* STATE 3: Corrections requested */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                    <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">
                    Corrections requested
                  </span>
                  {accountantLink.accountantNote && (
                    <div className="bg-amber-50 rounded p-3 text-sm text-amber-800">
                      {accountantLink.accountantNote}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                      {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copy link
                    </Button>
                    <Button size="sm" variant="outline">Resend</Button>
                  </div>
                </div>
              ) : (
                /* STATE 2: Awaiting response */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                    <span className="text-xs text-muted-foreground">&mdash; Sent {formatDate(accountantLink.createdAt)}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">
                    Awaiting review
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                      {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copy link
                    </Button>
                    <Button size="sm" variant="outline">Resend</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Sub-section B: Active Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Active Links</h3>
              <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create Link
              </Button>
            </div>

            {allLinks.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No links created yet"
                description="Create a shareable link to let others view your proposal documents."
              />
            ) : (
              <Card className="p-0 divide-y divide-gray-100">
                {/* Table header */}
                <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50 rounded-t-lg">
                  <span>Type</span>
                  <span>Label</span>
                  <span>Sent To</span>
                  <span>Created</span>
                  <span>Last Accessed</span>
                  <span>Actions</span>
                </div>
                {/* Table rows */}
                {allLinks.map((link) => (
                  <div key={link.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center text-sm">
                    <span>
                      {link.linkType === 'director' ? (
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">Director</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">Accountant</span>
                      )}
                    </span>
                    <span className="text-gray-700 truncate">{link.label || '—'}</span>
                    <span className="text-gray-700 truncate">{link.reviewerEmail || '—'}</span>
                    <span className="text-muted-foreground text-xs">{formatDate(link.createdAt)}</span>
                    <span className="text-muted-foreground text-xs">
                      {link.lastViewedAt ? formatDate(link.lastViewedAt) : 'Never'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(link.token, link.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title="Copy link"
                      >
                        {copiedId === link.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {revokeId === link.id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRevokeLink(link.id)}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRevokeId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevokeId(link.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Revoke link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </section>

        {/* Create Link Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Link</DialogTitle>
              <DialogDescription>
                Create a shareable link for external reviewers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Link Type</label>
                <Select value={createLinkType} onValueChange={setCreateLinkType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  placeholder="e.g., Q2 Review"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Send To</label>
                <Input
                  type="email"
                  placeholder="reviewer@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry</label>
                <Select value={createExpiry} onValueChange={setCreateExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="none">No expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={createLoading || !createEmail.trim()}>
                {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
