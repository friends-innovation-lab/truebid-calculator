'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { FileText, Table, FileCheck, Download, Loader2 } from 'lucide-react'
import { generateBOEDocument, downloadBOE } from '@/lib/boe-export'

// ==================== TYPES ====================

interface ExportCard {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  format: string
  storageKey: string
  onExport: () => Promise<void>
}

// ==================== COLORS ====================

const COLORS = {
  canvas: '#FBF9F5',
  surface: '#fff',
  border: '#E8E7E2',
  primary: '#111110',
  muted: '#6B6A65',
  accent: '#639922',
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
  card: ExportCard
  isLoading: boolean
  onExport: () => void
}) {
  const lastExported = getLastExported(card.storageKey)

  return (
    <div style={{
      background: COLORS.surface,
      border: `0.5px solid ${COLORS.border}`,
      borderRadius: 8,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Icon and title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: '#F5F5F3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {card.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.primary,
            margin: 0,
            marginBottom: 4,
          }}>
            {card.title}
          </h3>
          <span style={{
            fontSize: 11,
            color: COLORS.muted,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {card.format}
          </span>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 13,
        color: COLORS.muted,
        margin: 0,
        lineHeight: 1.5,
        flex: 1,
      }}>
        {card.description}
      </p>

      {/* Footer: timestamp and button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTop: `0.5px solid ${COLORS.border}`,
      }}>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          {formatTimestamp(lastExported)}
        </span>
        <button
          onClick={onExport}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.surface,
            background: COLORS.primary,
            border: 'none',
            borderRadius: 6,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Download
        </button>
      </div>
    </div>
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

  const exportCards: ExportCard[] = [
    {
      id: 'technical-volume',
      title: 'Technical Volume',
      description: 'Complete technical proposal with all sections formatted for submission. Includes headers, page numbers, and styled paragraphs.',
      icon: <FileText className="w-5 h-5" style={{ color: COLORS.muted }} />,
      format: 'Word Document (.docx)',
      storageKey: 'technical-volume',
      onExport: handleTechnicalVolumeExport,
    },
    {
      id: 'pricing-summary',
      title: 'Pricing Summary',
      description: 'Labor categories, quantities, rates, and total pricing. Ready for import into government pricing tools.',
      icon: <Table className="w-5 h-5" style={{ color: COLORS.muted }} />,
      format: 'Spreadsheet (.csv)',
      storageKey: 'pricing-summary',
      onExport: handlePricingSummaryExport,
    },
    {
      id: 'boe',
      title: 'Basis of Estimate',
      description: 'Detailed BOE document with WBS breakdown, labor rationale, assumptions, and risk analysis.',
      icon: <FileText className="w-5 h-5" style={{ color: COLORS.muted }} />,
      format: 'Word Document (.docx)',
      storageKey: 'boe',
      onExport: handleBOEExport,
    },
    {
      id: 'compliance-matrix',
      title: 'Compliance Matrix',
      description: 'Requirements traceability matrix showing all RFP requirements and their compliance status.',
      icon: <FileCheck className="w-5 h-5" style={{ color: COLORS.muted }} />,
      format: 'Spreadsheet (.csv)',
      storageKey: 'compliance-matrix',
      onExport: handleComplianceMatrixExport,
    },
  ]

  return (
    <div style={{
      minHeight: '100%',
      background: COLORS.canvas,
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.primary,
          margin: 0,
          marginBottom: 4,
        }}>
          Export
        </h1>
        <p style={{
          fontSize: 13,
          color: COLORS.muted,
          margin: 0,
        }}>
          What do we send?
        </p>
      </div>

      {/* 2x2 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
        maxWidth: 900,
      }}>
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
