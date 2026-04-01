'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { collabApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import {
  Layers,
  ChevronRight,
  ChevronDown,
  X,
  FileDown,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { syncRolesFromWBS } from '@/lib/wbs-to-roles'

// ==================== TYPES ====================

interface WBSTask {
  id: string
  name: string
  role: string | null
  hours: number
  chargeCode: string | null
}

interface WBSElementData {
  id: string
  wbsNumber: string
  title: string
  description?: string
  why?: string
  what?: string
  laborEstimates?: {
    id: string
    roleId: string
    roleName: string
    hoursByPeriod: { base: number; option1: number; option2: number; option3: number; option4: number }
    rationale: string
  }[]
  assumptions?: string[]
  dependencies?: { id: string; predecessorWbsId: string }[]
  sowReference?: string
  notes?: string
}

interface CollabSession {
  id: string
  reviewer_name: string
  status: string
  expires_at: string
}

// ==================== HELPERS ====================

function getTotalHours(el: WBSElementData): number {
  if (!el.laborEstimates) return 0
  return el.laborEstimates.reduce((sum, le) => {
    const h = le.hoursByPeriod
    return sum + h.base + h.option1 + h.option2 + h.option3 + h.option4
  }, 0)
}

interface HoursByYear {
  base: number
  oy1: number
  oy2: number
  oy3: number
  oy4: number
}

function getHoursByYear(el: WBSElementData): HoursByYear {
  if (!el.laborEstimates) return { base: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 }
  return el.laborEstimates.reduce(
    (acc, le) => ({
      base: acc.base + le.hoursByPeriod.base,
      oy1: acc.oy1 + le.hoursByPeriod.option1,
      oy2: acc.oy2 + le.hoursByPeriod.option2,
      oy3: acc.oy3 + le.hoursByPeriod.option3,
      oy4: acc.oy4 + le.hoursByPeriod.option4,
    }),
    { base: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 }
  )
}

function getStatusDot(el: WBSElementData, reqCount: number): { color: string; label: string } {
  const hours = getTotalHours(el)
  if (reqCount > 0 && hours > 0) return { color: '#639922', label: 'Complete' }
  if (reqCount > 0 || hours > 0) return { color: '#BA7517', label: 'Partial' }
  if (el.title && el.description) return { color: '#C4C3BE', label: 'Not started' }
  return { color: '#A32D2D', label: 'Missing requirements' }
}

function getTasksFromLabor(el: WBSElementData): WBSTask[] {
  if (!el.laborEstimates || el.laborEstimates.length === 0) return []
  return el.laborEstimates.map(le => ({
    id: le.id,
    name: le.rationale || `${le.roleName} work`,
    role: le.roleName,
    hours: le.hoursByPeriod.base + le.hoursByPeriod.option1 + le.hoursByPeriod.option2 + le.hoursByPeriod.option3 + le.hoursByPeriod.option4,
    chargeCode: null,
  }))
}

// ==================== MAIN COMPONENT ====================

