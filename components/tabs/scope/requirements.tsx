'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ClipboardList, Search, Download, Plus, ChevronDown, RefreshCw } from 'lucide-react'
import { useAppContext } from '@/contexts/app-context'
import { requirementsApi, complianceApi, sectionsApi, proposalsApi } from '@/lib/api'
import { ComplianceMatrix } from '@/components/tabs/scope/compliance-matrix'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ==================== TYPES ====================

type RequirementType = 'shall' | 'should' | 'instruction'
type RequirementStatus = 'compliant' | 'partial' | 'gap' | 'unaddressed'

interface Requirement {
  id: string
  ref: string
  type: RequirementType
  text: string
  source: string
  status: RequirementStatus
  proposalSection: string | null
  wbsLinks: string[]
  owner: string | null
}

interface ProposalSection {
  id: string
  title: string
  number: string
}

type InnerTab = 'requirements' | 'compliance'
type FilterType = 'all' | 'shall' | 'should' | 'instruction'
type StatusFilter = 'all' | 'compliant' | 'partial' | 'gap'

// ==================== STATUS COLORS ====================

const STATUS_COLORS = {
  compliant: '#639922',
  partial: '#BA7517',
  gap: '#A32D2D',
  unaddressed: '#E8E7E2',
}

const STATUS_BADGE_STYLES = {
  compliant: { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
  partial: { bg: '#FAEEDA', text: '#412402', border: '#EF9F27' },
  gap: { bg: '#FCEBEB', text: '#501313', border: '#F09595' },
  unaddressed: { bg: '#F4F3EF', text: '#6B6A65', border: '#D4D3CE' },
}

const TYPE_BADGE_STYLES = {
  shall: { bg: '#E6F1FB', text: '#042C53', border: '#85B7EB' },
  should: { bg: '#F4F3EF', text: '#5F5E5A', border: '#D4D3CE' },
  instruction: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
}

// Helper to safely get status color with fallback
const getStatusColor = (status: string | undefined | null): string => {
  if (status && STATUS_COLORS[status as RequirementStatus]) {
    return STATUS_COLORS[status as RequirementStatus]
  }
  return STATUS_COLORS.unaddressed
}

// ==================== FILTER CHIP ====================

interface FilterChipProps {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  variant?: 'default' | 'shall' | 'should' | 'instruction' | 'compliant' | 'partial' | 'gap'
}

function FilterChip({ label, count, active, onClick, variant = 'default' }: FilterChipProps) {
  const styles = {
    default: { bg: active ? '#111110' : '#F4F3EF', text: active ? '#FFFFFF' : '#5F5E5A', border: '#D4D3CE' },
    shall: { bg: '#E6F1FB', text: '#042C53', border: '#85B7EB' },
    should: { bg: '#F4F3EF', text: '#5F5E5A', border: '#D4D3CE' },
    instruction: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
    compliant: { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
    partial: { bg: '#FAEEDA', text: '#412402', border: '#EF9F27' },
    gap: { bg: '#FCEBEB', text: '#501313', border: '#F09595' },
  }

  const style = active && variant === 'default' ? styles.default : (active ? styles[variant] : styles.default)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 cursor-pointer transition-all"
      style={{
        padding: '4px 10px',
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 600,
        backgroundColor: active ? style.bg : '#F4F3EF',
        color: active ? style.text : '#5F5E5A',
        border: active && variant !== 'default' ? `0.5px solid ${style.border}` : '0.5px solid transparent',
      }}
    >
      {label}
      {count !== undefined && <span style={{ opacity: 0.7 }}>· {count}</span>}
    </button>
  )
}

// ==================== STATUS BADGE ====================

interface StatusBadgeProps {
  status: RequirementStatus
  onClick?: () => void
  clickable?: boolean
}

function StatusBadge({ status, onClick, clickable = false }: StatusBadgeProps) {
  // Default to unaddressed if status is invalid
  const validStatus = status && STATUS_BADGE_STYLES[status] ? status : 'unaddressed'
  const style = STATUS_BADGE_STYLES[validStatus]
  const labels: Record<string, string> = {
    compliant: 'Compliant',
    partial: 'Partial',
    gap: 'Gap',
    unaddressed: 'N/A',
  }

  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className="transition-all"
      style={{
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 9,
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
        border: `0.5px solid ${style.border}`,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      {labels[validStatus] || 'N/A'}
    </button>
  )
}

// ==================== TYPE BADGE ====================

interface TypeBadgeProps {
  type: RequirementType
}

function TypeBadge({ type }: TypeBadgeProps) {
  // Default to 'shall' if type is invalid
  const validType = type && TYPE_BADGE_STYLES[type] ? type : 'shall'
  const style = TYPE_BADGE_STYLES[validType]
  const labels: Record<string, string> = { shall: 'Shall', should: 'Should', instruction: 'Instr' }

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {labels[validType] || 'Req'}
    </span>
  )
}

// ==================== SECTION DROPDOWN ====================

interface SectionDropdownProps {
  value: string | null
  sections: ProposalSection[]
  onUpdate: (section: string | null) => void
  onClose: () => void
}

function SectionDropdown({ value, sections, onUpdate, onClose }: SectionDropdownProps) {
  const [search, setSearch] = useState('')

  const filtered = sections.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="absolute z-50 bg-white shadow-lg"
      style={{
        top: '100%',
        left: 0,
        width: 240,
        borderRadius: 8,
        border: '0.5px solid #E8E7E2',
        marginTop: 4,
      }}
    >
      <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #E8E7E2' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections..."
          className="w-full outline-none"
          style={{ fontSize: 12, color: '#111110' }}
          autoFocus
        />
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        <div
          onClick={() => { onUpdate(null); onClose() }}
          className="cursor-pointer hover:bg-[#FAFAF9]"
          style={{
            padding: '8px 10px',
            fontSize: 11,
            color: '#6B6A65',
            fontStyle: 'italic',
          }}
        >
          Not assigned
        </div>
        {filtered.map(section => (
          <div
            key={section.id}
            onClick={() => { onUpdate(section.id); onClose() }}
            className="cursor-pointer hover:bg-[#FAFAF9]"
            style={{
              padding: '8px 10px',
              fontSize: 12,
              color: value === section.id ? '#111110' : '#5F5E5A',
              fontWeight: value === section.id ? 600 : 400,
              backgroundColor: value === section.id ? '#FBF9F0' : 'transparent',
            }}
          >
            <span style={{ color: '#6B6A65', marginRight: 6 }}>{section.number}</span>
            {section.title}
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function Requirements() {
  const params = useParams()
  const proposalId = params?.id as string
  // State
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [, setSections] = useState<ProposalSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<InnerTab>('compliance')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  // editingSection removed — ComplianceMatrix component manages its own state
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasPdf, setHasPdf] = useState(false)
  const [isReExtracting, setIsReExtracting] = useState(false)
  const [showReExtractConfirm, setShowReExtractConfirm] = useState(false)
  const [complianceCount, setComplianceCount] = useState(0)
  const [complianceStats, setComplianceStats] = useState({ total: 0, compliant: 0, partial: 0, unaddressed: 0, coverage: 0 })

  const highlightedRowRef = useRef<HTMLDivElement>(null)

  // Build reverse lookup: requirement ID → WBS numbers
  const { estimateWbsElements } = useAppContext()
  const requirementToWBSMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    const elements = estimateWbsElements as unknown as { wbsNumber: string; requirementLinks?: string[] }[]
    elements?.forEach(element => {
      element.requirementLinks?.forEach(reqId => {
        if (!map[reqId]) map[reqId] = []
        map[reqId].push(element.wbsNumber)
      })
    })
    return map
  }, [estimateWbsElements])

  // Load requirements on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadData() {
      try {
        const [reqResponse, sectionsResponse, proposalResponse, compResponse] = await Promise.all([
          requirementsApi.list(proposalId),
          sectionsApi.list(proposalId).catch(() => ({ sections: [] })),
          proposalsApi.get(proposalId).catch(() => ({ proposal: null })),
          complianceApi.list(proposalId).catch(() => ({ items: [], stats: { total: 0 } })),
        ])
        const compData = compResponse as { items: unknown[]; stats: { total: number; compliant: number; partial: number; unaddressed: number } }
        const cStats = compData.stats || { total: 0, compliant: 0, partial: 0, unaddressed: 0 }
        setComplianceCount(cStats.total || compData.items?.length || 0)
        setComplianceStats({
          total: cStats.total,
          compliant: cStats.compliant,
          partial: cStats.partial,
          unaddressed: cStats.unaddressed,
          coverage: cStats.total > 0 ? Math.round((cStats.compliant / cStats.total) * 100) : 0,
        })

        // Transform API data to our format
        const reqData = (reqResponse as { requirements: Requirement[] }).requirements || []
        setRequirements(reqData.map((r: Requirement) => ({
          ...r,
          status: r.status || 'unaddressed',
          proposalSection: r.proposalSection || null,
          wbsLinks: r.wbsLinks || [],
          owner: r.owner || null,
        })))

        const sectData = (sectionsResponse as { sections: ProposalSection[] }).sections || []
        setSections(sectData)

        // Check if PDF exists
        const proposal = (proposalResponse as { proposal?: { workingData?: { pdfUrl?: string } } }).proposal
        setHasPdf(!!proposal?.workingData?.pdfUrl)
      } catch (error) {
        console.warn('[Requirements] Failed to load:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [proposalId])

  // Scroll to highlighted row when switching tabs
  useEffect(() => {
    if (activeTab === 'compliance' && selectedRef && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeTab, selectedRef])

  // Stats calculations
  const stats = useMemo(() => {
    const total = requirements.length
    const linked = requirements.filter(r => (requirementToWBSMap[r.id] || []).length > 0).length
    const unlinked = total - linked
    const compliant = requirements.filter(r => r.status === 'compliant').length
    const partial = requirements.filter(r => r.status === 'partial').length
    const gaps = requirements.filter(r => r.status === 'gap').length
    const coverage = total > 0 ? Math.round((linked / total) * 100) : 0
    return { total, linked, unlinked, compliant, partial, gaps, coverage }
  }, [requirements, requirementToWBSMap])

  // Type counts
  const typeCounts = useMemo(() => ({
    shall: requirements.filter(r => r.type === 'shall').length,
    should: requirements.filter(r => r.type === 'should').length,
    instruction: requirements.filter(r => r.type === 'instruction').length,
  }), [requirements])

  // Filtered requirements
  const filteredRequirements = useMemo(() => {
    let filtered = requirements

    // Type filter (requirements tab)
    if (activeTab === 'requirements' && typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter)
    }

    // Status filter (compliance tab)
    if (activeTab === 'compliance' && statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.ref.toLowerCase().includes(query) ||
        r.text.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [requirements, activeTab, typeFilter, statusFilter, searchQuery])

  // Generate compliance matrix
  const handleGenerate = async () => {
    if (requirements.length > 0) {
      const confirmed = window.confirm(
        'This will replace the existing matrix. Any manual edits will be lost.'
      )
      if (!confirmed) return
    }

    setIsGenerating(true)
    try {
      await complianceApi.generate(proposalId)
      // Reload requirements
      const response = await requirementsApi.list(proposalId)
      const reqData = (response as { requirements: Requirement[] }).requirements || []
      setRequirements(reqData.map((r: Requirement) => ({
        ...r,
        status: r.status || 'unaddressed',
        proposalSection: r.proposalSection || null,
        wbsLinks: r.wbsLinks || [],
        owner: r.owner || null,
      })))
    } catch (error) {
      console.error('[Requirements] Generate failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Re-extract requirements from PDF
  const handleReExtract = async () => {
    setShowReExtractConfirm(false)
    setIsReExtracting(true)

    // Store previous requirements for rollback on failure
    const previousRequirements = [...requirements]

    try {
      const response = await fetch(`/api/proposals/${proposalId}/re-extract`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Re-extraction failed')
      }

      // Reload requirements from database
      const reqResponse = await requirementsApi.list(proposalId)
      const reqData = (reqResponse as { requirements: Requirement[] }).requirements || []
      setRequirements(reqData.map((r: Requirement) => ({
        ...r,
        status: r.status || 'unaddressed',
        proposalSection: r.proposalSection || null,
        wbsLinks: r.wbsLinks || [],
        owner: r.owner || null,
      })))

      // Success toast
      toast.success('Requirements re-extracted', {
        description: `${data.count || reqData.length} requirements found`,
      })
    } catch (error) {
      console.error('[Requirements] Re-extract failed:', error)

      // Restore previous requirements
      setRequirements(previousRequirements)

      // Error toast with action
      toast.error('Re-extraction failed', {
        description: 'Your existing requirements were not changed. Try again or replace the PDF on the Solicitation page.',
        action: {
          label: 'Go to Solicitation →',
          onClick: () => {
            // Navigate via link click since we're in a toast
            window.location.href = `/proposals/${proposalId}?tab=scope&subtab=solicitation`
          },
        },
        duration: Infinity,
      })
    } finally {
      setIsReExtracting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#E8E7E2] border-t-[#111110] rounded-full animate-spin" />
      </div>
    )
  }

  // Empty state
  if (requirements.length === 0 && !isLoading) {
    return (
      <div className="py-16">
        <EmptyState
          icon={ClipboardList}
          title="No requirements yet"
          description="Go to Scope → Solicitation and upload your RFP. Requirements are extracted automatically."
          action={{
            label: 'Go to Solicitation',
            onClick: () => {
              // Navigation would be handled by parent
            },
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Fixed Header - doesn't scroll */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '0.5px solid #E8E7E2',
          padding: '24px 28px 0',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#C4C3BE',
            marginBottom: 6,
          }}
        >
          Scope · Requirements
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#111110',
            letterSpacing: '-0.5px',
            marginBottom: 14,
          }}
        >
          What are we required to do — and are we covered?
        </h1>

        {/* Stats Row — switches data source based on active tab */}
        <div className="flex items-center" style={{ marginBottom: 14 }}>
          {activeTab === 'requirements' ? (
            <div className="flex items-center">
              <StatItem value={stats.total} label="total" />
              <StatItem value={stats.linked} label="linked" color="#639922" />
              <StatItem value={stats.unlinked} label="unlinked" color={stats.unlinked > 0 ? '#A32D2D' : undefined} bold={stats.unlinked > 0} isLast />
            </div>
          ) : (
            <div className="flex items-center">
              <StatItem value={complianceStats.total} label="total" />
              <StatItem value={complianceStats.compliant} label="compliant" color="#639922" />
              <StatItem value={complianceStats.partial} label="partial" color="#BA7517" />
              <StatItem value={complianceStats.unaddressed} label="unaddressed" isLast />
            </div>
          )}

          {/* Coverage Bar */}
          <div className="flex items-center gap-2 ml-auto">
            <span style={{ fontSize: 11, color: '#6B6A65' }}>Coverage</span>
            <div
              style={{
                width: 140,
                height: 5,
                backgroundColor: '#F0EDE6',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${activeTab === 'requirements' ? stats.coverage : complianceStats.coverage}%`,
                  height: '100%',
                  backgroundColor: '#F5C200',
                  borderRadius: 3,
                  transition: 'width 300ms',
                }}
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111110' }}>
              {activeTab === 'requirements' ? stats.coverage : complianceStats.coverage}%
            </span>
          </div>
        </div>

        {/* Inner Tabs */}
        <div className="flex" style={{ marginBottom: -1 }}>
          <InnerTabButton
            label="Compliance Matrix"
            count={complianceCount}
            active={activeTab === 'compliance'}
            onClick={() => setActiveTab('compliance')}
          />
          <InnerTabButton
            label="Requirements"
            count={requirements.length}
            active={activeTab === 'requirements'}
            onClick={() => setActiveTab('requirements')}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center"
        style={{
          backgroundColor: '#FAFAF9',
          borderBottom: '0.5px solid #F4F3EF',
          padding: '10px 20px',
          gap: 8,
          opacity: isReExtracting ? 0.4 : 1,
          pointerEvents: isReExtracting ? 'none' : 'auto',
          transition: 'opacity 200ms',
        }}
      >
        {activeTab === 'requirements' ? (
          <>
            <FilterChip label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
            <FilterChip label="Shall" count={typeCounts.shall} active={typeFilter === 'shall'} onClick={() => setTypeFilter('shall')} variant="shall" />
            <FilterChip label="Should" count={typeCounts.should} active={typeFilter === 'should'} onClick={() => setTypeFilter('should')} variant="should" />
            <FilterChip label="Instructions" count={typeCounts.instruction} active={typeFilter === 'instruction'} onClick={() => setTypeFilter('instruction')} variant="instruction" />
          </>
        ) : (
          <>
            <FilterChip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <FilterChip label="Compliant" count={stats.compliant} active={statusFilter === 'compliant'} onClick={() => setStatusFilter('compliant')} variant="compliant" />
            <FilterChip label="Partial" count={stats.partial} active={statusFilter === 'partial'} onClick={() => setStatusFilter('partial')} variant="partial" />
            <FilterChip label="Gaps" count={stats.gaps} active={statusFilter === 'gap'} onClick={() => setStatusFilter('gap')} variant="gap" />
          </>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C4C3BE]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requirements..."
              className="outline-none"
              style={{
                width: 180,
                height: 30,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: 11,
                color: '#111110',
                backgroundColor: '#FFFFFF',
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
              }}
            />
          </div>
          {/* Re-extract button - only on requirements tab when PDF exists */}
          {activeTab === 'requirements' && hasPdf && (
            <button
              onClick={() => setShowReExtractConfirm(true)}
              style={{
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 500,
                color: '#5F5E5A',
                backgroundColor: '#FFFFFF',
                border: '0.5px solid #E8E7E2',
                borderRadius: 5,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F4F3EF' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
            >
              Re-extract
            </button>
          )}
          <Button variant="ghost" size="sm" className="h-[30px] px-3 text-xs">
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>
          {activeTab === 'requirements' ? (
            <Button size="sm" className="h-[30px] px-3 text-xs bg-[#111110] hover:bg-[#1C1C1A]">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-[30px] px-3 text-xs bg-[#111110] hover:bg-[#1C1C1A]"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {/* Re-extraction loading state */}
        {isReExtracting ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              gap: 12,
            }}
          >
            <div
              className="animate-spin"
              style={{
                width: 24,
                height: 24,
                border: '2px solid rgba(245,194,0,0.2)',
                borderTopColor: '#F5C200',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#111110',
              }}
            >
              Re-extracting requirements...
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#6B6A65',
                textAlign: 'center',
              }}
            >
              Reading the RFP and identifying what needs to be addressed
            </div>
          </div>
        ) : filteredRequirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p style={{ fontSize: 13, color: '#6B6A65', marginBottom: 4 }}>
              No {typeFilter !== 'all' ? typeFilter : ''} requirements match
            </p>
            <button
              onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearchQuery('') }}
              style={{ fontSize: 12, color: '#F5C200', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              Reset filters
            </button>
          </div>
        ) : activeTab === 'requirements' ? (
          <RequirementsTable
            requirements={filteredRequirements}
            selectedRef={selectedRef}
            onSelectRef={setSelectedRef}
            requirementToWBSMap={requirementToWBSMap}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ComplianceMatrix />
          </div>
        )}
      </div>

      {/* Re-extract confirmation dialog */}
      <Dialog open={showReExtractConfirm} onOpenChange={setShowReExtractConfirm}>
        <DialogContent>
          <DialogHeader>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 7,
                backgroundColor: '#F4F3EF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <RefreshCw style={{ width: 22, height: 22, color: '#5F5E5A' }} />
            </div>
            <DialogTitle style={{ fontSize: 16, fontWeight: 600, color: '#111110' }}>
              Re-extract requirements?
            </DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: '#5F5E5A', lineHeight: 1.6 }}>
              This will replace all {requirements.length} current requirements with a fresh extraction from the uploaded PDF. Any manual edits to status, section assignments, or WBS links will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReExtractConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReExtract}
              style={{ backgroundColor: '#111110', color: '#FFFFFF' }}
            >
              Re-extract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== STAT ITEM ====================

interface StatItemProps {
  value: number
  label: string
  color?: string
  bold?: boolean
  isLast?: boolean
}

function StatItem({ value, label, color, bold, isLast }: StatItemProps) {
  return (
    <div
      className="flex items-baseline gap-1.5"
      style={{
        marginRight: isLast ? 0 : 20,
        paddingRight: isLast ? 0 : 20,
        borderRight: isLast ? 'none' : '0.5px solid #E8E7E2',
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: color || '#111110',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          color: '#6B6A65',
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ==================== INNER TAB BUTTON ====================

interface InnerTabButtonProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function InnerTabButton({ label, count, active, onClick }: InnerTabButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        padding: '10px 20px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? '#111110' : '#6B6A65',
        borderBottom: `2px solid ${active ? '#F5C200' : 'transparent'}`,
        background: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
      <span
        style={{
          marginLeft: 6,
          padding: '1px 5px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 700,
          backgroundColor: active ? '#F5C200' : '#F4F3EF',
          color: active ? '#111110' : '#6B6A65',
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ==================== REQUIREMENTS TABLE ====================

interface RequirementsTableProps {
  requirements: Requirement[]
  selectedRef: string | null
  onSelectRef: (ref: string) => void
  requirementToWBSMap: Record<string, string[]>
}

function RequirementsTable({ requirements, selectedRef, onSelectRef, requirementToWBSMap }: RequirementsTableProps) {
  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 grid"
        style={{
          gridTemplateColumns: '72px 80px 1fr 110px 120px 60px',
          backgroundColor: '#FAFAF9',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <TableHeader>Ref</TableHeader>
        <TableHeader>Type</TableHeader>
        <TableHeader>Requirement</TableHeader>
        <TableHeader>Source</TableHeader>
        <TableHeader>WBS</TableHeader>
        <TableHeader align="center">Status</TableHeader>
      </div>

      {/* Rows */}
      {requirements.map(req => {
        const wbsRefs = requirementToWBSMap[req.id] || []
        const isLinked = wbsRefs.length > 0
        const dotColor = isLinked ? '#639922' : '#A32D2D'

        return (
          <div
            key={req.id}
            onClick={() => onSelectRef(req.ref)}
            className="grid cursor-pointer hover:bg-[#FAFAF8]"
            style={{
              gridTemplateColumns: '72px 80px 1fr 110px 120px 60px',
              borderBottom: '0.5px solid #F4F3EF',
              borderLeft: `3px solid ${dotColor}`,
              backgroundColor: selectedRef === req.ref ? '#FBF9F0' : 'transparent',
            }}
          >
            <TableCell>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6B6A65' }}>
                {req.ref}
              </span>
            </TableCell>
            <TableCell>
              <TypeBadge type={req.type} />
            </TableCell>
            <TableCell>
              <span style={{ fontSize: 14, color: '#111110', lineHeight: 1.5 }}>
                {req.text}
              </span>
            </TableCell>
            <TableCell>
              <span style={{ fontSize: 12, color: '#6B6A65', whiteSpace: 'nowrap' }}>
                {req.source}
              </span>
            </TableCell>
            <TableCell>
              {wbsRefs.length > 0 ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {wbsRefs.map(ref => (
                    <span
                      key={ref}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: '#E1F5EE',
                        color: '#085041',
                        border: '0.5px solid #5DCAA5',
                      }}
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#C4C3BE', fontStyle: 'italic' }}>
                  Not linked
                </span>
              )}
            </TableCell>
            <TableCell align="center">
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  margin: '0 auto',
                }}
              />
            </TableCell>
          </div>
        )
      })}
    </div>
  )
}

// ComplianceTable removed — replaced by standalone ComplianceMatrix component.
// See git history for the old inline implementation.

interface _Removed_ComplianceTableProps {
  requirements: Requirement[]
  sections: ProposalSection[]
  selectedRef: string | null
  highlightedRowRef: React.RefObject<HTMLDivElement | null>
  editingSection: string | null
  setEditingSection: (id: string | null) => void
  onUpdateRequirement: (id: string, updates: Partial<Requirement>) => void
}

// @ts-expect-error — dead code kept for reference, will be deleted
function _ComplianceTable_DEAD({
  requirements,
  sections,
  selectedRef,
  highlightedRowRef,
  editingSection,
  setEditingSection,
  onUpdateRequirement,
}: _Removed_ComplianceTableProps) {
  const cycleStatus = (current: RequirementStatus): RequirementStatus => {
    const order: RequirementStatus[] = ['compliant', 'partial', 'gap', 'unaddressed']
    const idx = order.indexOf(current)
    return order[(idx + 1) % order.length]
  }

  return (
    <div>
      {/* Header - NO WBS column */}
      <div
        className="sticky top-0 grid"
        style={{
          gridTemplateColumns: '72px 1fr 200px 100px 100px',
          backgroundColor: '#FAFAF9',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <TableHeader>Ref</TableHeader>
        <TableHeader>Requirement</TableHeader>
        <TableHeader>Proposal Section</TableHeader>
        <TableHeader>Status</TableHeader>
        <TableHeader>Owner</TableHeader>
      </div>

      {/* Rows */}
      {requirements.map(req => {
        const isHighlighted = selectedRef === req.ref
        const section = sections.find(s => s.id === req.proposalSection)

        return (
          <div
            key={req.id}
            ref={isHighlighted ? highlightedRowRef as React.RefObject<HTMLDivElement> : undefined}
            className="grid"
            style={{
              gridTemplateColumns: '72px 1fr 200px 100px 100px',
              borderBottom: '0.5px solid #F4F3EF',
              borderLeft: `3px solid ${isHighlighted ? '#F5C200' : getStatusColor(req.status)}`,
              backgroundColor: isHighlighted ? '#FBF9F0' : 'transparent',
            }}
          >
            <TableCell>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B6A65' }}>
                {req.ref}
              </span>
            </TableCell>
            <TableCell>
              <span
                style={{
                  fontSize: 12,
                  color: '#5F5E5A',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {req.text}
              </span>
            </TableCell>
            <TableCell>
              <div className="relative">
                <button
                  onClick={() => setEditingSection(editingSection === req.id ? null : req.id)}
                  className="flex items-center gap-1 w-full text-left"
                  style={{
                    fontSize: 12,
                    color: section ? '#111110' : '#C4C3BE',
                    fontStyle: section ? 'normal' : 'italic',
                  }}
                >
                  {section ? `${section.number} ${section.title}` : 'Not assigned'}
                  <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                </button>
                {editingSection === req.id && (
                  <SectionDropdown
                    value={req.proposalSection}
                    sections={sections}
                    onUpdate={(s) => onUpdateRequirement(req.id, { proposalSection: s })}
                    onClose={() => setEditingSection(null)}
                  />
                )}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge
                status={req.status}
                clickable
                onClick={() => onUpdateRequirement(req.id, { status: cycleStatus(req.status) })}
              />
            </TableCell>
            <TableCell>
              <span
                style={{
                  fontSize: 11,
                  color: req.owner ? '#5F5E5A' : '#C4C3BE',
                }}
              >
                {req.owner || '—'}
              </span>
            </TableCell>
          </div>
        )
      })}
    </div>
  )
}

// ==================== TABLE HELPERS ====================

function TableHeader({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: '#6B6A65',
        textAlign: align,
      }}
    >
      {children}
    </div>
  )
}

function TableCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {children}
    </div>
  )
}

export default Requirements
