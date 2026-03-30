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
    if (wbsElements.length > 0) {
      if (!confirm(`This will replace your ${wbsElements.length} existing work packages. Continue?`)) return
    }
    setIsGenerating(true)
    try {
      // Call the existing generate-wbs API
      const response = await fetch('/api/generate-wbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements: extractedRequirements.map((r: { id: string; title: string; text?: string; description?: string; type: string; referenceNumber?: string; source?: string; sourceSection?: string; category?: string }) => ({
            id: r.id,
            referenceNumber: r.referenceNumber || r.id,
            title: r.title,
            description: r.description || r.text || '',
            type: r.type || 'shall',
            category: r.category || 'other',
            source: r.source || r.sourceSection || '',
          })),
          availableRoles: [],
          existingWbsNumbers: [],
          contractContext: {
            title: 'Government Contract',
            agency: '',
            contractType: 'tm',
            periodOfPerformance: { baseYear: true, optionYears: 2 },
          },
        }),
      })
      if (!response.ok) throw new Error('Generation failed')
      const data = await response.json()

      if (data.wbsElements) {
        const mapped = data.wbsElements.map((el: { wbsNumber: string; title: string; why: string; what: string; assumptions: string[]; laborEstimates: unknown[] }, i: number) => ({
          id: `wbs-${crypto.randomUUID()}`,
          wbsNumber: el.wbsNumber || `${i + 1}.0`,
          title: el.title,
          description: el.why || '',
          why: el.why || '',
          what: el.what || '',
          assumptions: el.assumptions || [],
          laborEstimates: el.laborEstimates || [],
          dependencies: [],
        }))
        setEstimateWbsElements(mapped as never)
        toast.success(`${mapped.length} work packages generated · Review and adjust as needed`)
      }
    } catch {
      toast.error('Generation failed · Try again')
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
              Generate from RFP
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
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111110', marginTop: 12 }}>Generating work packages from RFP...</div>
              <div style={{ fontSize: 12, color: '#6B6A65', marginTop: 4 }}>Reading requirements and building work breakdown structure</div>
            </div>
          ) : wbsElements.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <EmptyState
                icon={Layers}
                title="No work packages yet"
                description="Generate from the RFP or add manually. Work packages define what gets built and who builds it."
                action={{ label: 'Generate from RFP', onClick: handleGenerate }}
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
  element, isExpanded, onToggle, onSelect, requirements,
}: {
  element: WBSElementData
  isExpanded: boolean
  onToggle: () => void
  onSelect: () => void
  requirements: { id: string; referenceNumber?: string; reference_number?: string }[]
}) {
  const totalHours = getTotalHours(element)
  const tasks = getTasksFromLabor(element)
  const status = getStatusDot(element, 0)

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
          {isExpanded ? <ChevronDown className="w-2.5 h-2.5" style={{ color: '#9B9A95' }} /> : <ChevronRight className="w-2.5 h-2.5" style={{ color: '#9B9A95' }} />}
        </button>

        {/* WBS Number */}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#9B9A95', flexShrink: 0, width: 52 }}>
          {element.wbsNumber}
        </span>

        {/* Element Name */}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111110', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {element.title}
        </span>

        {/* Requirement Chips */}
        <div className="flex gap-1 flex-wrap" style={{ maxWidth: 200 }}>
          {/* Placeholder — requirements linking will show chips here */}
          <span style={{ fontSize: 10, fontStyle: 'italic', color: '#C4C3BE' }}>No reqs linked</span>
        </div>

        {/* Hours */}
        <div style={{ minWidth: 60, textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: 4, marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111110' }}>{totalHours.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#9B9A95' }}>hrs</span>
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
            tasks.map(task => (
              <div key={task.id} className="flex items-center" style={{ borderBottom: '0.5px solid #F0EDE6', padding: '8px 20px 8px 50px', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#5F5E5A', flex: 1 }}>{task.name}</span>
                {task.role && (
                  <span style={{ fontSize: 10, fontWeight: 500, background: '#F4F3EF', color: '#5F5E5A', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                    {task.role}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111110', minWidth: 60, textAlign: 'right' }}>
                  {task.hours.toLocaleString()} hrs
                </span>
              </div>
            ))
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

function DetailSlideout({
  element, allElements, requirements, onUpdate, onDelete, onClose,
}: {
  element: WBSElementData
  allElements: WBSElementData[]
  requirements: { id: string; referenceNumber?: string; reference_number?: string; title: string }[]
  onUpdate: (updates: Partial<WBSElementData>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  const debouncedUpdate = useCallback((updates: Partial<WBSElementData>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => onUpdate(updates), 500)
  }, [onUpdate])

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{ width: 480, borderLeft: '0.5px solid #E8E7E2', background: '#FFFFFF' }}
    >
      {/* Panel Header */}
      <div className="shrink-0 flex items-center" style={{ height: 48, borderBottom: '0.5px solid #E8E7E2', padding: '0 16px', gap: 8 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#9B9A95' }}>{element.wbsNumber}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111110', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{element.title}</span>
        <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
          <X className="w-4 h-4" style={{ color: '#9B9A95' }} />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
        {/* 1. Name & Description */}
        <SectionLabel>Name & Description</SectionLabel>
        <div className="space-y-3">
          <Input
            value={element.title}
            onChange={(e) => debouncedUpdate({ title: e.target.value })}
            className="text-sm font-medium"
          />
          <Textarea
            value={element.description || element.why || ''}
            onChange={(e) => debouncedUpdate({ description: e.target.value, why: e.target.value })}
            placeholder="Describe the scope of this work package..."
            rows={3}
            className="text-sm"
          />
        </div>

        <SectionDivider />

        {/* 2. Linked Requirements */}
        <SectionLabel>Requirements</SectionLabel>
        <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>— No requirements linked —</div>
        <button style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>
          + Link requirement
        </button>

        <SectionDivider />

        {/* 3. Tasks */}
        <SectionLabel>Tasks</SectionLabel>
        {getTasksFromLabor(element).length === 0 ? (
          <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>No tasks yet</div>
        ) : (
          <div className="space-y-2">
            {getTasksFromLabor(element).map(task => (
              <div key={task.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{task.name}</span>
                {task.role && <span style={{ fontSize: 10, background: '#F4F3EF', color: '#5F5E5A', padding: '1px 6px', borderRadius: 3 }}>{task.role}</span>}
                <span className="text-sm font-medium" style={{ minWidth: 50, textAlign: 'right' }}>{task.hours}h</span>
              </div>
            ))}
          </div>
        )}
        <button style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>
          + Add task
        </button>

        <SectionDivider />

        {/* 4. Charge Codes */}
        <SectionLabel>Charge Codes</SectionLabel>
        <div style={{ fontSize: 11, color: '#9B9A95', marginBottom: 8 }}>Used for Unanet timesheet entry</div>
        <Input
          placeholder="e.g. CAMP-01-DEV"
          className="font-mono text-sm"
          style={{ borderRadius: 5 }}
        />

        <SectionDivider />

        {/* 5. Dependencies */}
        <SectionLabel>Dependencies</SectionLabel>
        <div style={{ fontSize: 11, color: '#9B9A95', marginBottom: 8 }}>WBS elements that must complete before this work begins.</div>
        <div style={{ fontSize: 12, color: '#C4C3BE', fontStyle: 'italic' }}>None</div>

        <SectionDivider />

        {/* 6. Notes */}
        <SectionLabel>Notes</SectionLabel>
        <div style={{ fontSize: 11, color: '#9B9A95', marginBottom: 8 }}>Visible to directors with collaboration links</div>
        <Textarea
          value={element.notes || ''}
          onChange={(e) => debouncedUpdate({ notes: e.target.value })}
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
        <button onClick={onClose} style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: '0.5px solid #E8E7E2', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

// ==================== DIRECTOR BANNER ====================

function DirectorBanner({ session }: { session: CollabSession }) {
  const isExpired = session.status === 'expired' || new Date(session.expires_at) < new Date()
  const daysRemaining = Math.max(0, Math.ceil((new Date(session.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
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
