'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppContext, type SectionContent, type OutlineSection, type OutlineSectionStatus } from '@/contexts/app-context'
import { ArrowLeft } from 'lucide-react'

// ==================== MAIN COMPONENT ====================

interface WriteContentProps {
  sectionId: string
  sectionTitle: string
  onBack: () => void
}

export function WriteContent({ sectionId, sectionTitle, onBack }: WriteContentProps) {
  const { sectionContent, setSectionContent, solicitation, outline, extractedRequirements, estimateWbsElements } = useAppContext()

  // Find section data from outline
  let outlineSection: OutlineSection | null = null
  if (outline) {
    for (const v of outline.volumes) {
      for (const s of v.sections) {
        if (s.id === sectionId) { outlineSection = s; break }
      }
      if (outlineSection) break
    }
  }

  // Find related requirements
  const reqRefs = outlineSection?.requirementRefs || []
  const relatedReqs = (extractedRequirements || []).filter(r => {
    const ref = r.reference_number || r.id
    return reqRefs.includes(ref)
  })

  // Find related WBS elements
  const relatedWbs = (estimateWbsElements || []).filter(el =>
    el.requirementLinks?.some((link: string) =>
      reqRefs.includes(link)
    )
  )

  // Local editor content
  const existing = sectionContent[sectionId]
  const [content, setContent] = useState(existing?.content || '')
  const [lastSaved, setLastSaved] = useState(existing?.lastSaved || '')

  // Calculate time since last save
  const [timeSinceSave, setTimeSinceSave] = useState('')

  useEffect(() => {
    if (!lastSaved) return
    const update = () => {
      const diff = Date.now() - new Date(lastSaved).getTime()
      const mins = Math.floor(diff / 60000)
      setTimeSinceSave(mins < 1 ? 'just now' : `${mins}m ago`)
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [lastSaved])

  // Word count
  const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length

  // Auto-save with debounce
  const save = useCallback((text: string) => {
    const now = new Date().toISOString()
    const updated: SectionContent = {
      sectionId,
      content: text,
      lastSaved: now,
      wordCount: text.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length,
      status: text.trim() ? 'in_progress' : 'not_started',
    }
    setSectionContent({ ...sectionContent, [sectionId]: updated })
    setLastSaved(now)
  }, [sectionId, sectionContent, setSectionContent])

  useEffect(() => {
    if (!content && !existing?.content) return
    const timeout = setTimeout(() => save(content), 1500)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  // Truncate title for breadcrumb
  const displayTitle = sectionTitle.length > 40
    ? sectionTitle.substring(0, 40) + '...'
    : sectionTitle

  const contractType = solicitation?.contractType || 'T&M'
  const contractBadge = contractType === 'FFP' ? 'FFP' : contractType === 'CPFF' ? 'CPFF' : contractType === 'GSA' ? 'GSA' : 'T&M'

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* SIMPLIFIED NAV */}
      <div
        className="shrink-0 flex items-center gap-4"
        style={{
          height: 56,
          padding: '0 20px',
          background: '#FBF9F5',
          borderBottom: '2.5px solid #111110',
        }}
      >
        {/* Left: Wordmark */}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111110', letterSpacing: -0.5 }}>
          TrueBid
        </div>

        {/* Middle: Breadcrumb */}
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#5F5E5A',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Outline
          </button>
          <span style={{ fontSize: 12, color: '#C4C3BE' }}>/</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111110' }}>
            {displayTitle}
          </span>
        </div>

        {/* Right: Auto-save + badge */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 10, color: '#6B6A65' }}>
            {lastSaved ? `Auto-saved ${timeSinceSave}` : 'Not saved yet'}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 3,
              background: '#F0EDE6',
              color: '#5F5E5A',
            }}
          >
            {contractBadge}
          </span>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#111110',
              color: '#F5C200',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            LT
          </div>
        </div>
      </div>

      {/* THREE PANEL LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT CONTEXT PANEL */}
        <ContextPanel
          sectionId={sectionId}
          sectionTitle={sectionTitle}
          outlineSection={outlineSection}
          relatedReqs={relatedReqs}
          relatedWbs={relatedWbs}
          wordCount={wordCount}
          onBack={onBack}
        />

        {/* CENTER EDITOR */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor toolbar placeholder */}
          <div
            className="shrink-0 flex items-center gap-2"
            style={{
              padding: '8px 24px',
              borderBottom: '0.5px solid #F4F3EF',
              background: '#FFFFFF',
            }}
          >
            <span style={{ fontSize: 10, color: '#C4C3BE' }}>
              {wordCount} words
            </span>
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto" style={{ padding: '32px 48px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111110', letterSpacing: -0.5, marginBottom: 16 }}>
              {sectionTitle}
            </h2>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing this section..."
              style={{
                width: '100%',
                minHeight: 400,
                fontSize: 14,
                lineHeight: 1.7,
                color: '#111110',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>
        </div>

        {/* RIGHT COACHING PANEL */}
        <div
          className="shrink-0 overflow-y-auto"
          style={{
            width: 240,
            borderLeft: '0.5px solid #E8E7E2',
            background: '#FAFAF9',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#C4C3BE', marginBottom: 12 }}>
            Writing Coach
          </div>
          <div style={{ fontSize: 11, color: '#6B6A65', lineHeight: 1.5 }}>
            AI writing suggestions and compliance checks will appear here as you write.
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== STATUS CONFIG ====================

const STATUS_BADGE: Record<OutlineSectionStatus, { bg: string; text: string; label: string }> = {
  not_started: { bg: '#F4F3EF', text: '#5F5E5A', label: 'Not started' },
  in_progress: { bg: '#FAEEDA', text: '#412402', label: 'In progress' },
  draft: { bg: '#EAF3DE', text: '#27500A', label: 'Draft' },
  review: { bg: '#E6F1FB', text: '#042C53', label: 'In review' },
}

// ==================== CONTEXT PANEL ====================

function ContextPanel({
  sectionId,
  sectionTitle,
  outlineSection,
  relatedReqs,
  relatedWbs,
  wordCount,
  onBack,
}: {
  sectionId: string
  sectionTitle: string
  outlineSection: OutlineSection | null
  relatedReqs: { id: string; title: string; text: string; reference_number?: string }[]
  relatedWbs: { id: string; ref?: string; wbsNumber?: string; title: string }[]
  wordCount: number
  onBack: () => void
}) {
  const complianceRefs = outlineSection?.complianceRefs || []
  const requirementRefs = outlineSection?.requirementRefs || []
  const pageTarget = outlineSection?.pageTarget || null
  const status = outlineSection?.status || 'not_started'
  const statusConfig = STATUS_BADGE[status]

  const currentPages = wordCount / 250
  const pagePct = pageTarget ? (currentPages / pageTarget) * 100 : 0
  const barColor = pagePct > 100 ? '#A32D2D' : pagePct >= 80 ? '#BA7517' : '#639922'

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        width: 260,
        borderRight: '0.5px solid #E8E7E2',
        background: '#FAFAF9',
      }}
    >
      {/* Panel header */}
      <div className="shrink-0" style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid #E8E7E2' }}>
        <button
          onClick={onBack}
          style={{ fontSize: 11, color: '#9B9A95', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}
        >
          &larr; Back to outline
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111110', letterSpacing: -0.3, lineHeight: 1.3 }}>
          {outlineSection?.number ? `${outlineSection.number} ` : ''}{sectionTitle}
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
          {pageTarget && (
            <span style={{ fontSize: 10, color: '#6B6A65' }}>
              Max {pageTarget} pages
            </span>
          )}
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '1px 5px',
            borderRadius: 3,
            background: statusConfig.bg,
            color: statusConfig.text,
          }}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px' }}>
        {/* Compliance */}
        {complianceRefs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Compliance</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {complianceRefs.map(ref => (
                <span
                  key={ref}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: '#E6F1FB',
                    color: '#042C53',
                    border: '0.5px solid #85B7EB',
                  }}
                >
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Requirements addressed */}
        {requirementRefs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Requirements addressed</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {requirementRefs.slice(0, 6).map(ref => (
                <span
                  key={ref}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: '#E1F5EE',
                    color: '#085041',
                    border: '0.5px solid #5DCAA5',
                  }}
                >
                  {ref}
                </span>
              ))}
              {requirementRefs.length > 6 && (
                <span style={{ fontSize: 9, color: '#9B9A95' }}>+{requirementRefs.length - 6} more</span>
              )}
            </div>
            {relatedReqs.length > 0 && (
              <div style={{ fontSize: 10, color: '#9B9A95', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>
                {relatedReqs[0].text?.substring(0, 120)}{relatedReqs[0].text?.length > 120 ? '...' : ''}
              </div>
            )}
          </div>
        )}

        {/* Win themes */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Win themes to weave in</SectionLabel>
          <div style={{ fontSize: 11, color: '#9B9A95', lineHeight: 1.5 }}>
            Add win themes in Scope &rarr; Strategy to see them here.
          </div>
        </div>

        {/* Related WBS */}
        {relatedWbs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Related WBS elements</SectionLabel>
            <div className="flex flex-col gap-1">
              {relatedWbs.map(el => (
                <div
                  key={el.id}
                  style={{
                    fontSize: 11,
                    color: '#5F5E5A',
                    padding: '6px 8px',
                    background: '#fff',
                    border: '0.5px solid #E8E7E2',
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#9B9A95', flexShrink: 0 }}>
                    {el.ref || el.wbsNumber || '—'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {el.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Page limit bar */}
      {pageTarget && (
        <div className="shrink-0" style={{ padding: '8px 16px', borderTop: '0.5px solid #E8E7E2', background: '#fff' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: '#6B6A65', flexShrink: 0 }}>Page usage</span>
            <div style={{ flex: 1, height: 4, background: '#F0EDE6', borderRadius: 2 }}>
              <div style={{ width: `${Math.min(pagePct, 100)}%`, height: '100%', background: barColor, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: barColor, fontWeight: 600, flexShrink: 0 }}>
              {currentPages.toFixed(1)} / {pageTarget}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#C4C3BE', marginBottom: 8 }}>
      {children}
    </div>
  )
}
