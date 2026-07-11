'use client'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Target,
  BookOpen,
  Save,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

// ===== TYPES =====

interface SectionInfo {
  id: string
  title: string
  sectionNumber: string | null
  sortOrder: number
  summary: string | null
  instructions: string | null
  complianceItemIds: string[]
  requirementRefs: string[]
}

interface ComplianceItem {
  id: string
  reference_number: string
  requirement_text: string
  compliance_status: string
}

interface WritingGuide {
  voice_description?: string
  reading_level?: string
  sentence_rules?: string[]
  words_to_avoid?: string[]
  words_to_use?: string[]
  structural_rules?: string[]
  example_sentences?: string
}

interface CollaborateData {
  link: {
    id: string
    linkType: string
    label: string | null
    reviewerName: string | null
    reviewerEmail: string | null
    submissionStatus: string
    submissionContent: unknown | null
    sectionIds: string[]
    reviewerNote: string | null
  }
  proposal: {
    id: string
    title: string
    solicitationNumber: string | null
    agency: string | null
  }
  sections: SectionInfo[]
  complianceItems: ComplianceItem[]
  winThemes: string[]
  writingGuide: WritingGuide | null
  // Status-only responses
  status?: string
  message?: string
  submittedAt?: string
}

// ===== MAIN PAGE =====

