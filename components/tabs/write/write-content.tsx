'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppContext, type OutlineSection, type OutlineSectionStatus } from '@/contexts/app-context'
import { useParams } from 'next/navigation'
import { ArrowLeft, Sparkles, Bold, Italic, Heading1, Heading2, List, Pilcrow, Copy, Check, Trash2 } from 'lucide-react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { sectionsApi } from '@/lib/api'

// ==================== TYPES ====================

interface CoachingResult {
  overallScore: number
  overallLabel: string
  overallAssessment: string
  scores: {
    customerFocus: number
    winThemes: number
    discriminators: number
    proofPoints: number
    compliance: number
  }
  feedback: {
    customerFocus: string
    winThemes: string
    discriminators: string
    proofPoints: string
    compliance: string
  }
}

// ==================== MAIN COMPONENT ====================

interface WriteContentProps {
  sectionId: string
  sectionTitle: string
  onBack: () => void
}

export function WriteContent({ sectionId, sectionTitle, onBack }: WriteContentProps) {
  const params = useParams()
  const proposalId = params?.id as string
  const { sectionContent, setSectionContent, solicitation, outline, setOutline, extractedRequirements, estimateWbsElements, proposalSetup } = useAppContext()

  // Load win themes from proposal strategy (not in AppContext)
  const [winThemes, setWinThemes] = useState<string[]>([])
  useEffect(() => {
    if (!proposalId) return
    fetch(`/api/proposals/${proposalId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const themes = data?.proposal?.strategy?.winThemes as string[] | undefined
        if (themes) setWinThemes(themes.filter((t: string) => t?.trim()))
      })
      .catch(() => {})
  }, [proposalId])

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

  // State
  const existing = sectionContent[sectionId]
  const [lastSaved, setLastSaved] = useState(existing?.lastSaved || '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [wordCount, setWordCount] = useState(existing?.wordCount || 0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Coaching state
  const [coaching, setCoaching] = useState<CoachingResult | null>(null)
  const [isCoaching, setIsCoaching] = useState(false)
  const [coachingError, setCoachingError] = useState<string | null>(null)
  const isCoachingRef = useRef(false)
  const coachTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const skipNextLoadRef = useRef(false) // Prevent load from overwriting fresh coaching

  // Load existing coaching from DB on mount
  useEffect(() => {
    if (!proposalId || !sectionId) return

    // Skip if we just ran coaching (prevents overwriting fresh data)
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false
      return
    }

    const loadCoaching = async () => {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/section-coaching/${sectionId}`)
        if (res.ok) {
          const { coaching: savedCoaching } = await res.json()
          if (savedCoaching) setCoaching(savedCoaching)
        }
      } catch (err) {
        console.error('[WriteContent] Failed to load coaching:', err)
      }
    }
    loadCoaching()
  }, [proposalId, sectionId])

  // State for section loaded from DB
  const [dbSection, setDbSection] = useState<{ content?: string | object; contentText?: string } | null>(null)
  const [isLoadingSection, setIsLoadingSection] = useState(true)

  // Load section content from DB or outline
  useEffect(() => {
    if (!proposalId || !sectionId) return
    setIsLoadingSection(true)

    const isOutlineSection = sectionId.startsWith('sec-')

    const loadSection = async () => {
      try {
        if (isOutlineSection) {
          // For outline sections, check outline context first, then working_data
          const outlineSec = outlineSection as { content?: string } | null
          if (outlineSec?.content) {
            setDbSection({ content: outlineSec.content })
          } else {
            // Also check sectionContent context
            const contextSection = sectionContent[sectionId]
            if (contextSection?.content) {
              setDbSection({ content: contextSection.content })
            }
          }
        } else {
          // For proposal_sections UUIDs, load from DB
          const response = await sectionsApi.list(proposalId) as { sections: { id: string; content?: string | object; contentText?: string }[] }
          const section = response.sections?.find(s => s.id === sectionId)
          if (section) {
            setDbSection(section)
          }
        }
      } catch (err) {
        console.error('[WriteContent] Failed to load section:', err)
      } finally {
        setIsLoadingSection(false)
      }
    }
    loadSection()
  }, [proposalId, sectionId, sectionContent, outlineSection])

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Placeholder.configure({ placeholder: 'Start writing, or use Draft with AI to generate a starting point...' }),
    ],
    content: '', // Start empty, will be populated from DB
    autofocus: true,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      const words = ed.getText().split(/\s+/).filter(Boolean).length
      setWordCount(words)
      scheduleCoaching(html)

      // Debounced save to DB and context
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true)
        const now = new Date().toISOString()
        const text = ed.getText()
        const newStatus = text.trim() ? 'in_progress' as const : 'not_started' as const

        // Save to DB if this is a proposal_sections UUID, or update outline if it's an outline section ID
        const isOutlineSection = sectionId.startsWith('sec-')
        if (!isOutlineSection) {
          try {
            await sectionsApi.update(proposalId, sectionId, {
              content: html,
              contentText: text,
              lastEditedAt: now,
            })
          } catch (err) {
            console.error('[WriteContent] Failed to save to DB:', err)
          }
        } else {
          // For outline sections, save to working_data.outline via API
          try {
            await fetch(`/api/proposals/${proposalId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                working_data: {
                  outline: {
                    ...outline,
                    volumes: outline?.volumes.map(vol => ({
                      ...vol,
                      sections: vol.sections.map(sec =>
                        sec.id === sectionId
                          ? { ...sec, content: html, contentText: text }
                          : sec
                      ),
                    })),
                  },
                },
              }),
            })
          } catch (err) {
            console.error('[WriteContent] Failed to save outline section:', err)
          }
        }
        setIsSaving(false)

        // Update context
        setSectionContent(prev => ({
          ...prev,
          [sectionId]: {
            sectionId,
            content: html,
            lastSaved: now,
            wordCount: words,
            status: prev[sectionId]?.status === 'draft' ? 'draft' : newStatus,
          },
        }))
        setLastSaved(now)
        // Update outline section status
        setOutline(prev => {
          if (!prev) return prev
          return {
            ...prev,
            volumes: prev.volumes.map(vol => ({
              ...vol,
              sections: vol.sections.map(sec =>
                sec.id === sectionId && sec.status === 'not_started'
                  ? { ...sec, status: 'in_progress' as const }
                  : sec
              ),
            })),
          }
        })
      }, 1000)
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px]',
        style: 'font-family: Inter, sans-serif; font-size: 15px; line-height: 1.85; color: #111110; max-width: 680px; margin: 0 auto;',
      },
    },
  })

  // Load content from DB into editor when dbSection is loaded
  useEffect(() => {
    if (!editor || isLoadingSection) return
    if (dbSection?.content) {
      // Content can be a string (HTML) or an object (TipTap JSON)
      const content = typeof dbSection.content === 'string'
        ? dbSection.content
        : dbSection.content
      editor.commands.setContent(content)
      // Update word count from loaded content
      const words = editor.getText().split(/\s+/).filter(Boolean).length
      setWordCount(words)
    }
  }, [editor, dbSection, isLoadingSection])

  // Time since last save
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

  // Copy content to clipboard
  const handleCopy = useCallback(async () => {
    if (!editor) return
    const text = editor.getText()
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [editor])

  // Clear editor content
  const handleClear = useCallback(() => {
    if (!editor) return
    const text = editor.getText()
    if (!text.trim()) return
    if (window.confirm('Clear all content? This cannot be undone.')) {
      editor.commands.clearContent()
      setWordCount(0)
      setCoaching(null)
    }
  }, [editor])

  // Coaching API call
  const runCoaching = useCallback(async (text: string) => {
    const plainText = text.replace(/<[^>]*>/g, '').trim()
    const words = plainText.split(/\s+/).filter(Boolean).length
    if (!plainText || words < 50 || isCoachingRef.current) return
    isCoachingRef.current = true
    setIsCoaching(true)
    setCoachingError(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/coach-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, content: text, proposalId }),
      })
      if (res.ok) {
        const { coaching: result } = await res.json()
        skipNextLoadRef.current = true // Prevent load effect from overwriting
        setCoaching(result)
      } else {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.error || `Coaching failed (${res.status})`
        console.error('[WriteContent] Coaching API error:', res.status, errorMsg)
        setCoachingError(errorMsg)
      }
    } catch (err) {
      console.error('[WriteContent] Coaching failed:', err)
      setCoachingError(err instanceof Error ? err.message : 'Network error')
    } finally {
      isCoachingRef.current = false
      setIsCoaching(false)
    }
  }, [proposalId, sectionId])

  // Auto-trigger coaching on idle (5s after last edit)
  const scheduleCoaching = useCallback((html: string) => {
    if (coachTimeoutRef.current) clearTimeout(coachTimeoutRef.current)
    coachTimeoutRef.current = setTimeout(() => runCoaching(html), 5000)
  }, [runCoaching])

  // AI Draft streaming
  const handleDraftWithAI = useCallback(async () => {
    if (!editor || isStreaming) return
    setIsStreaming(true)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/draft-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, sectionTitle, proposalId }),
      })

      if (!response.ok) {
        setIsStreaming(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) { setIsStreaming(false); return }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content_block_delta' && data.delta?.text) {
                fullContent += data.delta.text
                editor.commands.setContent(fullContent)
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Final save
      const words = editor.getText().split(/\s+/).filter(Boolean).length
      const now = new Date().toISOString()
      setSectionContent(prev => ({
        ...prev,
        [sectionId]: {
          sectionId,
          content: editor.getHTML(),
          lastSaved: now,
          wordCount: words,
          status: 'draft',
        },
      }))
      // Update outline status to draft
      setOutline(prev => {
        if (!prev) return prev
        return {
          ...prev,
          volumes: prev.volumes.map(vol => ({
            ...vol,
            sections: vol.sections.map(sec =>
              sec.id === sectionId ? { ...sec, status: 'draft' as const } : sec
            ),
          })),
        }
      })
      setLastSaved(now)
      setWordCount(words)
      // Trigger coaching on the draft
      runCoaching(editor.getHTML())
    } catch (err) {
      console.error('[WriteContent] AI draft failed:', err)
    } finally {
      setIsStreaming(false)
    }
  }, [editor, isStreaming, proposalId, sectionId, sectionTitle, setSectionContent, setOutline, runCoaching])

  // Truncate title for breadcrumb
  const displayTitle = sectionTitle.length > 40
    ? sectionTitle.substring(0, 40) + '...'
    : sectionTitle

  const contractType = solicitation?.contractType || 'T&M'
  const contractBadge = contractType === 'FFP' ? 'FFP' : contractType === 'CPFF' ? 'CPFF' : contractType === 'GSA' ? 'GSA' : 'T&M'

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Keyframe for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

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
          <span style={{ fontSize: 10, color: isSaving ? '#9B9A95' : '#6B6A65' }}>
            {isSaving ? 'Saving...' : lastSaved ? `Auto-saved ${timeSinceSave}` : 'Not saved yet'}
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
          winThemes={winThemes}
          wordCount={wordCount}
          wordsPerPage={proposalSetup?.wordsPerPage || 500}
          onBack={onBack}
        />

        {/* CENTER EDITOR */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#fff' }}>
          {/* Editor toolbar */}
          <div
            className="shrink-0 flex items-center gap-1.5"
            style={{
              padding: '8px 16px',
              borderBottom: '0.5px solid #F4F3EF',
              background: '#FAFAF9',
            }}
          >
            <ToolbarBtn icon={<Bold className="w-3.5 h-3.5" />} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold" />
            <ToolbarBtn icon={<Italic className="w-3.5 h-3.5" />} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic" />
            <ToolbarSep />
            <ToolbarBtn icon={<Heading1 className="w-3.5 h-3.5" />} active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" />
            <ToolbarBtn icon={<Heading2 className="w-3.5 h-3.5" />} active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" />
            <ToolbarBtn icon={<Pilcrow className="w-3.5 h-3.5" />} active={editor?.isActive('paragraph')} onClick={() => editor?.chain().focus().setParagraph().run()} title="Paragraph" />
            <ToolbarBtn icon={<List className="w-3.5 h-3.5" />} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list" />

            {/* Right side */}
            <div className="flex items-center gap-2 ml-auto">
              <span style={{ fontSize: 10, color: '#C4C3BE' }}>{wordCount} words</span>
              <button
                onClick={handleCopy}
                title={isCopied ? 'Copied!' : 'Copy content'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: isCopied ? '#E8F5E9' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: isCopied ? '#2E7D32' : '#9B9A95',
                  transition: 'all 0.2s',
                }}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClear}
                title="Clear content"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#9B9A95',
                  transition: 'all 0.2s',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDraftWithAI}
                disabled={isStreaming}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#111110',
                  background: '#F5C200',
                  border: 'none',
                  borderRadius: 5,
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  opacity: isStreaming ? 0.7 : 1,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isStreaming ? 'Drafting...' : 'Draft with AI'}
              </button>
            </div>
          </div>

          {/* Editor canvas */}
          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: '40px 60px',
              borderLeft: isStreaming ? '2px solid #F5C200' : '2px solid transparent',
              transition: 'border-color 0.3s',
            }}
          >
            <style>{`
              .ProseMirror h1 { font-size: 20px; font-weight: 700; margin-bottom: 16px; font-family: Inter, sans-serif; }
              .ProseMirror h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; font-family: Inter, sans-serif; }
              .ProseMirror p { margin-bottom: 16px; }
              .ProseMirror ul { margin-bottom: 16px; padding-left: 20px; }
              .ProseMirror strong { font-weight: 700; }
              .ProseMirror p.is-editor-empty:first-child::before { color: #C4C3BE; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* RIGHT COACHING PANEL */}
        <CoachingPanel coaching={coaching} isCoaching={isCoaching} coachingError={coachingError} editor={editor} onRescore={runCoaching} />
      </div>
    </div>
  )
}

// ==================== TOOLBAR HELPERS ====================

function ToolbarBtn({ icon, active, onClick, title }: { icon: React.ReactNode; active?: boolean; onClick?: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 4,
        borderRadius: 4,
        background: active ? '#E8E7E2' : 'transparent',
        color: active ? '#111110' : '#9B9A95',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  )
}

function ToolbarSep() {
  return <div style={{ width: 1, height: 16, background: '#E8E7E2', margin: '0 4px' }} />
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
  winThemes,
  wordCount,
  wordsPerPage,
  onBack,
}: {
  sectionId: string
  sectionTitle: string
  outlineSection: OutlineSection | null
  relatedReqs: { id: string; title: string; text: string; reference_number?: string }[]
  relatedWbs: { id: string; ref?: string; wbsNumber?: string; title: string }[]
  winThemes: string[]
  wordCount: number
  wordsPerPage: number
  onBack: () => void
}) {
  const complianceRefs = outlineSection?.complianceRefs || []
  const requirementRefs = outlineSection?.requirementRefs || []
  const pageTarget = outlineSection?.pageTarget || null
  const status = outlineSection?.status || 'not_started'
  const statusConfig = STATUS_BADGE[status]

  const currentPages = wordCount / wordsPerPage
  const pagePct = pageTarget ? (currentPages / pageTarget) * 100 : 0
  const barColor = pagePct > 100 ? '#A32D2D' : pagePct >= 80 ? '#BA7517' : '#639922'
  const overLimitWords = pageTarget && pagePct > 100 ? Math.round((currentPages - pageTarget) * wordsPerPage) : 0

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
          {winThemes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {winThemes.map((theme, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: '#5F5E5A',
                    lineHeight: 1.5,
                    padding: '8px 10px',
                    background: '#fff',
                    border: '0.5px solid #E8E7E2',
                    borderLeft: '2px solid #F5C200',
                    borderRadius: 6,
                  }}
                >
                  {theme}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#C4C3BE', lineHeight: 1.5, fontStyle: 'italic' }}>
              Add win themes in Scope &rarr; Strategy to see them here.
            </div>
          )}
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
              {currentPages.toFixed(1)} / {pageTarget} pages
            </span>
          </div>
          {overLimitWords > 0 && (
            <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>
              Over page limit by {overLimitWords} words
            </div>
          )}
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

// ==================== COACHING PANEL ====================

const SCORE_DIMENSIONS: { key: keyof CoachingResult['scores']; label: string }[] = [
  { key: 'customerFocus', label: 'Customer focus' },
  { key: 'winThemes', label: 'Win themes' },
  { key: 'discriminators', label: 'Discriminators' },
  { key: 'proofPoints', label: 'Proof points' },
  { key: 'compliance', label: 'Compliance' },
]

function getScoreColor(score: number): string {
  if (score >= 4.0) return '#639922'
  if (score >= 3.0) return '#BA7517'
  return '#A32D2D'
}

function CoachingPanel({ coaching, isCoaching, coachingError, editor, onRescore }: { coaching: CoachingResult | null; isCoaching: boolean; coachingError: string | null; editor: Editor | null; onRescore: (html: string) => void }) {
  const handleRegenerate = () => {
    const text = editor?.getText() || ''
    if (text.length > 50) {
      onRescore(editor?.getHTML() || '')
    }
  }

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        width: 260,
        borderLeft: '0.5px solid #E8E7E2',
        background: '#fff',
      }}
    >
      {/* Header with Morgan's photo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderBottom: '0.5px solid #E8E7E2'
      }}>
        <img
          src="/images/morgan-ellis.jpg"
          alt="Morgan Ellis"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#111110',
            lineHeight: 1.2
          }}>
            Morgan Ellis
          </div>
          <div style={{
            fontSize: '11px',
            color: '#5F5E5A',
            lineHeight: 1.2
          }}>
            Red Team Lead
          </div>
          <div style={{
            fontSize: '10px',
            color: '#9B9A96',
            lineHeight: 1.2,
            marginTop: '1px'
          }}>
            Shipley methodology
          </div>
        </div>
        <div style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#111110',
          lineHeight: 1
        }}>
          {coaching?.overallScore ? coaching.overallScore.toFixed(1) : '--'}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isCoaching}
          title="Re-score"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: '0.5px solid #E8E7E2',
            background: '#fff',
            cursor: isCoaching ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isCoaching ? 0.5 : 1,
            flexShrink: 0
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              animation: isCoaching ? 'spin 1s linear infinite' : 'none'
            }}
          >
            <path
              d="M10 6A4 4 0 1 1 6 2"
              stroke="#5F5E5A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M6 2L8 4M6 2L4 4"
              stroke="#5F5E5A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Overall assessment quote */}
      {coaching?.overallAssessment && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '0.5px solid #E8E7E2',
          fontSize: '12px',
          color: '#111110',
          lineHeight: 1.6,
          fontStyle: 'italic'
        }}>
          &ldquo;{coaching.overallAssessment}&rdquo;
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        {!coaching && !isCoaching && !coachingError && (
          <div style={{ fontSize: 11, color: '#C4C3BE', lineHeight: 1.5 }}>
            Start writing or use Draft with AI to get Morgan&apos;s feedback.
          </div>
        )}

        {coachingError && !isCoaching && (
          <div style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.5, padding: '8px 10px', background: '#FEF2F2', borderRadius: 6 }}>
            <strong>Error:</strong> {coachingError}
            <button
              onClick={() => editor && onRescore(editor.getHTML())}
              style={{ display: 'block', marginTop: 6, fontSize: 10, color: '#2563EB', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              Try again
            </button>
          </div>
        )}

        {isCoaching && !coaching && (
          <div className="flex flex-col gap-3">
            <div style={{ fontSize: 11, color: '#BA7517', marginBottom: 4 }}>Morgan is reviewing...</div>
            {SCORE_DIMENSIONS.map(d => (
              <div key={d.key} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#C4C3BE', flex: 1 }}>{d.label}</span>
                <div className="animate-pulse" style={{ width: 60, height: 4, background: '#F0EDE6', borderRadius: 2 }} />
              </div>
            ))}
          </div>
        )}

        {coaching && (
          <>
            {/* Overall label */}
            {coaching.overallLabel && (
              <div style={{ fontSize: 11, fontWeight: 600, color: getScoreColor(coaching.overallScore), marginBottom: 12 }}>
                {coaching.overallLabel}
              </div>
            )}

            {/* Score bars */}
            {SCORE_DIMENSIONS.map(d => {
              const score = coaching.scores[d.key]
              if (score === undefined) return null
              const color = getScoreColor(score)
              const feedbackText = coaching.feedback[d.key]
              return (
                <div key={d.key} style={{ marginBottom: 14 }}>
                  <div className={`flex items-center gap-2 ${isCoaching ? 'animate-pulse' : ''}`} style={{ marginBottom: 4, opacity: isCoaching ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <span style={{ fontSize: 11, color: '#5F5E5A', flex: 1 }}>{d.label}</span>
                    <div style={{ width: 50, height: 4, background: '#F0EDE6', borderRadius: 2 }}>
                      <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 24, textAlign: 'right', color }}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                  {feedbackText && (
                    <div style={{ fontSize: 11, color: '#6B6A65', lineHeight: 1.5, paddingLeft: 0 }}>
                      {feedbackText}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Loading overlay on re-coaching */}
            {isCoaching && (
              <div style={{ fontSize: 10, color: '#9B9A95', marginTop: 8 }}>Updating scores...</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
