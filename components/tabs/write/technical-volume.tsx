'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation'
import { sectionsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
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
  FileText,
  ChevronRight,
  ChevronDown,
  PenLine,
  AlertCircle,
} from 'lucide-react'
import { SectionEditor, Section } from './section-editor'
import { cn } from '@/lib/utils'

// ==================== TYPES ====================

type SectionStatus = 'draft' | 'in_progress' | 'review' | 'complete' | 'locked'

const STATUS_DOT_COLORS: Record<SectionStatus, string> = {
  draft: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  complete: 'bg-green-500',
  locked: 'bg-purple-500',
}

// ==================== MAIN COMPONENT ====================

export function TechnicalVolume() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const proposalId = params?.id as string

  const [sections, setSections] = useState<Section[]>([])
  // Get sectionId from URL params for persistence across navigation
  const urlSectionId = searchParams.get('sectionId')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const pendingCallbackRef = useRef<(() => void) | null>(null)

  // Load sections on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadData() {
      try {
        const response = await sectionsApi.list(proposalId) as {
          sections: Section[]
        }
        setSections(response.sections || [])

        // Expand all top-level sections
        const topLevel = (response.sections || [])
          .filter(s => !s.parentId)
          .map(s => s.id)
        setExpandedSections(new Set(topLevel))

        // Set default section in URL if none specified
        if (response.sections?.length > 0 && !searchParams.get('sectionId')) {
          const firstSection = response.sections.find(s => !s.parentId) || response.sections[0]
          router.replace(`${pathname}?sectionId=${firstSection.id}`)
        }
      } catch (err) {
        console.error('[TechnicalVolume] Failed to load:', err)
        setError(err instanceof Error ? err.message : 'Failed to load sections')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [proposalId])

  // Compute selected section from URL or default to first
  const selectedSectionId = urlSectionId || sections.find(s => !s.parentId)?.id || sections[0]?.id || null

  // Handle section selection with unsaved changes check
  const handleSelectSection = useCallback((sectionId: string) => {
    if (sectionId === selectedSectionId) return

    if (hasUnsavedChanges) {
      setPendingSectionId(sectionId)
      setShowUnsavedDialog(true)
    } else {
      router.push(`${pathname}?sectionId=${sectionId}`)
    }
  }, [selectedSectionId, hasUnsavedChanges, router, pathname])

  const proceedWithoutSaving = () => {
    setHasUnsavedChanges(false)
    if (pendingSectionId) {
      router.push(`${pathname}?sectionId=${pendingSectionId}`)
      setPendingSectionId(null)
    }
    if (pendingCallbackRef.current) {
      pendingCallbackRef.current()
      pendingCallbackRef.current = null
    }
    setShowUnsavedDialog(false)
  }

  const cancelNavigation = () => {
    setPendingSectionId(null)
    pendingCallbackRef.current = null
    setShowUnsavedDialog(false)
  }

  const toggleExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const handleUpdateSection = useCallback((updated: Section) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s))
    setHasUnsavedChanges(false)
  }, [])

  // AI Draft generation
  const handleGenerateDraft = useCallback(async () => {
    if (!selectedSectionId) return

    const section = sections.find(s => s.id === selectedSectionId)
    if (!section) return

    setIsGeneratingDraft(true)

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/sections/${selectedSectionId}/draft`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error('Failed to generate draft')
      }

      const data = await response.json()

      // Update the section with generated content
      const updatedSection = {
        ...section,
        content: data.content,
        contentText: data.contentText,
      }
      handleUpdateSection(updatedSection)
    } catch (err) {
      console.error('Failed to generate draft:', err)
    } finally {
      setIsGeneratingDraft(false)
    }
  }, [selectedSectionId, sections, proposalId, handleUpdateSection])

  // Build tree structure
  const buildTree = (items: Section[], parentId: string | null = null): Section[] => {
    return items
      .filter(item => item.parentId === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }

  const rootSections = buildTree(sections, null)
  const selectedSection = sections.find(s => s.id === selectedSectionId)

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex">
        <div className="w-60 border-r border-gray-200 bg-gray-50 p-4">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading editor...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <ErrorAlert
          variant="page"
          title="Failed to load sections"
          message={error}
          onRetry={() => {
            setError(null)
            setIsLoading(true)
            window.location.reload()
          }}
        />
      </div>
    )
  }

  // Empty state
  if (sections.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <EmptyState
          icon={FileText}
          title="No sections yet"
          description="Generate a proposal outline first from the Outline view, then return here to write your content."
        />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Section List */}
      <div className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Sections
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {rootSections.map(section => (
            <CompactSectionItem
              key={section.id}
              section={section}
              allSections={sections}
              depth={0}
              isExpanded={expandedSections.has(section.id)}
              onToggleExpand={toggleExpand}
              expandedSections={expandedSections}
              selectedSectionId={selectedSectionId}
              onSelect={handleSelectSection}
            />
          ))}
        </div>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSection ? (
          <SectionEditor
            section={selectedSection}
            proposalId={proposalId}
            onUpdate={handleUpdateSection}
            onGenerateDraft={handleGenerateDraft}
            isGeneratingDraft={isGeneratingDraft}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Select a section to start writing</p>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Unsaved changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes in this section. Do you want to leave without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelNavigation}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={proceedWithoutSaving}>
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== COMPACT SECTION ITEM ====================

interface CompactSectionItemProps {
  section: Section
  allSections: Section[]
  depth: number
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  expandedSections: Set<string>
  selectedSectionId: string | null
  onSelect: (id: string) => void
}

function CompactSectionItem({
  section,
  allSections,
  depth,
  isExpanded,
  onToggleExpand,
  expandedSections,
  selectedSectionId,
  onSelect,
}: CompactSectionItemProps) {
  const children = allSections
    .filter(s => s.parentId === section.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const hasChildren = children.length > 0
  const isSelected = section.id === selectedSectionId

  return (
    <>
      <button
        onClick={() => onSelect(section.id)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
          'hover:bg-gray-100',
          isSelected && 'bg-white shadow-sm border-l-2 border-blue-500'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(section.id)
            }}
            className="p-0.5 hover:bg-gray-200 rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Status Dot */}
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            STATUS_DOT_COLORS[section.status]
          )}
          title={section.status.replace('_', ' ')}
        />

        {/* Section Number */}
        {section.sectionNumber && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0">
            {section.sectionNumber}
          </Badge>
        )}

        {/* Title and Open Button */}
        <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
          <span
            className={cn(
              'truncate',
              isSelected ? 'font-medium text-gray-900' : 'text-gray-600'
            )}
          >
            {section.title}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#111',
              padding: '3px 8px',
              border: '0.5px solid #E8E7E2',
              borderRadius: '4px',
              background: '#fff',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Open →
          </span>
        </div>
      </button>

      {/* Children */}
      {isExpanded && children.map(child => (
        <CompactSectionItem
          key={child.id}
          section={child}
          allSections={allSections}
          depth={depth + 1}
          isExpanded={expandedSections.has(child.id)}
          onToggleExpand={onToggleExpand}
          expandedSections={expandedSections}
          selectedSectionId={selectedSectionId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export default TechnicalVolume
