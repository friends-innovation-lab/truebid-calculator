'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Table, FileCheck, Download, Loader2 } from 'lucide-react'
import { generateBOEDocument, downloadBOE } from '@/lib/boe-export'

// ==================== TYPES ====================

interface ExportCardData {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  format: string
  storageKey: string
  onExport: () => Promise<void>
}

// ==================== HELPER FUNCTIONS ====================

function getLastExported(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`export_${key}_last`)
}

function setLastExported(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`export_${key}_last`, new Date().toISOString())
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'Never exported'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// ==================== EXPORT CARD COMPONENT ====================

function ExportCardComponent({
  card,
  isLoading,
  onExport
}: {
  card: ExportCardData
  isLoading: boolean
  onExport: () => void
}) {
  const lastExported = getLastExported(card.storageKey)

  return (
    <Card className="p-6 flex flex-col gap-4">
      {/* Icon and title */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          {card.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
          <Badge variant="secondary" className="text-xs mt-1">
            {card.format}
          </Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground flex-1">
        {card.description}
      </p>

      {/* Footer: timestamp and button */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(lastExported)}
        </span>
        <Button size="sm" onClick={onExport} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download
        </Button>
      </div>
    </Card>
  )
}

// ==================== MAIN COMPONENT ====================

export function ExportPage() {
  const params = useParams()
  const proposalId = params.id as string

  const {
    solicitation,
    selectedRoles,
    extractedRequirements,
    estimateWbsElements,
  } = useAppContext()

  const [loadingCard, setLoadingCard] = useState<string | null>(null)

  // ==================== EXPORT HANDLERS ====================

  const handleTechnicalVolumeExport = useCallback(async () => {
    if (!proposalId) return

    setLoadingCard('technical-volume')
    try {
      const response = await fetch(`/api/proposals/${proposalId}/export/technical-volume`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      const blob = await response.blob()
      const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'Technical-Volume.docx'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLastExported('technical-volume')
    } catch (error) {
      console.error('Technical volume export failed:', error)
      alert(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setLoadingCard(null)
    }
  }, [proposalId])

  const handlePricingSummaryExport = useCallback(async () => {
    setLoadingCard('pricing-summary')
    try {
      // Build CSV data
      const headers = ['Role', 'Labor Category', 'Quantity', 'Hours', 'Rate', 'Total']
      const rows = selectedRoles.map(role => {
        const hours = role.quantity || 0
        const rate = role.baseSalary || 0
        const total = hours * rate
        return [
          role.title || role.name || '',
          role.icLevel || '',
          String(role.quantity || 0),
          String(hours),
          `$${rate.toFixed(2)}`,
          `$${total.toFixed(2)}`,
        ]
      })

      // Calculate totals
      const totalHours = selectedRoles.reduce((sum, r) => sum + (r.quantity || 0), 0)
      const totalCost = selectedRoles.reduce((sum, r) => sum + ((r.quantity || 0) * (r.baseSalary || 0)), 0)
      rows.push(['', '', '', String(totalHours), 'Total:', `$${totalCost.toFixed(2)}`])

      // Generate CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const filename = `${solicitation?.solicitationNumber || 'Proposal'}-Pricing-Summary.csv`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLastExported('pricing-summary')
    } catch (error) {
      console.error('Pricing summary export failed:', error)
      alert('Export failed')
    } finally {
      setLoadingCard(null)
    }
  }, [selectedRoles, solicitation])

  const handleBOEExport = useCallback(async () => {
    setLoadingCard('boe')
    try {
      // Map WBS elements to BOE format (providing defaults for missing fields)
      const wbsElements = (estimateWbsElements || []).map(el => ({
        id: el.id,
        wbsNumber: el.wbsNumber || '',
        title: el.title || '',
        description: el.description || '',
        sowReference: undefined,
        clin: undefined,
        technicalApproach: '',
        assumptions: [] as string[],
        laborEstimates: (el.laborEstimates || []).map(labor => ({
          id: labor.id,
          roleId: labor.roleId,
          roleName: labor.roleName || '',
          hoursByPeriod: labor.hoursByPeriod || { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 },
          rationale: labor.rationale || '',
        })),
        risks: [] as Array<{
          id: string
          description: string
          probability: 1 | 2 | 3 | 4 | 5
          impact: 1 | 2 | 3 | 4 | 5
          mitigation: string
          status: 'identified' | 'mitigating' | 'accepted' | 'resolved'
        }>,
        dependencies: [] as Array<{
          id: string
          targetWbsId: string
          type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'
          description: string
        }>,
        qualityScore: 0,
      }))

      // Get requirements mapped
      const requirements = (extractedRequirements || []).map(req => ({
        id: req.id,
        referenceNumber: req.reference_number || req.id,
        title: req.title || '',
        description: req.description || req.text || '',
        type: (req.type?.toLowerCase() === 'shall' ? 'shall' :
               req.type?.toLowerCase() === 'should' ? 'should' :
               req.type?.toLowerCase() === 'will' ? 'will' : 'may') as 'shall' | 'should' | 'will' | 'may',
        linkedWbsIds: [] as string[],
      }))

      // Contract periods
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

      const filename = `${solicitation?.solicitationNumber || 'Proposal'}-BOE.docx`
      downloadBOE(blob, filename)

      setLastExported('boe')
    } catch (error) {
      console.error('BOE export failed:', error)
      alert('Export failed')
    } finally {
      setLoadingCard(null)
    }
  }, [estimateWbsElements, extractedRequirements, solicitation])

  const handleComplianceMatrixExport = useCallback(async () => {
    setLoadingCard('compliance-matrix')
    try {
      // Build CSV from extracted requirements
      const headers = ['Reference', 'Type', 'Requirement', 'Source Section', 'Status']
      const rows = (extractedRequirements || []).map(req => [
        req.reference_number || req.id || '',
        req.type || '',
        req.title || req.text || '',
        req.sourceSection || '',
        'Pending Review',
      ])

      // Generate CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const filename = `${solicitation?.solicitationNumber || 'Proposal'}-Compliance-Matrix.csv`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLastExported('compliance-matrix')
    } catch (error) {
      console.error('Compliance matrix export failed:', error)
      alert('Export failed')
    } finally {
      setLoadingCard(null)
    }
  }, [extractedRequirements, solicitation])

  // ==================== EXPORT CARDS CONFIG ====================

  const exportCards: ExportCardData[] = [
    {
      id: 'technical-volume',
      title: 'Technical Volume',
      description: 'Complete technical proposal with all sections formatted for submission. Includes headers, page numbers, and styled paragraphs.',
      icon: <FileText className="w-5 h-5 text-muted-foreground" />,
      format: '.docx',
      storageKey: 'technical-volume',
      onExport: handleTechnicalVolumeExport,
    },
    {
      id: 'pricing-summary',
      title: 'Pricing Summary',
      description: 'Labor categories, quantities, rates, and total pricing. Ready for import into government pricing tools.',
      icon: <Table className="w-5 h-5 text-muted-foreground" />,
      format: '.csv',
      storageKey: 'pricing-summary',
      onExport: handlePricingSummaryExport,
    },
    {
      id: 'boe',
      title: 'Basis of Estimate',
      description: 'Detailed BOE document with WBS breakdown, labor rationale, assumptions, and risk analysis.',
      icon: <FileText className="w-5 h-5 text-muted-foreground" />,
      format: '.docx',
      storageKey: 'boe',
      onExport: handleBOEExport,
    },
    {
      id: 'compliance-matrix',
      title: 'Compliance Matrix',
      description: 'Requirements traceability matrix showing all RFP requirements and their compliance status.',
      icon: <FileCheck className="w-5 h-5 text-muted-foreground" />,
      format: '.csv',
      storageKey: 'compliance-matrix',
      onExport: handleComplianceMatrixExport,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Export</h2>
        <p className="text-sm text-muted-foreground mt-1">What do we send?</p>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {exportCards.map(card => (
          <ExportCardComponent
            key={card.id}
            card={card}
            isLoading={loadingCard === card.id}
            onExport={card.onExport}
          />
        ))}
      </div>
    </div>
  )
}

export default ExportPage
