'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { complianceApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Download, Loader2, Sparkles, Check, Minus, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateBOEDocument, downloadBOE } from '@/lib/boe-export'

// ==================== TYPES ====================

interface ProposalSection {
  id: string
  title: string
  content: string
  sectionNumber: string | null
}

interface TransformResult {
  sectionId: string
  title: string
  original: string
  transformed: string
  approved: boolean
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
          {isLoading ? 'Generating...' : buttonLabel}
        </Button>
      </div>
    </Card>
  )
}

// ==================== MAIN COMPONENT ====================

export function DeliverExport() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    selectedRoles,
    estimateWbsElements,
    extractedRequirements,
    solicitation,
    proposalSetup,
    outline,
    sectionContent,
    setSectionContent,
  } = useAppContext()

  // Compliance items for export
  const [complianceItems, setComplianceItems] = useState<
    { compliance_status: string; requirement_text?: string; section_reference?: string; notes?: string; reference_number?: string }[]
  >([])

  const [loadingExport, setLoadingExport] = useState<string | null>(null)

  // Proposal sections for voice transform
  const [proposalSections, setProposalSections] = useState<ProposalSection[]>([])

  // Voice transform state
  const [isTransforming, setIsTransforming] = useState(false)
  const [transformProgress, setTransformProgress] = useState('')
  const [transformPct, setTransformPct] = useState(0)
  const [transformResults, setTransformResults] = useState<TransformResult[]>([])
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Load compliance data
  useEffect(() => {
    if (!proposalId) return
    async function loadCompliance() {
      try {
        const response = await complianceApi.list(proposalId) as {
          items: { compliance_status: string; requirement_text?: string; section_reference?: string; notes?: string; reference_number?: string }[]
        }
        setComplianceItems(response.items || [])
      } catch {
        // Silently fail
      }
    }
    loadCompliance()
  }, [proposalId])

  // Build proposal sections from outline + sectionContent
  useEffect(() => {
    if (!outline?.volumes) {
      setProposalSections([])
      return
    }

    const sections: ProposalSection[] = []
    outline.volumes.forEach((volume) => {
      volume.sections.forEach((section) => {
        const content = sectionContent[section.id]?.content
        if (content && content.trim().length > 0) {
          sections.push({
            id: section.id,
            title: section.title,
            content: content,
            sectionNumber: section.number || null,
          })
        }
      })
    })

    setProposalSections(sections)
  }, [outline, sectionContent])

  // ==================== VOICE TRANSFORM HANDLER ====================

  const handlePreflightTransform = useCallback(async () => {
    if (proposalSections.length === 0) {
      toast.error('No sections to transform. Create content in Write → Proposal Outline first.')
      return
    }

    setIsTransforming(true)
    setTransformResults([])
    setTransformPct(0)

    const results: TransformResult[] = []

    for (let i = 0; i < proposalSections.length; i++) {
      const section = proposalSections[i]
      setTransformProgress(`Transforming ${section.title} (${i + 1} of ${proposalSections.length})`)
      setTransformPct(((i + 1) / proposalSections.length) * 100)

      try {
        const res = await fetch(`/api/proposals/${proposalId}/transform-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId: section.id,
            content: section.content,
          }),
        })

        if (res.ok) {
          const { transformed } = await res.json()
          results.push({
            sectionId: section.id,
            title: section.title,
            original: section.content,
            transformed,
            approved: false,
          })
        } else {
          // If transform fails, include original as both
          results.push({
            sectionId: section.id,
            title: section.title,
            original: section.content,
            transformed: section.content,
            approved: false,
          })
        }
      } catch {
        // On error, include original
        results.push({
          sectionId: section.id,
          title: section.title,
          original: section.content,
          transformed: section.content,
          approved: false,
        })
      }
    }

    setTransformResults(results)
    setIsTransforming(false)
    setTransformProgress('')
    setShowReviewModal(true)
  }, [proposalId, proposalSections])

  const handleToggleApproval = (sectionId: string) => {
    setTransformResults((prev) =>
      prev.map((r) => (r.sectionId === sectionId ? { ...r, approved: !r.approved } : r))
    )
  }

  const handleUpdateTransformed = (sectionId: string, newContent: string) => {
    setTransformResults((prev) =>
      prev.map((r) => (r.sectionId === sectionId ? { ...r, transformed: newContent } : r))
    )
  }

  const handleApplyApproved = useCallback(() => {
    const approved = transformResults.filter((r) => r.approved)
    if (approved.length === 0) {
      toast.error('No sections approved. Approve at least one section to apply changes.')
      return
    }

    // Update sectionContent in app context
    setSectionContent((prev) => {
      const updated = { ...prev }
      for (const result of approved) {
        if (updated[result.sectionId]) {
          updated[result.sectionId] = {
            ...updated[result.sectionId],
            content: result.transformed,
            wordCount: result.transformed.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length,
            lastSaved: new Date().toISOString(),
          }
        }
      }
      return updated
    })

    toast.success(`Applied voice changes to ${approved.length} section${approved.length === 1 ? '' : 's'}`)
    setShowReviewModal(false)
    setTransformResults([])
  }, [transformResults, setSectionContent])

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
      downloadBlob(blob, `${title}-Technical-Volume-${todayString()}.docx`)
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

  // ==================== RENDER ====================

  const approvedCount = transformResults.filter((r) => r.approved).length

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Export</h2>
          <p className="text-sm text-muted-foreground mt-1">Download your proposal package</p>
        </div>

        {/* Pre-flight Voice Check Banner */}
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Pre-flight voice check</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Transform all sections to FFTC voice before exporting. Review and approve per section.
              </p>
            </div>
            <Button
              onClick={handlePreflightTransform}
              disabled={isTransforming || proposalSections.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 ml-4"
            >
              {isTransforming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transforming...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run voice check
                </>
              )}
            </Button>
          </div>
          {transformProgress && (
            <div className="mt-3">
              <div className="text-xs text-amber-700 mb-1">{transformProgress}</div>
              <div className="w-full h-1 bg-amber-200 rounded">
                <div
                  className="h-1 bg-amber-600 rounded transition-all"
                  style={{ width: `${transformPct}%` }}
                />
              </div>
            </div>
          )}
          {proposalSections.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              No sections with content found. Create content in Write → Proposal Outline first.
            </p>
          )}
        </Card>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExportCard
            title="Technical Volume"
            description="Word document ready for InDesign. H1-H4 heading styles applied."
            buttonLabel="Download .docx"
            isLoading={loadingExport === 'technical-volume'}
            onExport={handleTechnicalVolumeExport}
            lastExported={getLastExported(proposalId, 'technical-volume')}
          />
          <ExportCard
            title="Pricing Summary"
            description="Excel reference for the government pricing template. Template varies per contract."
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
            description="PDF table of all compliance requirements. Include as an attachment if required."
            buttonLabel="Download PDF"
            isLoading={loadingExport === 'compliance-matrix'}
            onExport={handleComplianceExport}
            lastExported={getLastExported(proposalId, 'compliance-matrix')}
          />
        </div>
      </div>

      {/* Voice Transform Review Modal */}
      {showReviewModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowReviewModal(false)}
          />
          <div className="fixed inset-4 bg-white z-50 flex flex-col rounded-lg shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Review Voice Transforms</h3>
                <p className="text-sm text-muted-foreground">
                  Compare original and transformed content. Approve sections to apply changes.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowReviewModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {transformResults.map((result) => (
                <Card key={result.sectionId} className="p-0 overflow-hidden">
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-900">{result.title}</h4>
                    <div className="flex items-center gap-2">
                      {result.approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          <Minus className="w-3 h-3" />
                          Skipped
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant={result.approved ? 'outline' : 'default'}
                        onClick={() => handleToggleApproval(result.sectionId)}
                        className="h-7 text-xs"
                      >
                        {result.approved ? 'Skip' : 'Approve'}
                      </Button>
                    </div>
                  </div>

                  {/* Side-by-side Content */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    {/* Original */}
                    <div className="p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
                      <div
                        className="prose prose-sm max-w-none text-gray-700 max-h-64 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: result.original }}
                      />
                    </div>

                    {/* Transformed */}
                    <div className="p-4 bg-amber-50/30">
                      <p className="text-xs font-medium text-amber-700 mb-2">FFTC Voice</p>
                      <Textarea
                        value={result.transformed}
                        onChange={(e) => handleUpdateTransformed(result.sectionId, e.target.value)}
                        className="min-h-[200px] max-h-64 text-sm bg-white"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <p className="text-sm text-muted-foreground">
                {approvedCount} of {transformResults.length} section{transformResults.length === 1 ? '' : 's'} approved
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyApproved}
                  disabled={approvedCount === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply {approvedCount} approved change{approvedCount === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
