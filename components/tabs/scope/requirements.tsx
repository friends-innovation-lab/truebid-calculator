'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ClipboardList, Search, Download, Plus, Check, ChevronDown } from 'lucide-react'
import { useAppContext } from '@/contexts/app-context'
import { requirementsApi, complianceApi, sectionsApi } from '@/lib/api'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

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
  unaddressed: { bg: '#F4F3EF', text: '#9B9A95', border: '#D4D3CE' },
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

// ==================== WBS POPOVER ====================

interface WBSPopoverProps {
  wbsLinks: string[]
  availableWbs: { id: string; title: string; number: string }[]
  onUpdate: (links: string[]) => void
  onClose: () => void
}

function WBSPopover({ wbsLinks, availableWbs, onUpdate, onClose }: WBSPopoverProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>(wbsLinks)

  const filtered = availableWbs.filter(w =>
    w.title.toLowerCase().includes(search.toLowerCase()) ||
    w.number.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleDone = () => {
    onUpdate(selected)
    onClose()
  }

  return (
    <div
      className="absolute z-50 bg-white shadow-lg"
      style={{
        top: '100%',
        left: 0,
        width: 280,
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
          placeholder="Search WBS..."
          className="w-full outline-none"
          style={{ fontSize: 12, color: '#111110' }}
        />
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '12px', fontSize: 11, color: '#9B9A95', textAlign: 'center' }}>
            No WBS elements found
          </div>
        ) : (
          filtered.map(wbs => (
            <div
              key={wbs.id}
              onClick={() => handleToggle(wbs.id)}
              className="flex items-center gap-2 cursor-pointer hover:bg-[#FAFAF9]"
              style={{ padding: '6px 10px' }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: `1px solid ${selected.includes(wbs.id) ? '#639922' : '#D4D3CE'}`,
                  backgroundColor: selected.includes(wbs.id) ? '#639922' : '#FFFFFF',
                }}
              >
                {selected.includes(wbs.id) && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#111110' }}>{wbs.number}</div>
                <div style={{ fontSize: 10, color: '#9B9A95', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {wbs.title}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ padding: '8px 10px', borderTop: '0.5px solid #E8E7E2' }}>
        <button
          onClick={handleDone}
          className="w-full"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: '#111110',
            color: '#FFFFFF',
          }}
        >
          Done
        </button>
      </div>
    </div>
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
            color: '#9B9A95',
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
            <span style={{ color: '#9B9A95', marginRight: 6 }}>{section.number}</span>
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
  const { estimateWbsElements } = useAppContext()

  // State
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [sections, setSections] = useState<ProposalSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<InnerTab>('requirements')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [editingWbs, setEditingWbs] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const highlightedRowRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load requirements on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadData() {
      try {
        const [reqResponse, sectionsResponse] = await Promise.all([
          requirementsApi.list(proposalId),
          sectionsApi.list(proposalId).catch(() => ({ sections: [] })),
        ])

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
    const compliant = requirements.filter(r => r.status === 'compliant').length
    const partial = requirements.filter(r => r.status === 'partial').length
    const gaps = requirements.filter(r => r.status === 'gap').length
    const coverage = total > 0 ? Math.round((compliant / total) * 100) : 0
    return { total, compliant, partial, gaps, coverage }
  }, [requirements])

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

  // Update requirement
  const updateRequirement = useCallback(async (id: string, updates: Partial<Requirement>) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await complianceApi.update(proposalId, id, updates)
      } catch (error) {
        console.error('[Requirements] Save failed:', error)
      }
    }, 500)
  }, [proposalId])

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

  // WBS elements for popover
  const availableWbs = estimateWbsElements.map((w: { id: string; title: string; wbsNumber?: string }) => ({
    id: w.id,
    title: w.title,
    number: w.wbsNumber || w.id,
  }))

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

        {/* Stats Row */}
        <div className="flex items-center" style={{ marginBottom: 14 }}>
          {/* Stats */}
          <div className="flex items-center">
            <StatItem value={stats.total} label="total" />
            <StatItem value={stats.compliant} label="compliant" color="#639922" />
            <StatItem value={stats.partial} label="partial" color="#BA7517" />
            <StatItem value={stats.gaps} label="gaps" color={stats.gaps > 0 ? '#A32D2D' : undefined} bold={stats.gaps > 0} isLast />
          </div>

          {/* Coverage Bar */}
          <div className="flex items-center gap-2 ml-auto">
            <span style={{ fontSize: 11, color: '#9B9A95' }}>Coverage</span>
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
                  width: `${stats.coverage}%`,
                  height: '100%',
                  backgroundColor: '#F5C200',
                  borderRadius: 3,
                  transition: 'width 300ms',
                }}
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111110' }}>
              {stats.coverage}%
            </span>
          </div>
        </div>

        {/* Inner Tabs */}
        <div className="flex" style={{ marginBottom: -1 }}>
          <InnerTabButton
            label="Requirements"
            count={requirements.length}
            active={activeTab === 'requirements'}
            onClick={() => setActiveTab('requirements')}
          />
          <InnerTabButton
            label="Compliance Matrix"
            count={requirements.length}
            active={activeTab === 'compliance'}
            onClick={() => setActiveTab('compliance')}
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
        {filteredRequirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p style={{ fontSize: 13, color: '#9B9A95', marginBottom: 4 }}>
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
          />
        ) : (
          <ComplianceTable
            requirements={filteredRequirements}
            sections={sections}
            availableWbs={availableWbs}
            selectedRef={selectedRef}
            highlightedRowRef={highlightedRowRef}
            editingWbs={editingWbs}
            setEditingWbs={setEditingWbs}
            editingSection={editingSection}
            setEditingSection={setEditingSection}
            onUpdateRequirement={updateRequirement}
          />
        )}
      </div>
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
          color: '#9B9A95',
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
        color: active ? '#111110' : '#9B9A95',
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
          color: active ? '#111110' : '#9B9A95',
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
}