export function ScopeOfWork() {
  const params = useParams()
  const proposalId = params?.id as string
  const {
    estimateWbsElements,
    setEstimateWbsElements,
    extractedRequirements,
    solicitation,
    selectedRoles,
    setSelectedRoles,
    companyRoles,
    proposalSetup,
  } = useAppContext()

  const wbsElements = estimateWbsElements as unknown as WBSElementData[]

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedElement, setSelectedElement] = useState<WBSElementData | null>(null)
  const [directorSession, setDirectorSession] = useState<CollabSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Load director session if exists
  useEffect(() => {
    if (!proposalId) return
    collabApi.listSessions(proposalId)
      .then((res: unknown) => {
        const data = res as { sessions: CollabSession[] }
        const open = data.sessions?.find(s => s.status === 'open')
        if (open) setDirectorSession(open)
      })
      .catch(() => {})
  }, [proposalId])

  // Sync roles from WBS to selectedRoles when WBS changes
  // This ensures Roles & Pricing stays in sync with WBS edits
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (wbsElements.length === 0) return

    // Debounce the sync to avoid excessive updates
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      // Transform companyRoles for syncRolesFromWBS
      const laborCategories = companyRoles.map(r => ({
        title: r.title,
        laborCategory: r.laborCategory,
        socCode: r.blsOccCode,
        salary_levels: r.levels?.map(l => ({
          level: l.level,
          level_title: l.levelName,
          steps: l.steps.map(s => s.salary),
        })),
      }))

      const setup = proposalSetup ? {
        optionYears: proposalSetup.optionYears,
        billableHoursPerYear: proposalSetup.billableHoursPerYear,
        profitMargin: proposalSetup.escalationRate,
      } : undefined

      const syncedRoles = syncRolesFromWBS(
        wbsElements as Parameters<typeof syncRolesFromWBS>[0],
        selectedRoles as unknown as Parameters<typeof syncRolesFromWBS>[1],
        setup,
        laborCategories
      )

      // Only update if roles actually changed
      if (JSON.stringify(syncedRoles.map(r => r.name).sort()) !== JSON.stringify(selectedRoles.map(r => r.name).sort())) {
        setSelectedRoles(syncedRoles)
      }
    }, 500)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [wbsElements, companyRoles, proposalSetup]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const stats = useMemo(() => {
    const totalHours = wbsElements.reduce((sum, el) => sum + getTotalHours(el), 0)
    // For now, count all extracted requirements as potentially unlinked
    const unlinkedReqs = extractedRequirements.length
    return {
      packages: wbsElements.length,
      totalHours,
      unlinkedReqs,
    }
  }, [wbsElements, extractedRequirements])

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const collapseAll = () => setExpandedIds(new Set())

  const handleAddPackage = () => {
    const newId = `wbs-${crypto.randomUUID()}`
    const num = wbsElements.length + 1
    const newElement = {
      id: newId,
      wbsNumber: `${num}.0`,
      title: `Work Package ${num}`,
      description: '',
      laborEstimates: [],
      assumptions: [],
      dependencies: [],
    } as unknown as WBSElementData
    setEstimateWbsElements([...estimateWbsElements, newElement as never])
    setSelectedElement(newElement)
  }

  const handleGenerate = async () => {
    // Check requirements exist
    if (!extractedRequirements || extractedRequirements.length === 0) {
      toast.warning('No requirements found. Extract requirements from your RFP first.')
      return
    }

    // Confirm if elements already exist
    if (wbsElements.length > 0) {
      if (!confirm(`This will replace your ${wbsElements.length} existing work packages and clear all hour assignments. This cannot be undone. Continue?`)) return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`/api/proposals/${proposalId}/generate-wbs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Generation failed (${response.status})`)
      }

      const { wbsElements: generated, roles, count, rolesCount } = await response.json()

      if (generated && generated.length > 0) {
        setEstimateWbsElements(generated as never)

        // Update roles in context immediately so Roles & Pricing reflects the change
        if (roles && roles.length > 0) {
          setSelectedRoles(roles)
        }

        toast.success(`${count} work packages created · ${rolesCount || 0} roles added to Roles & Pricing`)
      } else {
        toast.error('No work packages were generated')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed · Try again')
    } finally {
      setIsGenerating(false)
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* ZONE 1 — PAGE HEADER */}
      <div className="shrink-0" style={{ borderBottom: '0.5px solid #E8E7E2', padding: '20px 24px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#C4C3BE', marginBottom: 5 }}>
          Staff · Scope of Work
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111110', letterSpacing: '-0.5px', marginBottom: 12 }}>
          What work needs to be done?
        </h1>

        {/* Stats Row */}
        <div className="flex items-center" style={{ marginBottom: 14 }}>
          <StatItem value={stats.packages} label="work packages" />
          <VerticalDivider />
          <StatItem value={stats.totalHours.toLocaleString()} label="total hours" color="#639922" />
          <VerticalDivider />
          <StatItem
            value={stats.unlinkedReqs}
            label="unlinked reqs"
            color={stats.unlinkedReqs > 0 ? '#A32D2D' : '#111110'}
          />

          <div className="ml-auto flex items-center gap-2">
            <button
              style={{ border: '0.5px solid #E8E7E2', background: '#fff', color: '#5F5E5A', fontSize: 11, fontWeight: 500, padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}
            >
              <FileDown className="w-3.5 h-3.5 inline mr-1" style={{ verticalAlign: '-2px' }} />
              Export
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ background: '#F5C200', color: '#111110', fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer' }}
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" style={{ verticalAlign: '-2px' }} /> : <Sparkles className="w-3.5 h-3.5 inline mr-1" style={{ verticalAlign: '-2px' }} />}
              Generate from requirements
            </button>
          </div>
        </div>
      </div>

      {/* ZONE 2 — DIRECTOR BANNER */}
      {directorSession && (
        <DirectorBanner session={directorSession} />
      )}

      {/* ZONE 3 — TOOLBAR */}
      <div className="shrink-0 flex items-center" style={{ background: '#FAFAF9', borderBottom: '0.5px solid #F4F3EF', padding: '8px 16px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#C4C3BE' }}>
          Work packages
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={collapseAll} style={{ fontSize: 10, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer' }}>
            Collapse all
          </button>
          <button onClick={handleAddPackage} style={{ fontSize: 10, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer' }}>
            + Add package
          </button>
        </div>
      </div>

      {/* ZONE 4 — WBS LIST */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F5C200' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111110', marginTop: 12 }}>Generating work packages...</div>
              <div style={{ fontSize: 12, color: '#6B6A65', marginTop: 4 }}>Reading {extractedRequirements.length} requirements and building your work breakdown structure</div>
            </div>
          ) : wbsElements.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <EmptyState
                icon={Layers}
                title="No work packages yet"
                description="Generate from the RFP or add manually. Work packages define what gets built and who builds it."
                action={{ label: 'Generate from requirements', onClick: handleGenerate }}
                secondaryAction={{ label: 'Add manually', onClick: handleAddPackage }}
              />
            </div>
          ) : (
            wbsElements.map(el => (
              <WBSRow
                key={el.id}
                element={el}
                isExpanded={expandedIds.has(el.id)}
                onToggle={() => toggleExpanded(el.id)}
                onSelect={() => setSelectedElement(el)}
                requirements={extractedRequirements as { id: string; referenceNumber?: string; reference_number?: string }[]}
                optionYears={solicitation.periodOfPerformance.optionYears}
              />
            ))
          )}
        </div>

        {/* Detail Slideout */}
        {selectedElement && (
          <DetailSlideout
            element={selectedElement}
            allElements={wbsElements}
            requirements={extractedRequirements as { id: string; referenceNumber?: string; reference_number?: string; title: string }[]}
            optionYears={solicitation.periodOfPerformance.optionYears}
            availableRoles={companyRoles.map(r => r.title)}
            onUpdate={(updates) => {
              const updated = { ...selectedElement, ...updates }
              setSelectedElement(updated)
              setEstimateWbsElements(
                estimateWbsElements.map(e => (e as unknown as WBSElementData).id === updated.id ? updated as never : e)
              )
            }}
            onDelete={() => {
              setEstimateWbsElements(estimateWbsElements.filter(e => (e as unknown as WBSElementData).id !== selectedElement.id))
              setSelectedElement(null)
            }}
            onClose={() => setSelectedElement(null)}
          />
        )}
      </div>
    </div>
  )
}

