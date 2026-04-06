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

  const { proposal, sections, complianceItems, winThemes, writingGuide } = data

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

// ===== COACHING PANEL (matches internal styling) =====

const SCORE_LABELS: Record<string, string> = {
  customer_focus: 'Customer focus',
  win_themes: 'Win themes',
  discriminators: 'Discriminators',
  proof_points: 'Proof points',
  compliance: 'Compliance',
  writing_style: 'Writing style',
  // Fallback labels for other keys
  understanding: 'Understanding',
  approach: 'Approach',
  proof: 'Proof',
  risk_mitigation: 'Risk Mitigation',
  win_theme_alignment: 'Win Theme Alignment',
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
    feedback: { category: string; severity: 'critical' | 'important' | 'suggestion'; issue: string; recommendation: string }[]
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

  // Get score color
  const getScoreColor = (score: number) => {
    if (score <= 2) return 'bg-red-500'
    if (score === 3) return 'bg-amber-500'
    return 'bg-green-500'
  }

  // Sort feedback by severity
  const sortedFeedback = coaching?.feedback
    ? [...coaching.feedback].sort((a, b) => {
        const order = { critical: 0, important: 1, suggestion: 2 }
        return order[a.severity] - order[b.severity]
      })
    : []

  return (
    <div className="space-y-4">
      {/* Morgan header with score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/morgan-ellis.jpg" alt="Morgan Ellis" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Morgan Ellis</p>
            <p className="text-xs text-gray-500">Red Team Lead</p>
            <p className="text-xs text-gray-400">Shipley methodology</p>
          </div>
        </div>
        {coaching && !isCoaching && (
          <div className="text-right">
            <span className="text-2xl font-bold text-gray-900">{averageScore.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isCoaching && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mb-3">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-900">
              Analyzing your section...
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This may take 15-30 seconds
            </p>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {coachingError && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{coachingError}</p>
          <Button size="sm" variant="outline" onClick={runCoaching} className="mt-2">
            Try Again
          </Button>
        </Card>
      )}

      {/* Empty state */}
      {!coaching && !isCoaching && !coachingError && (
        <div className="text-center py-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Get section feedback</p>
            <p className="text-xs text-gray-500 mt-1">
              The coaching engine evaluates your writing against Shipley methodology and win themes.
            </p>
          </div>
          {wordCount >= 50 ? (
            <Button size="sm" onClick={runCoaching}>
              Analyze Section
            </Button>
          ) : (
            <p className="text-xs text-gray-400">
              Write at least 50 words to enable analysis
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {coaching && !isCoaching && (
        <div className="space-y-4">
          {/* Assessment Summary */}
          {coaching.overall_assessment && (
            <p className={`text-sm font-medium ${averageScore >= 3.5 ? 'text-green-600' : averageScore >= 2.5 ? 'text-amber-600' : 'text-red-600'}`}>
              {averageScore >= 3.5 ? 'Good foundation' : averageScore >= 2.5 ? 'Needs improvement' : 'Major revisions needed'}
            </p>
          )}

          {/* Score Bars (no card wrapper) */}
          <div className="space-y-2.5">
            {Object.entries(scores).map(([key, score]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 shrink-0">{SCORE_LABELS[key] || key}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getScoreColor(score)}`}
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-medium tabular-nums w-6 text-right ${score < 3 ? 'text-red-600' : 'text-gray-900'}`}>
                  {score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* Feedback Items with left border */}
          {sortedFeedback.length > 0 && (
            <div className="space-y-2 pt-2">
              {sortedFeedback.map((item, idx) => (
                <div
                  key={idx}
                  className={`pl-3 border-l-2 ${
                    item.severity === 'critical' ? 'border-red-400' :
                    item.severity === 'important' ? 'border-amber-400' :
                    'border-blue-400'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">
                    {item.issue}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {item.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Run Again Button */}
          <Button
            variant="outline"
            onClick={runCoaching}
            className="w-full"
            size="sm"
          >
            Run Again
          </Button>
        </div>
      )}
    </div>
  )
}