function RequirementsTable({ requirements, selectedRef, onSelectRef }: RequirementsTableProps) {
  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 grid"
        style={{
          gridTemplateColumns: '72px 80px 1fr 110px 60px',
          backgroundColor: '#FAFAF9',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <TableHeader>Ref</TableHeader>
        <TableHeader>Type</TableHeader>
        <TableHeader>Requirement</TableHeader>
        <TableHeader>Source</TableHeader>
        <TableHeader align="center">Status</TableHeader>
      </div>

      {/* Rows */}
      {requirements.map(req => (
        <div
          key={req.id}
          onClick={() => onSelectRef(req.ref)}
          className="grid cursor-pointer hover:bg-[#FAFAF8]"
          style={{
            gridTemplateColumns: '72px 80px 1fr 110px 60px',
            borderBottom: '0.5px solid #F4F3EF',
            borderLeft: `3px solid ${getStatusColor(req.status)}`,
            backgroundColor: selectedRef === req.ref ? '#FBF9F0' : 'transparent',
          }}
        >
          <TableCell>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#9B9A95' }}>
              {req.ref}
            </span>
          </TableCell>
          <TableCell>
            <TypeBadge type={req.type} />
          </TableCell>
          <TableCell>
            <span style={{ fontSize: 13, color: '#111110', lineHeight: 1.5 }}>
              {req.text}
            </span>
          </TableCell>
          <TableCell>
            <span style={{ fontSize: 11, color: '#C4C3BE', whiteSpace: 'nowrap' }}>
              {req.source}
            </span>
          </TableCell>
          <TableCell align="center">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: getStatusColor(req.status),
                margin: '0 auto',
              }}
            />
          </TableCell>
        </div>
      ))}
    </div>
  )
}

// ==================== COMPLIANCE TABLE ====================

interface ComplianceTableProps {
  requirements: Requirement[]
  sections: ProposalSection[]
  availableWbs: { id: string; title: string; number: string }[]
  selectedRef: string | null
  highlightedRowRef: React.RefObject<HTMLDivElement | null>
  editingWbs: string | null
  setEditingWbs: (id: string | null) => void
  editingSection: string | null
  setEditingSection: (id: string | null) => void
  onUpdateRequirement: (id: string, updates: Partial<Requirement>) => void
}

function ComplianceTable({
  requirements,
  sections,
  availableWbs,
  selectedRef,
  highlightedRowRef,
  editingWbs,
  setEditingWbs,
  editingSection,
  setEditingSection,
  onUpdateRequirement,
}: ComplianceTableProps) {
  const cycleStatus = (current: RequirementStatus): RequirementStatus => {
    const order: RequirementStatus[] = ['compliant', 'partial', 'gap', 'unaddressed']
    const idx = order.indexOf(current)
    return order[(idx + 1) % order.length]
  }

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 grid"
        style={{
          gridTemplateColumns: '72px 180px 1fr 120px 100px 100px',
          backgroundColor: '#FAFAF9',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <TableHeader>Ref</TableHeader>
        <TableHeader>Requirement</TableHeader>
        <TableHeader>Proposal Section</TableHeader>
        <TableHeader>Status</TableHeader>
        <TableHeader>WBS</TableHeader>
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
              gridTemplateColumns: '72px 180px 1fr 120px 100px 100px',
              borderBottom: '0.5px solid #F4F3EF',
              borderLeft: `3px solid ${isHighlighted ? '#F5C200' : getStatusColor(req.status)}`,
              backgroundColor: isHighlighted ? '#FBF9F0' : 'transparent',
            }}
          >
            <TableCell>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#9B9A95' }}>
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
              <div className="relative">
                {req.wbsLinks.length > 0 ? (
                  <button
                    onClick={() => setEditingWbs(editingWbs === req.id ? null : req.id)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                      backgroundColor: '#E1F5EE',
                      color: '#085041',
                      border: '0.5px solid #5DCAA5',
                    }}
                  >
                    {req.wbsLinks.length} linked
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingWbs(editingWbs === req.id ? null : req.id)}
                    style={{
                      fontSize: 11,
                      color: '#C4C3BE',
                      fontStyle: 'italic',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    —
                  </button>
                )}
                {editingWbs === req.id && (
                  <WBSPopover
                    wbsLinks={req.wbsLinks}
                    availableWbs={availableWbs}
                    onUpdate={(links) => onUpdateRequirement(req.id, { wbsLinks: links })}
                    onClose={() => setEditingWbs(null)}
                  />
                )}
              </div>
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
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: '#C4C3BE',
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