// ==================== WBS ROW ====================

function WBSRow({
  element, isExpanded, onToggle, onSelect, requirements, optionYears,
}: {
  element: WBSElementData
  isExpanded: boolean
  onToggle: () => void
  onSelect: () => void
  requirements: { id: string; referenceNumber?: string; reference_number?: string }[]
  optionYears: number
}) {
  const totalHours = getTotalHours(element)
  const hoursByYear = getHoursByYear(element)
  const tasks = getTasksFromLabor(element)
  const reqLinks = (element as { requirementLinks?: string[] }).requirementLinks || []
  const status = getStatusDot(element, reqLinks.length)

  return (
    <div>
      {/* Header Row */}
      <div
        className="flex items-center cursor-pointer hover:bg-[#FAFAF8]"
        style={{ borderBottom: '0.5px solid #F4F3EF', padding: '12px 20px', gap: 10 }}
        onClick={onSelect}
      >
        {/* Expand Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          style={{ width: 16, height: 16, border: '0.5px solid #E8E7E2', borderRadius: 3, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronDown className="w-2.5 h-2.5" style={{ color: '#6B6A65' }} /> : <ChevronRight className="w-2.5 h-2.5" style={{ color: '#6B6A65' }} />}
        </button>

        {/* WBS Number */}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6A65', flexShrink: 0, width: 52 }}>
          {element.wbsNumber}
        </span>

        {/* Element Name */}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111110', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {element.title}
        </span>

        {/* Requirement Chips */}
        <div className="flex gap-1 flex-wrap" style={{ maxWidth: 200 }}>
          {(() => {
            const links = (element as { requirementLinks?: string[] }).requirementLinks || []
            if (links.length === 0) return <span style={{ fontSize: 10, fontStyle: 'italic', color: '#C4C3BE' }}>No reqs linked</span>
            const chips = links.slice(0, 3).map(reqId => {
              const req = requirements.find(r => r.id === reqId)
              const ref = req?.referenceNumber || req?.reference_number || reqId.slice(0, 7)
              return (
                <span key={reqId} style={{ fontSize: 9, fontWeight: 600, background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5', padding: '1px 6px', borderRadius: 3 }}>
                  {ref}
                </span>
              )
            })
            if (links.length > 3) {
              chips.push(
                <span key="more" style={{ fontSize: 9, fontWeight: 600, background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5', padding: '1px 6px', borderRadius: 3 }}>
                  +{links.length - 3} more
                </span>
              )
            }
            return chips
          })()}
        </div>

        {/* Hours by Year */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginLeft: 'auto' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B6A65', display: 'flex', gap: 8 }}>
            <span>Base: {hoursByYear.base}</span>
            {optionYears >= 1 && <span>OY1: {hoursByYear.oy1}</span>}
            {optionYears >= 2 && <span>OY2: {hoursByYear.oy2}</span>}
            {optionYears >= 3 && <span>OY3: {hoursByYear.oy3}</span>}
            {optionYears >= 4 && <span>OY4: {hoursByYear.oy4}</span>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#111110' }}>
            Total: {totalHours.toLocaleString()} hrs
          </div>
        </div>

        {/* Status Dot */}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, flexShrink: 0, marginLeft: 8 }} title={status.label} />
      </div>

      {/* Tasks Panel (expanded) */}
      {isExpanded && (
        <div style={{ background: '#FAFAF9', borderTop: '0.5px solid #F4F3EF' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '8px 20px 8px 50px', fontSize: 11, color: '#C4C3BE', fontStyle: 'italic' }}>
              No tasks defined
            </div>
          ) : (
            tasks.map(task => {
              // Find the labor estimate for this task to get hoursByPeriod
              const laborEst = element.laborEstimates?.find(le => le.id === task.id)
              const h = laborEst?.hoursByPeriod || { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 }
              return (
                <div key={task.id} className="flex items-center" style={{ borderBottom: '0.5px solid #F0EDE6', padding: '8px 20px 8px 50px', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#5F5E5A', flex: 1 }}>{task.name}</span>
                  {task.role && (
                    <span style={{ fontSize: 10, fontWeight: 500, background: '#F4F3EF', color: '#5F5E5A', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      {task.role}
                    </span>
                  )}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B6A65', display: 'flex', gap: 6 }}>
                    <span>B:{h.base}</span>
                    {optionYears >= 1 && <span>O1:{h.option1}</span>}
                    {optionYears >= 2 && <span>O2:{h.option2}</span>}
                    {optionYears >= 3 && <span>O3:{h.option3}</span>}
                    {optionYears >= 4 && <span>O4:{h.option4}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#111110', minWidth: 50, textAlign: 'right' }}>
                    {task.hours.toLocaleString()} hrs
                  </span>
                </div>
              )
            })
          )}
          <div
            className="cursor-pointer hover:text-gray-900"
            style={{ padding: '6px 20px 6px 50px', fontSize: 11, color: '#C4C3BE' }}
            onClick={() => {}}
          >
            + Add task
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== DETAIL SLIDEOUT ====================

// LOE type config for badges
const LOE_TYPES: Record<string, { bg: string; text: string; label: string }> = {
  development: { bg: '#E6F1FB', text: '#042C53', label: 'Dev' },
  configuration: { bg: '#F4F3EF', text: '#5F5E5A', label: 'Config' },
  integration: { bg: '#E1F5EE', text: '#085041', label: 'Integration' },
  testing: { bg: '#FAEEDA', text: '#633806', label: 'QA' },
  documentation: { bg: '#F4F3EF', text: '#5F5E5A', label: 'Docs' },
  management: { bg: '#F4F3EF', text: '#5F5E5A', label: 'PM' },
  research: { bg: '#EEEDFE', text: '#26215C', label: 'Research' },
  design: { bg: '#FBEAF0', text: '#4B1528', label: 'Design' },
}

const ESTIMATION_TYPES = [
  { value: 'engineering_estimate', label: 'Engineering Estimate — calculated from known technical scope' },
  { value: 'loe', label: 'Level of Effort — ongoing support work' },
  { value: 'historical', label: 'Historical — based on similar past work' },
  { value: 'parametric', label: 'Parametric — formula-based estimate' },
  { value: 'analogy', label: 'Analogy — based on a comparable project' },
]

function DetailSlideout({
  element, allElements, requirements, optionYears, availableRoles, onUpdate, onDelete, onClose,
}: {
  element: WBSElementData
  allElements: WBSElementData[]
  requirements: { id: string; referenceNumber?: string; reference_number?: string; title: string }[]
  optionYears: number
  availableRoles: string[]
  onUpdate: (updates: Partial<WBSElementData>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  // Trigger save status indicator on blur
  const triggerSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaveStatus('saving')
    saveTimeout.current = setTimeout(() => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 300)
  }, [])

  const tasks = getTasksFromLabor(element)
  const extEl = element as WBSElementData & {
    estimationType?: string; basisOfEstimate?: string; historicalReference?: string
    requirementLinks?: string[]; tasks?: WBSTask[]
  }
  const reqLinks = extEl.requirementLinks || []
  const rawDeps = (element as WBSElementData & { dependencies?: (string | { id: string; predecessorWbsId: string })[] }).dependencies || []
  const deps: string[] = rawDeps.map(d => typeof d === 'string' ? d : d.predecessorWbsId || d.id).filter(Boolean)

  return (
    <div className="shrink-0 flex flex-col" style={{ width: 480, borderLeft: '0.5px solid #E8E7E2', background: '#FFFFFF' }}>
      {/* Panel Header */}
      <div className="shrink-0 flex items-center" style={{ height: 48, borderBottom: '0.5px solid #E8E7E2', padding: '0 16px', gap: 8 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6A65' }}>{element.wbsNumber}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111110', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{element.title}</span>
        <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
          <X className="w-4 h-4" style={{ color: '#6B6A65' }} />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
        {/* 1. Name & Description */}
        <SectionLabel>Name & Description</SectionLabel>
        <div className="space-y-3">
          <Input
            value={element.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onBlur={triggerSave}
            className="text-sm font-medium"
          />
          <Textarea
            value={element.description || element.why || ''}
            onChange={(e) => onUpdate({ description: e.target.value, why: e.target.value })}
            onBlur={triggerSave}
            placeholder="Describe the scope of this work package..."
            rows={3}
            className="text-sm"
          />
        </div>

        <SectionDivider />

        {/* 2. Linked Requirements */}
        <SectionLabel>Requirements</SectionLabel>
        {reqLinks.length === 0 ? (
          <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>— No requirements linked —</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {reqLinks.map(reqId => {
              const req = requirements.find(r => r.id === reqId)
              const ref = req?.referenceNumber || req?.reference_number || reqId.slice(0, 7)
              return (
                <span key={reqId} style={{ fontSize: 9, fontWeight: 600, background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5', padding: '2px 6px', borderRadius: 3 }}>
                  {ref}
                </span>
              )
            })}
          </div>
        )}

        <SectionDivider />

        {/* 3. Tasks (with LOE badges and per-year hours) */}
        <SectionLabel>Tasks</SectionLabel>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>No tasks yet</div>
        ) : (
          <div className="space-y-2">
            {/* Year labels header */}
            <div className="flex items-center gap-2" style={{ paddingLeft: 0 }}>
              <span style={{ flex: 1 }} />
              <span style={{ width: 44, fontSize: 9, fontWeight: 600, color: '#6B6A65', textAlign: 'center' }}>Base</span>
              {optionYears >= 1 && <span style={{ width: 44, fontSize: 9, fontWeight: 600, color: '#6B6A65', textAlign: 'center' }}>OY1</span>}
              {optionYears >= 2 && <span style={{ width: 44, fontSize: 9, fontWeight: 600, color: '#6B6A65', textAlign: 'center' }}>OY2</span>}
              {optionYears >= 3 && <span style={{ width: 44, fontSize: 9, fontWeight: 600, color: '#6B6A65', textAlign: 'center' }}>OY3</span>}
              {optionYears >= 4 && <span style={{ width: 44, fontSize: 9, fontWeight: 600, color: '#6B6A65', textAlign: 'center' }}>OY4</span>}
            </div>
            {tasks.map(task => {
              const loe = LOE_TYPES[(task as WBSTask & { loeType?: string }).loeType || 'development'] || LOE_TYPES.development
              // Find the labor estimate for this task to get hoursByPeriod
              const laborEst = element.laborEstimates?.find(le => le.id === task.id)
              const hoursByPeriod = laborEst?.hoursByPeriod || { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 }

              const handleHoursChange = (period: 'base' | 'option1' | 'option2' | 'option3' | 'option4', value: number) => {
                const updatedLaborEstimates = (element.laborEstimates || []).map(le => {
                  if (le.id === task.id) {
                    return { ...le, hoursByPeriod: { ...le.hoursByPeriod, [period]: value } }
                  }
                  return le
                })
                onUpdate({ laborEstimates: updatedLaborEstimates })
              }

              const handleRoleChange = (newRole: string) => {
                const updatedLaborEstimates = (element.laborEstimates || []).map(le => {
                  if (le.id === task.id) {
                    return { ...le, roleName: newRole }
                  }
                  return le
                })
                onUpdate({ laborEstimates: updatedLaborEstimates })
              }

              // Check if current role is in availableRoles or is custom
              const isCustomRole = task.role && !availableRoles.includes(task.role)

              return (
                <div key={task.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm" style={{ color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, background: loe.bg, color: loe.text, padding: '2px 6px', borderRadius: 3, flexShrink: 0 }} title={(task as WBSTask & { loeType?: string }).loeType || 'development'}>
                    {loe.label}
                  </span>
                  <select
                    value={isCustomRole ? '__custom__' : (task.role || '')}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        const customRole = prompt('Enter custom role name:')
                        if (customRole) handleRoleChange(customRole)
                      } else {
                        handleRoleChange(e.target.value)
                      }
                      triggerSave()
                    }}
                    style={{ width: 120, height: 24, fontSize: 10, fontWeight: 500, background: '#F4F3EF', color: '#5F5E5A', padding: '0 4px', borderRadius: 3, border: '0.5px solid #E8E7E2', flexShrink: 0 }}
                  >
                    <option value="">Select role...</option>
                    {availableRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                    <option value="__custom__">{isCustomRole ? `Other: ${task.role}` : 'Other...'}</option>
                  </select>
                  <input
                    type="number"
                    value={hoursByPeriod.base}
                    onChange={(e) => handleHoursChange('base', parseInt(e.target.value) || 0)}
                    onBlur={triggerSave}
                    style={{ width: 44, height: 28, fontSize: 11, textAlign: 'center', border: '0.5px solid #E8E7E2', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}
                  />
                  {optionYears >= 1 && (
                    <input
                      type="number"
                      value={hoursByPeriod.option1}
                      onChange={(e) => handleHoursChange('option1', parseInt(e.target.value) || 0)}
                      onBlur={triggerSave}
                      style={{ width: 44, height: 28, fontSize: 11, textAlign: 'center', border: '0.5px solid #E8E7E2', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  )}
                  {optionYears >= 2 && (
                    <input
                      type="number"
                      value={hoursByPeriod.option2}
                      onChange={(e) => handleHoursChange('option2', parseInt(e.target.value) || 0)}
                      onBlur={triggerSave}
                      style={{ width: 44, height: 28, fontSize: 11, textAlign: 'center', border: '0.5px solid #E8E7E2', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  )}
                  {optionYears >= 3 && (
                    <input
                      type="number"
                      value={hoursByPeriod.option3}
                      onChange={(e) => handleHoursChange('option3', parseInt(e.target.value) || 0)}
                      onBlur={triggerSave}
                      style={{ width: 44, height: 28, fontSize: 11, textAlign: 'center', border: '0.5px solid #E8E7E2', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  )}
                  {optionYears >= 4 && (
                    <input
                      type="number"
                      value={hoursByPeriod.option4}
                      onChange={(e) => handleHoursChange('option4', parseInt(e.target.value) || 0)}
                      onBlur={triggerSave}
                      style={{ width: 44, height: 28, fontSize: 11, textAlign: 'center', border: '0.5px solid #E8E7E2', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <SectionDivider />

        {/* 4. Estimation Method */}
        <SectionLabel>Estimation method</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>How were hours determined? Required for BOE export.</div>
        <select
          value={extEl.estimationType || 'engineering_estimate'}
          onChange={(e) => { onUpdate({ estimationType: e.target.value } as Partial<WBSElementData>); triggerSave() }}
          style={{ width: '100%', height: 34, fontSize: 13, color: '#111110', border: '0.5px solid #E8E7E2', borderRadius: 6, padding: '0 10px' }}
        >
          {ESTIMATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {extEl.estimationType === 'historical' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 4 }}>Historical reference</div>
            <Input
              value={extEl.historicalReference || ''}
              onChange={(e) => onUpdate({ historicalReference: e.target.value } as Partial<WBSElementData>)}
              onBlur={triggerSave}
              placeholder="e.g. DoS Doorway — Authentication module, 2023"
              className="text-sm"
            />
          </div>
        )}

        <SectionDivider />

        {/* 5. Basis of Estimate */}
        <SectionLabel>Basis of estimate</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>Narrative explaining how hours were derived. Appears in BOE export.</div>
        <Textarea
          value={extEl.basisOfEstimate || ''}
          onChange={(e) => onUpdate({ basisOfEstimate: e.target.value } as Partial<WBSElementData>)}
          onBlur={triggerSave}
          placeholder="Explain how hours were determined. Reference specific requirements, past projects, team velocity, sprint assumptions, or other supporting rationale."
          rows={4}
          className="text-sm"
        />

        <SectionDivider />

        {/* 6. Assumptions */}
        <SectionLabel>Assumptions</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>Conditions that must be true for this estimate to hold. Included in BOE export.</div>
        {(element.assumptions || []).length === 0 ? (
          <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>No assumptions</div>
        ) : (
          <div className="space-y-1.5">
            {(element.assumptions || []).map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: '#5F5E5A', padding: '4px 8px', background: '#FAFAF9', borderRadius: 4 }}>
                {a}
              </div>
            ))}
          </div>
        )}

        <SectionDivider />

        {/* 7. Charge Codes (per-task) */}
        <SectionLabel>Charge Codes</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>Used for Unanet timesheet entry</div>
        {tasks.length === 0 ? (
          <Input placeholder="e.g. CAMP-01-DEV" className="font-mono text-sm" />
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#5F5E5A', minWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
                <Input placeholder={`CAMP-${element.wbsNumber}-${(task.role || 'GEN').slice(0, 3).toUpperCase()}`} className="font-mono text-xs flex-1" style={{ height: 28 }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#C4C3BE', fontStyle: 'italic', marginTop: 8 }}>
          Charge codes from past proposals will appear here for reference
        </div>

        <SectionDivider />

        {/* 8. Dependencies */}
        <SectionLabel>Dependencies</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>WBS elements that must complete before this work begins.</div>
        {deps.length === 0 ? (
          <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>None</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {deps.map(depId => {
              const dep = allElements.find(e => e.id === depId)
              return dep ? (
                <span key={depId} style={{ fontSize: 10, fontWeight: 500, background: '#F4F3EF', color: '#5F5E5A', padding: '2px 8px', borderRadius: 3 }}>
                  {dep.wbsNumber} · {dep.title}
                </span>
              ) : null
            })}
          </div>
        )}

        <SectionDivider />

        {/* 9. Notes */}
        <SectionLabel>Notes</SectionLabel>
        <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 8 }}>Visible to directors with collaboration links</div>
        <Textarea
          value={element.notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          onBlur={triggerSave}
          placeholder="Internal notes about this work package..."
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Panel Footer */}
      <div className="shrink-0 flex items-center justify-between" style={{ height: 52, borderTop: '0.5px solid #E8E7E2', padding: '0 16px' }}>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: '#A32D2D' }}>Delete this element?</span>
            <button onClick={onDelete} style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Yes, delete</button>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
            Delete element
          </button>
        )}
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#6B6A65' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BA7517' }} />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#639922' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#639922' }} />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#A32D2D' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A32D2D' }} />
              Failed to save
            </span>
          )}
          <button onClick={onClose} style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: '0.5px solid #E8E7E2', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== DIRECTOR BANNER ====================

function DirectorBanner({ session }: { session: CollabSession }) {
  const [now] = useState(() => new Date())
  const isExpired = session.status === 'expired' || new Date(session.expires_at) < now
  const daysRemaining = Math.max(0, Math.ceil((new Date(session.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const initials = session.reviewer_name.charAt(0).toUpperCase()

  return (
    <div
      style={{
        background: isExpired ? '#FEFCFC' : '#FBF9F0',
        border: `0.5px solid ${isExpired ? 'rgba(163,45,45,0.3)' : 'rgba(245,194,0,0.3)'}`,
        borderLeft: `2px solid ${isExpired ? '#A32D2D' : '#F5C200'}`,
        borderRadius: '0 7px 7px 0',
        padding: '10px 14px',
        margin: '10px 16px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#111110', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: '#5F5E5A' }}>
        {isExpired ? (
          <><strong style={{ fontWeight: 600, color: '#111110' }}>{session.reviewer_name}</strong>&apos;s director link has expired</>
        ) : (
          <><strong style={{ fontWeight: 600, color: '#111110' }}>{session.reviewer_name}</strong> has been sent a director link to assign hours · Expires in {daysRemaining} days</>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: isExpired ? '#A32D2D' : '#111110', cursor: 'pointer' }}>
        {isExpired ? 'Send new link →' : 'Resend →'}
      </span>
    </div>
  )
}

// ==================== SHARED ATOMS ====================

function StatItem({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#111110' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B6A65' }}>{label}</div>
    </div>
  )
}

function VerticalDivider() {
  return <div style={{ width: 0.5, height: 20, background: '#E8E7E2', margin: '0 12px' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C4C3BE', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function SectionDivider() {
  return <div style={{ borderTop: '0.5px solid #E8E7E2', margin: '16px 0' }} />
}
