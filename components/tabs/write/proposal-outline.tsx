'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext, type OutlineSection, type OutlineSubsection, type OutlineVolume, type OutlineSectionStatus, type ProposalOutline } from '@/contexts/app-context'
import { FileDown, Sparkles, ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

// ==================== STATUS COLORS ====================

const STATUS_COLORS: Record<OutlineSectionStatus, string> = {
  draft: '#639922',
  review: '#378ADD',
  in_progress: '#F5C200',
  not_started: '#C4C3BE',
}

// Get completion color based on word count percentage
function getCompletionColor(wordCount: number, targetWordCount: number | null): string {
  if (!targetWordCount || targetWordCount === 0) return '#C4C3BE' // gray - no target
  const pct = (wordCount / targetWordCount) * 100
  if (pct >= 100) return '#639922' // green - complete
  if (pct >= 50) return '#F5C200' // yellow - in progress
  if (pct > 0) return '#BA7517' // orange - started
  return '#C4C3BE' // gray - not started
}

// ==================== MAIN COMPONENT ====================

export function ProposalOutlinePage() {
  const params = useParams()
  const proposalId = params?.id as string
  const { outline, setOutline, sectionContent, proposalSetup } = useAppContext()
  const wordsPerPage = proposalSetup?.wordsPerPage || 500
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set(outline?.volumes.map(v => v.id) || []))
  const [isGenerating, setIsGenerating] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)

  // Calculate stats from outline
  const allSections: OutlineSection[] = []
  outline?.volumes.forEach(v => {
    v.sections.forEach(s => {
      allSections.push(s)
    })
  })

  const volumeCount = outline?.volumes.length || 0
  const sectionCount = allSections.length
  const draftedCount = allSections.filter(s => s.status === 'draft').length
  const inProgressCount = allSections.filter(s => s.status === 'in_progress').length
  const notStartedCount = allSections.filter(s => s.status === 'not_started').length

  const toggleVolume = (id: string) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const collapseAll = () => setExpandedVolumes(new Set())

  const handleGenerate = () => {
    if (outline?.volumes && outline.volumes.length > 0) {
      setShowRegenerateConfirm(true)
      return
    }
    doGenerate()
  }

  const doGenerate = async () => {
    setShowRegenerateConfirm(false)
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/generate-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Generation failed')
        return
      }
      const { outline: generated } = await res.json() as { outline: ProposalOutline }
      setOutline(generated)
      // Expand all new volumes
      setExpandedVolumes(new Set(generated.volumes.map(v => v.id)))
      const totalSecs = generated.volumes.reduce((sum, v) => sum + v.sections.length, 0)
      toast.success(`Outline generated — ${generated.volumes.length} volumes, ${totalSecs} sections`)
    } catch {
      toast.error('Generation failed — try again')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* PAGE HEADER */}
      <div className="shrink-0" style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E7E2' }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#C4C3BE',
          marginBottom: 6,
        }}>
          Write &middot; Outline
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#111110',
          letterSpacing: -0.5,
          marginBottom: 14,
        }}>
          How is this proposal structured?
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ paddingBottom: 14 }}>
          <StatItem value={volumeCount} label="volumes" color="#111110" />
          <HeaderDivider />
          <StatItem value={sectionCount} label="sections" color="#111110" />
          <HeaderDivider />
          <StatItem value={draftedCount} label="drafted" color="#639922" />
          <HeaderDivider />
          <StatItem value={inProgressCount} label="in progress" color="#BA7517" />
          <HeaderDivider />
          <StatItem value={notStartedCount} label="not started" color="#9B9A95" />

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: '#5F5E5A',
                background: 'transparent',
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Export outline
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: '#111110',
                background: '#F5C200',
                border: 'none',
                borderRadius: 6,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Generating...' : 'Generate from Section L'}
            </button>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{
          background: '#FAFAF9',
          borderBottom: '0.5px solid #F4F3EF',
          padding: '10px 20px',
        }}
      >
        {/* Legend */}
        <div className="flex items-center gap-3" style={{ fontSize: 10, color: '#6B6A65' }}>
          <LegendItem color="#639922" label="Drafted" />
          <LegendItem color="#378ADD" label="In review" />
          <LegendItem color="#F5C200" label="In progress" />
          <LegendItem color="#C4C3BE" label="Not started" />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={collapseAll}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#5F5E5A',
              background: 'none',
              border: '0.5px solid #E8E7E2',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            Collapse all
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              color: '#5F5E5A',
              background: 'none',
              border: '0.5px solid #E8E7E2',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            <Plus className="w-3 h-3" />
            Add section
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      {isGenerating ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid rgba(245,194,0,0.2)',
              borderTopColor: '#F5C200',
              borderRadius: '50%',
            }}
            className="animate-spin"
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111110' }}>
            Generating outline from Section L...
          </div>
          <div style={{ fontSize: 12, color: '#9B9A95' }}>
            Reading compliance requirements and building your proposal structure
          </div>
        </div>
      ) : volumeCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FileText className="w-7 h-7" style={{ color: '#C4C3BE' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>No outline yet</div>
          <div style={{ fontSize: 12, color: '#6B6A65', textAlign: 'center', maxWidth: 340 }}>
            Generate the outline from your compliance matrix, or build it manually section by section.
          </div>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: '#111110',
                background: '#F5C200',
                border: 'none',
                borderRadius: 6,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Generating...' : 'Generate from Section L'}
            </button>
            <button
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: '#5F5E5A',
                background: 'transparent',
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Add manually
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {outline!.volumes.map(volume => (
            <VolumeBlock
              key={volume.id}
              volume={volume}
              expanded={expandedVolumes.has(volume.id)}
              onToggle={() => toggleVolume(volume.id)}
              proposalId={proposalId}
              outline={outline!}
              setOutline={setOutline}
              sectionContent={sectionContent}
              wordsPerPage={wordsPerPage}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={showRegenerateConfirm}
        title="Regenerate outline?"
        body="This will replace your existing outline. Section content already written will not be affected."
        confirmLabel="Yes, regenerate"
        destructive
        onConfirm={doGenerate}
        onCancel={() => setShowRegenerateConfirm(false)}
      />
    </div>
  )
}

// ==================== VOLUME BLOCK ====================

interface SectionContentMap {
  [sectionId: string]: {
    wordCount?: number
    content?: string
  }
}

function VolumeBlock({ volume, expanded, onToggle, proposalId, outline, setOutline, sectionContent, wordsPerPage }: { volume: OutlineVolume; expanded: boolean; onToggle: () => void; proposalId: string; outline: ProposalOutline; setOutline: (o: ProposalOutline | null) => void; sectionContent: SectionContentMap; wordsPerPage: number }) {
  const totalSections = volume.sections.length

  // Calculate progress based on word count completion
  let completedSections = 0
  volume.sections.forEach(s => {
    const content = sectionContent[s.id]
    const wordCount = content?.wordCount || 0
    const targetWordCount = s.pageTarget ? s.pageTarget * wordsPerPage : 0
    if (targetWordCount > 0 && wordCount >= targetWordCount) {
      completedSections++
    }
  })
  const progressPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0

  return (
    <div style={{ borderBottom: '0.5px solid #E8E7E2' }}>
      {/* Volume header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2.5"
        style={{
          padding: '12px 20px',
          background: '#FAFAF9',
          borderBottom: expanded ? '0.5px solid #E8E7E2' : 'none',
          cursor: 'pointer',
        }}
      >
        {/* Toggle */}
        <div
          style={{
            width: 16,
            height: 16,
            border: '0.5px solid #E8E7E2',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {expanded
            ? <ChevronDown className="w-3 h-3" style={{ color: '#6B6A65' }} />
            : <ChevronRight className="w-3 h-3" style={{ color: '#6B6A65' }} />
          }
        </div>

        {/* Title */}
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#5F5E5A' }}>
          {volume.title}
        </span>

        {/* Meta */}
        <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
          {volume.maxPages && (
            <span style={{ fontSize: 10, color: '#6B6A65' }}>
              Max {volume.maxPages} pages{volume.complianceRef ? ` · per ${volume.complianceRef}` : ''}
            </span>
          )}
          {/* Progress bar */}
          <div style={{ width: 80, height: 4, background: '#F0EDE6', borderRadius: 2, position: 'relative' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: '#639922', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#639922', minWidth: 28, textAlign: 'right' }}>
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Sections */}
      {expanded && volume.sections.map(section => (
        <div key={section.id}>
          <SectionRow section={section} proposalId={proposalId} outline={outline!} setOutline={setOutline} sectionContent={sectionContent} wordsPerPage={wordsPerPage} />
          {section.subsections.map(sub => (
            <SubsectionRow key={sub.id} subsection={sub} parentSection={section} proposalId={proposalId} outline={outline} setOutline={setOutline} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ==================== SECTION ROW ====================

function SectionRow({ section, proposalId, outline, setOutline, sectionContent, wordsPerPage }: { section: OutlineSection; proposalId: string; outline: ProposalOutline; setOutline: (o: ProposalOutline | null) => void; sectionContent: SectionContentMap; wordsPerPage: number }) {
  const router = useRouter()
  const allRefs = [...section.complianceRefs, ...section.requirementRefs]
  const visibleRefs = allRefs.slice(0, 4)
  const moreCount = allRefs.length - visibleRefs.length

  // Get word count from section content
  const content = sectionContent[section.id]
  const wordCount = content?.wordCount || 0
  const targetWordCount = section.pageTarget ? section.pageTarget * wordsPerPage : 0
  const completionPct = targetWordCount > 0 ? Math.round((wordCount / targetWordCount) * 100) : 0

  // Use completion-based color if there's a target, otherwise use status color
  const dotColor = targetWordCount > 0
    ? getCompletionColor(wordCount, targetWordCount)
    : STATUS_COLORS[section.status]

  return (
    <div
      className="flex items-start gap-3"
      style={{
        padding: '12px 20px 12px 36px',
        borderBottom: '0.5px solid #F4F3EF',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAF8' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
    >
      {/* Completion dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: dotColor,
        flexShrink: 0,
        marginTop: 4,
      }} />

      {/* Section number */}
      <span style={{
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        color: '#9B9A95',
        width: 36,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {section.number}
      </span>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>
          {section.title}
        </div>
        {section.description && (
          <div style={{ fontSize: 11, color: '#6B6A65', lineHeight: 1.4, margin: '3px 0 6px' }}>
            {section.description}
          </div>
        )}
        {allRefs.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginTop: section.description ? 0 : 6 }}>
            {visibleRefs.map((ref, i) => {
              const isCompliance = i < section.complianceRefs.length
              return (
                <span
                  key={ref}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: isCompliance ? '#E6F1FB' : '#E1F5EE',
                    color: isCompliance ? '#042C53' : '#085041',
                    border: `0.5px solid ${isCompliance ? '#85B7EB' : '#5DCAA5'}`,
                  }}
                >
                  {ref}
                </span>
              )
            })}
            {moreCount > 0 && (
              <span style={{ fontSize: 9, color: '#9B9A95' }}>+{moreCount} more</span>
            )}
          </div>
        )}
      </div>

      {/* Right meta */}
      <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
        {section.pageTarget && (
          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div style={{ width: 48, height: 4, background: '#F0EDE6', borderRadius: 2 }}>
              <div style={{
                width: `${Math.min(completionPct, 100)}%`,
                height: '100%',
                background: dotColor,
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 10, color: dotColor, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
              {completionPct}%
            </span>
          </div>
        )}
        {section.assignee && (
          <div style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#F0EDE6',
            color: '#5F5E5A',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {section.assignee}
          </div>
        )}
        <button
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#111110',
            padding: '3px 8px',
            border: '0.5px solid #E8E7E2',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F5C200'
            e.currentTarget.style.borderColor = '#F5C200'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff'
            e.currentTarget.style.borderColor = '#E8E7E2'
          }}
          onClick={(e) => {
            e.stopPropagation()
            // Mark as in_progress if not started
            if (section.status === 'not_started') {
              const updated: ProposalOutline = {
                volumes: outline.volumes.map(v => ({
                  ...v,
                  sections: v.sections.map(s =>
                    s.id === section.id ? { ...s, status: 'in_progress' as const } : s
                  ),
                })),
              }
              setOutline(updated)
            }
            router.push(`/${proposalId}?tab=write&view=technical-editor&sectionId=${section.id}&sectionTitle=${encodeURIComponent(section.title)}`)
          }}
        >
          Open &rarr;
        </button>
      </div>
    </div>
  )
}

// ==================== SUBSECTION ROW ====================

function SubsectionRow({ subsection, parentSection, proposalId, outline, setOutline }: { subsection: OutlineSubsection; parentSection: OutlineSection; proposalId: string; outline: ProposalOutline; setOutline: (o: ProposalOutline | null) => void }) {
  const router = useRouter()

  // Cycle through statuses on click
  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    const statusOrder: OutlineSectionStatus[] = ['not_started', 'in_progress', 'draft']
    const currentIndex = statusOrder.indexOf(subsection.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]

    // Update subsection status
    const updated: ProposalOutline = {
      volumes: outline.volumes.map(v => ({
        ...v,
        sections: v.sections.map(s => {
          if (s.id !== parentSection.id) return s
          const updatedSubs = s.subsections.map(sub =>
            sub.id === subsection.id ? { ...sub, status: nextStatus } : sub
          )
          // Derive parent status from children
          const parentStatus = updatedSubs.every(sub => sub.status === 'draft')
            ? 'draft' as const
            : updatedSubs.some(sub => sub.status === 'in_progress' || sub.status === 'draft')
              ? 'in_progress' as const
              : 'not_started' as const
          return { ...s, subsections: updatedSubs, status: parentStatus }
        }),
      })),
    }
    setOutline(updated)

    // Persist to DB
    fetch(`/api/proposals/${proposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ working_data: { outline: updated } }),
    }).catch(err => console.error('[SubsectionRow] Failed to save status:', err))
  }

  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '9px 20px 9px 56px',
        borderBottom: '0.5px solid #F4F3EF',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAF8' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
      onClick={() => {
        router.push(`/${proposalId}?tab=write&view=technical-editor&sectionId=${parentSection.id}&sectionTitle=${encodeURIComponent(parentSection.title)}&anchor=${subsection.id}`)
      }}
    >
      {/* Status dot - clickable to cycle */}
      <div
        onClick={cycleStatus}
        title="Click to change status"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: STATUS_COLORS[subsection.status],
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.4)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      />

      {/* Number */}
      <span style={{
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
        color: '#C4C3BE',
        width: 44,
        flexShrink: 0,
      }}>
        {subsection.number}
      </span>

      {/* Title */}
      <span style={{ flex: 1, fontSize: 12, color: '#5F5E5A' }}>
        {subsection.title}
      </span>

      {/* Page target */}
      {subsection.pageTarget && (
        <span style={{ fontSize: 10, color: '#C4C3BE', whiteSpace: 'nowrap' }}>
          {subsection.pageTarget} pages
        </span>
      )}
    </div>
  )
}

// ==================== HELPER COMPONENTS ====================

function StatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6B6A65' }}>{label}</span>
    </div>
  )
}

function HeaderDivider() {
  return <div style={{ width: 0.5, height: 20, background: '#E8E7E2' }} />
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span>{label}</span>
    </div>
  )
}
