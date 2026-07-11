'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SaveStatus } from '@/components/ui/save-status'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Library,
  Sparkles,
  Lock,
  Unlock,
  User,
  GraduationCap,
} from 'lucide-react'
import { sectionsApi, contentLibraryApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CoachingPanel } from './coaching-panel'

// ==================== TYPES ====================

export interface Section {
  id: string
  proposalId: string
  parentId?: string | null
  sortOrder?: number
  sectionNumber: string | null
  title: string
  summary?: string | null
  content: unknown // TipTap JSON
  contentText: string | null
  instructions: string | null
  complianceItemIds?: string[]
  requirementRefs?: string[]
  status: 'draft' | 'in_progress' | 'review' | 'complete' | 'locked'
  targetWordCount: number | null
  actualWordCount: number
  owner: string | null
  notes?: string | null
  aiGenerated?: boolean
  createdAt?: string
  updatedAt?: string
}

interface SectionEditorProps {
  section: Section
  proposalId: string
  onUpdate: (section: Section) => void
  onGenerateDraft: () => void
  isGeneratingDraft: boolean
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  review: { label: 'Review', color: 'bg-amber-100 text-amber-700' },
  complete: { label: 'Complete', color: 'bg-green-100 text-green-700' },
  locked: { label: 'Locked', color: 'bg-purple-100 text-purple-700' },
}

// Helper to parse content that might be double-encoded JSON
function parseContent(content: unknown): object | string {
  if (!content) return ''

  // If it's already an object with the right structure, return it
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>
    if (obj.type === 'doc' && Array.isArray(obj.content)) {
      return content as object
    }
  }

  // If it's a string, try to parse it
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      // Recursively parse in case it's double-encoded
      return parseContent(parsed)
    } catch {
      // If it's not valid JSON, return as plain text for the editor
      return content
    }
  }

  return ''
}

// ==================== MAIN COMPONENT ====================

export function SectionEditor({
  section,
  proposalId,
  onUpdate,
  onGenerateDraft,
  isGeneratingDraft,
}: SectionEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showConfirmDraft, setShowConfirmDraft] = useState(false)
  const [showCoaching, setShowCoaching] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isLocked = section.status === 'locked'

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing, or use Get AI Draft to generate a starting point...',
      }),
      CharacterCount,
      Typography,
    ],
    content: parseContent(section.content),
    editable: !isLocked,
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getJSON(), editor.getText())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4',
        style: 'font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.8;',
      },
    },
  })

  // Update editor content when section changes
  useEffect(() => {
    if (editor) {
      if (section.content) {
        const currentContent = JSON.stringify(editor.getJSON())
        const parsedContent = parseContent(section.content)
        const newContent = JSON.stringify(parsedContent)
        if (currentContent !== newContent) {
          editor.commands.setContent(parsedContent)
        }
      } else {
        // Clear editor when section has no content
        editor.commands.clearContent()
      }
    }
  }, [editor, section.id, section.content])

  // Update editable state when locked status changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isLocked)
    }
  }, [editor, isLocked])

  // Autosave with debounce
  const handleContentChange = useCallback((content: object, text: string) => {
    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await sectionsApi.update(proposalId, section.id, {
          content,
          contentText: text,
          lastEditedAt: new Date().toISOString(),
        }) as { section: Section }
        onUpdate(response.section)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 2000)
  }, [proposalId, section.id, onUpdate])

  // Status change handler
  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await sectionsApi.update(proposalId, section.id, {
        status: newStatus,
      }) as { section: Section }
      onUpdate(response.section)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  // Request unlock
  const handleRequestUnlock = async () => {
    await handleStatusChange('review')
  }

  // Word count and progress
  const wordCount = editor?.storage.characterCount?.words() || 0
  const targetWords = section.targetWordCount || 0
  const wordProgress = targetWords > 0 ? Math.round((wordCount / targetWords) * 100) : 0

  const getWordCountColor = () => {
    if (targetWords === 0) return 'text-gray-500'
    if (wordProgress < 80) return 'text-gray-500'
    if (wordProgress <= 100) return 'text-amber-600'
    return 'text-red-600'
  }

  // Estimated pages (assuming ~250 words per page)
  const estimatedPages = Math.max(1, Math.round(wordCount / 250))

  // Handle AI Draft button click
  const handleDraftClick = () => {
    if (editor && editor.getText().trim().length > 0) {
      setShowConfirmDraft(true)
    } else {
      onGenerateDraft()
    }
  }

  const confirmDraft = () => {
    setShowConfirmDraft(false)
    onGenerateDraft()
  }

  if (!editor) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {section.sectionNumber && (
              <Badge variant="outline" className="font-mono text-xs">
                {section.sectionNumber}
              </Badge>
            )}
            <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            {isLocked && <Lock className="w-4 h-4 text-purple-600" />}
          </div>
          <SaveStatus status={saveStatus} />
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Page/Word estimate */}
          <Badge variant="secondary" className="text-xs">
            ~{estimatedPages} page{estimatedPages !== 1 ? 's' : ''} / {targetWords > 0 ? `${targetWords} words target` : 'no limit'}
          </Badge>

          {/* Word count */}
          <span className={cn('text-xs font-medium', getWordCountColor())}>
            {wordCount.toLocaleString()} words
            {targetWords > 0 && ` (${wordProgress}%)`}
          </span>

          {/* Owner */}
          {section.owner && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <User className="w-3 h-3" />
              {section.owner}
            </span>
          )}

          {/* Status */}
          <Select value={section.status} onValueChange={handleStatusChange} disabled={isLocked}>
            <SelectTrigger className={cn('h-7 w-28 text-xs border-0', STATUS_CONFIG[section.status].color)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Actions */}
          {isLocked ? (
            <Button size="sm" variant="outline" onClick={handleRequestUnlock}>
              <Unlock className="w-4 h-4 mr-1.5" />
              Request Unlock
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDraftClick}
                disabled={isGeneratingDraft}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {isGeneratingDraft ? 'Writing...' : 'Get AI Draft'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCoaching(true)}
              >
                <GraduationCap className="w-4 h-4 mr-1.5" />
                Coach
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!isLocked && (
        <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-1 bg-white">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => setShowLibrary(true)}
            title="Insert from Library"
          >
            <Library className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Instructions hint */}
      {section.instructions && (
        <div className="border-t border-gray-200 bg-blue-50 px-6 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Writing guidance:</span> {section.instructions}
          </p>
        </div>
      )}

      {/* Confirm Draft Dialog */}
      <Dialog open={showConfirmDraft} onOpenChange={setShowConfirmDraft}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace current draft?</DialogTitle>
            <DialogDescription>
              This will replace your current draft with AI-generated content. Your existing work will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDraft(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDraft}>
              Replace Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Library Slideout */}
      {showLibrary && (
        <ContentLibrarySlideout
          proposalId={proposalId}
          sectionTitle={section.title}
          onClose={() => setShowLibrary(false)}
          onInsert={(text) => {
            editor.chain().focus().insertContent(text).run()
            setShowLibrary(false)
          }}
        />
      )}

      {/* Coaching Panel */}
      {showCoaching && (
        <CoachingPanel
          proposalId={proposalId}
          sectionId={section.id}
          sectionTitle={section.title}
          hasContent={Boolean(section.contentText?.trim())}
          onClose={() => setShowCoaching(false)}
        />
      )}
    </div>
  )
}

