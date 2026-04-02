'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppContext, type SectionContent } from '@/contexts/app-context'
import { ArrowLeft } from 'lucide-react'

// ==================== MAIN COMPONENT ====================

interface WriteContentProps {
  sectionId: string
  sectionTitle: string
  onBack: () => void
}

export function WriteContent({ sectionId, sectionTitle, onBack }: WriteContentProps) {
  const { sectionContent, setSectionContent, solicitation } = useAppContext()

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
        <div
          className="shrink-0 overflow-y-auto"
          style={{
            width: 260,
            borderRight: '0.5px solid #E8E7E2',
            background: '#FAFAF9',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#C4C3BE', marginBottom: 12 }}>
            Context
          </div>
          <div style={{ fontSize: 11, color: '#6B6A65', lineHeight: 1.5 }}>
            Section context panel — compliance requirements, win themes, and guidance will appear here.
          </div>
        </div>

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