export default function CollaboratePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<CollaborateData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [wordCount, setWordCount] = useState(0)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/collaborate/${token}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to load')
        return
      }

      // Handle already-submitted status
      if (json.status === 'submitted' || json.status === 'approved') {
        setSubmitted(true)
        setData(json)
        return
      }

      setData(json)
    } catch {
      setError('Failed to load collaboration data')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  // Build initial editor content from sections
  const buildInitialContent = useCallback(() => {
    if (!data?.sections) return ''

    // If there's saved draft content, restore it
    if (data.link.submissionContent && data.link.submissionStatus === 'pending') {
      const saved = data.link.submissionContent as { html?: string }
      if (saved.html) return saved.html
    }

    // Pre-populate with H2 headings
    return data.sections
      .map((s) => {
        const heading = s.sectionNumber ? `${s.sectionNumber} ${s.title}` : s.title
        return `<h2>${heading}</h2><p></p>`
      })
      .join('')
  }, [data])

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your content...',
      }),
      CharacterCount,
    ],
    content: buildInitialContent(),
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: 'collaborate-editor focus:outline-none',
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Update word count reactively on every change
      setWordCount(editor.storage.characterCount?.words() || 0)
    },
  })

  // Set content once data loads
  useEffect(() => {
    if (editor && data && !submitted) {
      const content = buildInitialContent()
      if (content && !editor.getHTML().includes('<h2>')) {
        editor.commands.setContent(content)
      }
    }
  }, [editor, data, submitted, buildInitialContent])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!editor || submitted) return

    const interval = setInterval(async () => {
      const html = editor.getHTML()
      if (!html || html === '<p></p>') return

      setSaveStatus('saving')
      try {
        await fetch(`/api/collaborate/${token}/save`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { html } }),
        })
        setSaveStatus('saved')
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
      } catch {
        setSaveStatus('idle')
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [editor, token, submitted])

  // Initialize word count when editor loads with content
  useEffect(() => {
    if (editor) {
      setWordCount(editor.storage.characterCount?.words() || 0)
    }
  }, [editor])

  // Submit handler
  const handleSubmit = async () => {
    if (!editor) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/collaborate/${token}/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { html: editor.getHTML() } }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Submit failed')
      }
      setSubmitted(true)
      setShowSubmitDialog(false)
      toast.success('Draft submitted successfully')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ===== LOADING STATE =====
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-12 px-6 space-y-6">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="flex gap-6">
            <Skeleton className="h-96 w-72 rounded-lg" />
            <Skeleton className="h-96 flex-1 rounded-lg" />
            <Skeleton className="h-96 w-80 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  // ===== ERROR STATE =====
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <ErrorAlert variant="page" title="Unable to load" message={error} />
        </div>
        <Toaster />
      </div>
    )
  }

  // ===== SUBMITTED STATE =====
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">Draft Submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your draft has been submitted. Friends From The City will review it and may reach out if they have questions.
          </p>
        </Card>
        <Toaster />
      </div>
    )
  }

  if (!data) return null

  const { link, proposal, sections, complianceItems, winThemes, writingGuide } = data

  // Current section name for header
  const sectionTitle = sections.length === 1
    ? sections[0].title
    : `${sections.length} sections`

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-[20px] tracking-[-0.5px] text-gray-900">
              TrueBid
            </span>
            <span
              className="wordmark-cursive text-[11px] leading-[1.3] -mt-[1px]"
              style={{ color: 'var(--signal, #F5C200)' }}
            >
              by Friends
            </span>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{proposal.title}</p>
            <p className="text-xs text-muted-foreground truncate">{sectionTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
          <Button
            onClick={() => setShowSubmitDialog(true)}
            disabled={wordCount < 100}
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit
          </Button>
        </div>
      </header>

      {/* ===== FEEDBACK BANNER ===== */}
      {link.reviewerNote && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Feedback from reviewer</p>
              <p className="text-sm text-amber-700 mt-1">{link.reviewerNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== THREE-PANEL LAYOUT ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT CONTEXT PANEL */}
        <aside className="w-[280px] border-r border-gray-200 overflow-y-auto bg-gray-50 shrink-0">
          <div className="p-4 space-y-6">

            {/* Words to Avoid - Always visible at top */}
            {writingGuide?.words_to_avoid && writingGuide.words_to_avoid.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Words to Avoid</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  {writingGuide.words_to_avoid.join(', ')}
                </p>
              </div>
            )}

            {/* Your Sections */}
            <ContextSection title="Your Sections" icon={FileText} defaultOpen>
              <div className="space-y-1">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      // Scroll editor to this section's H2
                      const heading = s.sectionNumber ? `${s.sectionNumber} ${s.title}` : s.title
                      const allH2 = document.querySelectorAll('.collaborate-editor h2')
                      for (const h2 of allH2) {
                        if (h2.textContent?.includes(heading.slice(0, 20))) {
                          h2.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          break
                        }
                      }
                    }}
                    className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    {s.sectionNumber && (
                      <span className="text-xs font-mono text-muted-foreground mr-1.5">{s.sectionNumber}</span>
                    )}
                    {s.title}
                  </button>
                ))}
              </div>
            </ContextSection>

            {/* Requirements */}
            {complianceItems.length > 0 && (
              <ContextSection title="Requirements" icon={Target}>
                <div className="space-y-2">
                  {complianceItems.map((item) => (
                    <div key={item.id} className="text-xs space-y-0.5">
                      <span className="font-mono text-muted-foreground">{item.reference_number}</span>
                      <p className="text-gray-700 leading-relaxed">{item.requirement_text}</p>
                    </div>
                  ))}
                </div>
              </ContextSection>
            )}

            {/* Win Themes */}
            {winThemes.length > 0 && (
              <ContextSection title="Win Themes" icon={Target}>
                <p className="text-xs text-muted-foreground mb-2">
                  What makes Friends unique on this proposal
                </p>
                <div className="space-y-2">
                  {winThemes.map((theme, i) => (
                    <p key={i} className="text-xs text-gray-700 leading-relaxed pl-2 border-l-2 border-gray-200">
                      {theme}
                    </p>
                  ))}
                </div>
              </ContextSection>
            )}

            {/* Writing Guide */}
            {writingGuide && writingGuide.example_sentences && (
              <ContextSection title="Writing Guide" icon={BookOpen}>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Write like this</p>
                  {writingGuide.example_sentences.split('\n').filter(Boolean).slice(0, 3).map((sentence, i) => (
                    <blockquote
                      key={i}
                      className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2 italic"
                    >
                      {sentence}
                    </blockquote>
                  ))}
                </div>
              </ContextSection>
            )}
          </div>
        </aside>

        {/* CENTER EDITOR */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Toolbar */}
          <div className="px-8 py-2 border-b border-gray-100 bg-white shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-1">
              <button
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('bold') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('italic') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('underline') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Underline"
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('heading', { level: 3 }) ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('bulletList') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 ${editor?.isActive('orderedList') ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-3xl mx-auto">
              <style jsx global>{`
                .collaborate-editor {
                  font-family: Inter, sans-serif;
                  font-size: 15px;
                  line-height: 1.85;
                  color: #111;
                  min-height: 400px;
                }
                .collaborate-editor h2 {
                  font-size: 18px;
                  font-weight: 600;
                  margin-top: 24px;
                  margin-bottom: 12px;
                  color: #111;
                }
                .collaborate-editor h3 {
                  font-size: 16px;
                  font-weight: 600;
                  margin-top: 20px;
                  margin-bottom: 8px;
                  color: #333;
                }
                .collaborate-editor p {
                  margin-bottom: 16px;
                }
                .collaborate-editor ul {
                  margin-bottom: 16px;
                  padding-left: 20px;
                }
                .collaborate-editor li {
                  margin-bottom: 4px;
                }
                .collaborate-editor .is-editor-empty:first-child::before {
                  content: attr(data-placeholder);
                  float: left;
                  color: #aaa;
                  pointer-events: none;
                  height: 0;
                }
              `}</style>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Word count bar */}
          <div className="px-8 py-2 border-t border-gray-100 bg-gray-50 text-xs text-muted-foreground flex items-center justify-between shrink-0">
            <span>{wordCount} words</span>
            {wordCount < 100 && (
              <span className="text-amber-600">Minimum 100 words to submit</span>
            )}
          </div>
        </main>

        {/* RIGHT COACHING PANEL */}
        <aside className="w-[320px] border-l border-gray-200 overflow-y-auto bg-gray-50 shrink-0">
          <div className="p-4">
            <CoachingPanelLite
              token={token}
              sections={sections}
              editorContent={editor?.getText() || ''}
              wordCount={wordCount}
            />
          </div>
        </aside>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your draft?</DialogTitle>
            <DialogDescription>
              Once submitted, Friends From The City will review your contribution. You can no longer edit after submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}