// ==================== TOOLBAR BUTTON ====================

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-2 rounded hover:bg-gray-100 transition-colors',
        isActive && 'bg-gray-100 text-blue-600'
      )}
    >
      {children}
    </button>
  )
}

// ==================== CONTENT LIBRARY SLIDEOUT ====================

interface ContentLibrarySlideoutProps {
  proposalId: string
  sectionTitle: string
  onClose: () => void
  onInsert: (text: string) => void
}

function ContentLibrarySlideout({
  proposalId,
  sectionTitle,
  onClose,
  onInsert,
}: ContentLibrarySlideoutProps) {
  const [items, setItems] = useState<Array<{
    id: string
    type: string
    title: string
    content: { text?: string; description?: string }
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  // Determine relevant content types based on section title
  const getRelevantTypes = () => {
    const title = sectionTitle.toLowerCase()
    if (title.includes('past performance') || title.includes('experience')) {
      return ['past_performance']
    }
    if (title.includes('executive') || title.includes('summary')) {
      return ['capability_statement']
    }
    return ['standard_approach', 'win_theme']
  }

  useEffect(() => {
    async function loadItems() {
      setIsLoading(true)
      try {
        const types = getRelevantTypes()
        const allItems: typeof items = []

        for (const type of types) {
          const response = await contentLibraryApi.list(type) as {
            items: typeof items
          }
          allItems.push(...(response.items || []))
        }

        // Also load win_themes and standard_approach for all sections
        if (!types.includes('win_theme')) {
          const winThemes = await contentLibraryApi.list('win_theme') as { items: typeof items }
          allItems.push(...(winThemes.items || []))
        }
        if (!types.includes('standard_approach')) {
          const approaches = await contentLibraryApi.list('standard_approach') as { items: typeof items }
          allItems.push(...(approaches.items || []))
        }

        setItems(allItems)
      } catch (err) {
        console.error('Failed to load library items:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadItems()
  }, [sectionTitle])

  const handleInsert = async (item: typeof items[0]) => {
    const text = item.content?.text || item.content?.description || ''
    if (text) {
      // Record use
      try {
        await contentLibraryApi.recordUse(item.id, proposalId)
      } catch {
        // Non-critical, continue anyway
      }
      onInsert(text)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">Insert from Library</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Library className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No library items available</p>
              <p className="text-xs mt-1">Add content to your library first</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Badge variant="secondary" className="text-[10px] mb-1">
                        {item.type.replace('_', ' ')}
                      </Badge>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {item.content?.text || item.content?.description || ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInsert(item)}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