// ===== CONTEXT SECTION (collapsible) =====

function ContextSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-1"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
      </button>
      {open && <div className="mt-2 ml-5">{children}</div>}
    </div>
  )
}

// ===== COACHING PANEL (exact match of internal write-content styling) =====

const SCORE_DIMENSIONS: { key: string; label: string }[] = [
  { key: 'customer_focus', label: 'Customer focus' },
  { key: 'win_themes', label: 'Win themes' },
  { key: 'discriminators', label: 'Discriminators' },
  { key: 'proof_points', label: 'Proof points' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'writing_style', label: 'Writing style' },
]

function getCoachingLabel(overall: number): string {
  if (overall >= 4.0) return 'Strong section'
  if (overall >= 3.5) return 'Good foundation'
  if (overall >= 2.5) return 'Getting there'
  return 'Needs work'
}

function getScoreColor(score: number): string {
  if (score >= 4.0) return '#639922'
  if (score >= 3.0) return '#BA7517'
  return '#A32D2D'
}

function CoachingPanelLite({
  token,
  sections,
  editorContent,
  wordCount,
}: {
  token: string
  sections: SectionInfo[]
  editorContent: string
  wordCount: number
}) {
  const [coaching, setCoaching] = useState<{
    scores: Record<string, number>
    overall_assessment: string
    feedback: { category: string; severity: 'critical' | 'important' | 'suggestion'; issue: string; recommendation: string; title?: string }[]
  } | null>(null)
  const [isCoaching, setIsCoaching] = useState(false)
  const [coachingError, setCoachingError] = useState<string | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string>('')

  // Auto-trigger coaching after 5 seconds of idle when enough content
  useEffect(() => {
    if (wordCount < 50) return
    if (editorContent === lastContentRef.current) return

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)

    idleTimerRef.current = setTimeout(() => {
      lastContentRef.current = editorContent
      runCoaching()
    }, 5000)

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContent, wordCount])

  const sectionTitle = sections[0]?.title || 'Section'
  const runCoaching = async () => {
    if (isCoaching || !editorContent.trim()) return
    setIsCoaching(true)
    setCoachingError(null)
    try {
      const res = await fetch(`/api/collaborate/${token}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editorContent,
          title: sectionTitle,
        }),
      })
      if (!res.ok) throw new Error('Coaching failed')
      const data = await res.json()
      setCoaching(data.coaching || data.result || data)
    } catch {
      setCoachingError('Coaching unavailable')
    } finally {
      setIsCoaching(false)
    }
  }

  // Overall score
  const scores = coaching?.scores || {}
  const scoreValues = Object.values(scores).filter((v) => typeof v === 'number')
  const averageScore = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : 0

  // Sort feedback by severity
  const sortedFeedback = coaching?.feedback
    ? [...coaching.feedback].sort((a, b) => {
        const order = { critical: 0, important: 1, suggestion: 2 }
        return order[a.severity] - order[b.severity]
      })
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with Morgan - exact match of internal */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderBottom: '0.5px solid #E8E7E2'
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/morgan-ellis.jpg"
          alt="Morgan Ellis"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#111110', lineHeight: 1.2 }}>
            Morgan Ellis
          </div>
          <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.2 }}>
            Red Team Lead
          </div>
          <div style={{ fontSize: 10, color: '#9B9A96', lineHeight: 1.2, marginTop: 1 }}>
            Shipley methodology
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111110', lineHeight: 1 }}>
          {coaching ? averageScore.toFixed(1) : '--'}
        </div>
        <button
          onClick={runCoaching}
          disabled={isCoaching || wordCount < 50}
          title="Re-score"
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: '0.5px solid #E8E7E2',
            background: '#fff',
            cursor: isCoaching || wordCount < 50 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isCoaching || wordCount < 50 ? 0.5 : 1,
            flexShrink: 0
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ animation: isCoaching ? 'spin 1s linear infinite' : 'none' }}
          >
            <path d="M10 6A4 4 0 1 1 6 2" stroke="#5F5E5A" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6 2L8 4M6 2L4 4" stroke="#5F5E5A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Body - scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {/* Empty state */}
        {!coaching && !isCoaching && !coachingError && (
          <div style={{ fontSize: 11, color: '#C4C3BE', lineHeight: 1.5 }}>
            Start writing to get Morgan&apos;s feedback. Analysis runs automatically after you pause.
          </div>
        )}

        {/* Error state */}
        {coachingError && !isCoaching && (
          <div style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.5, padding: '8px 10px', background: '#FEF2F2', borderRadius: 6 }}>
            <strong>Error:</strong> {coachingError}
            <button
              onClick={runCoaching}
              style={{ display: 'block', marginTop: 6, fontSize: 10, color: '#2563EB', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isCoaching && !coaching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, color: '#BA7517', marginBottom: 4 }}>Morgan is reviewing...</div>
            {SCORE_DIMENSIONS.map(d => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#C4C3BE', flex: 1 }}>{d.label}</span>
                <div style={{ width: 50, height: 4, background: '#F0EDE6', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {coaching && (
          <>
            {/* Overall label */}
            <div style={{ fontSize: 11, fontWeight: 600, color: getScoreColor(averageScore), marginBottom: 12 }}>
              {getCoachingLabel(averageScore)}
            </div>

            {/* Score bars */}
            {SCORE_DIMENSIONS.map(d => {
              const score = scores[d.key]
              if (score === undefined) return null
              const color = getScoreColor(score)
              return (
                <div
                  key={d.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                    opacity: isCoaching ? 0.5 : 1,
                    transition: 'opacity 0.3s'
                  }}
                >
                  <span style={{ fontSize: 11, color: '#5F5E5A', flex: 1 }}>{d.label}</span>
                  <div style={{ width: 50, height: 4, background: '#F0EDE6', borderRadius: 2 }}>
                    <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 24, textAlign: 'right', color }}>
                    {score.toFixed(1)}
                  </span>
                </div>
              )
            })}

            {/* Divider */}
            <div style={{ height: 0.5, background: '#F4F3EF', margin: '10px 0' }} />

            {/* Feedback cards */}
            {sortedFeedback.map((fb, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: '#5F5E5A',
                  lineHeight: 1.5,
                  padding: '8px 10px',
                  background: '#FAFAF9',
                  border: '0.5px solid #E8E7E2',
                  borderLeft: `2px solid ${fb.severity === 'critical' ? '#A32D2D' : fb.severity === 'suggestion' ? '#639922' : '#BA7517'}`,
                  borderRadius: 5,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600, color: '#111110', marginBottom: 2 }}>
                  {fb.title || fb.issue}
                </div>
                {fb.recommendation}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Spin animation keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
