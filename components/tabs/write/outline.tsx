'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { sectionsApi, complianceApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
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
  FileText,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Edit3,
  AlignLeft,
  Lock,
  Loader2,
} from 'lucide-react'

// ==================== TYPES ====================

type SectionStatus = 'draft' | 'in_progress' | 'review' | 'complete' | 'locked'

interface Section {
  id: string
  proposalId: string
  parentId: string | null
  sortOrder: number
  sectionNumber: string | null
  title: string
  summary: string | null
  content: string | null
  instructions: string | null
  complianceItemIds: string[]
  requirementRefs: string[]
  status: SectionStatus
  targetWordCount: number | null
  actualWordCount: number
  owner: string | null
  notes: string | null
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
}

interface SectionStats {
  total: number
  draft: number
  inProgress: number
  review: number
  complete: number
  locked: number
}

const STATUS_CONFIG: Record<SectionStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  review: { label: 'Review', color: 'bg-amber-100 text-amber-700', icon: AlignLeft },
  complete: { label: 'Complete', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  locked: { label: 'Locked', color: 'bg-purple-100 text-purple-700', icon: Lock },
}

// ==================== MAIN COMPONENT ====================

export function Outline() {
  const params = useParams()
  const proposalId = params?.id as string

  const [sections, setSections] = useState<Section[]>([])
  const [stats, setStats] = useState<SectionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasComplianceMatrix, setHasComplianceMatrix] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [editingSection, setEditingSection] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadData() {
      try {
        // Check if compliance matrix exists
        const compResponse = await complianceApi.list(proposalId) as {
          items: unknown[]
          stats: { total: number }
        }
        setHasComplianceMatrix((compResponse.stats?.total || 0) > 0)

        // Load sections
        const response = await sectionsApi.list(proposalId) as {
          sections: Section[]
          stats: SectionStats
        }
        setSections(response.sections || [])
        setStats(response.stats || null)

        // Expand all top-level sections by default
        const topLevel = (response.sections || [])
          .filter(s => !s.parentId)
          .map(s => s.id)
        setExpandedSections(new Set(topLevel))
      } catch (err) {
        console.warn('[Outline] Failed to load:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [proposalId])

  const generateOutline = async () => {
    if (!proposalId) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await sectionsApi.generate(proposalId) as {
        sections: Section[]
        count: number
      }
      setSections(response.sections || [])

      // Refresh stats
      const statsResponse = await sectionsApi.list(proposalId) as {
        stats: SectionStats
      }
      setStats(statsResponse.stats)

      // Expand all top-level sections
      const topLevel = (response.sections || [])
        .filter(s => !s.parentId)
        .map(s => s.id)
      setExpandedSections(new Set(topLevel))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate outline')
    } finally {
      setIsGenerating(false)
    }
  }

  const regenerateOutline = async () => {
    setShowRegenerateConfirm(false)
    setIsGenerating(true)
    setError(null)

    try {
      const response = await sectionsApi.regenerate(proposalId) as {
        sections: Section[]
        count: number
      }
      setSections(response.sections || [])

      // Refresh stats
      const statsResponse = await sectionsApi.list(proposalId) as {
        stats: SectionStats
      }
      setStats(statsResponse.stats)

      // Expand all top-level sections
      const topLevel = (response.sections || [])
        .filter(s => !s.parentId)
        .map(s => s.id)
      setExpandedSections(new Set(topLevel))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate outline')
    } finally {
      setIsGenerating(false)
    }
  }

  const lockAllSections = async () => {
    setShowLockConfirm(false)
    setIsLocking(true)
    setError(null)

    try {
      // Lock all sections that are not already locked
      const sectionsToLock = sections.filter(s => s.status !== 'locked')

      await Promise.all(
        sectionsToLock.map(section =>
          sectionsApi.update(proposalId, section.id, { status: 'locked' })
        )
      )

      // Update local state
      setSections(prev => prev.map(s => ({ ...s, status: 'locked' as SectionStatus })))

      // Refresh stats
      const statsResponse = await sectionsApi.list(proposalId) as {
        stats: SectionStats
      }
      setStats(statsResponse.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock sections')
    } finally {
      setIsLocking(false)
    }
  }

  const allSectionsLocked = sections.length > 0 && sections.every(s => s.status === 'locked')
  const unlockedCount = sections.filter(s => s.status !== 'locked').length

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
  }, [])

  const handleDeleteSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId && s.parentId !== sectionId))
  }, [])

  // Build tree structure
  const buildTree = (items: Section[], parentId: string | null = null): Section[] => {
    return items
      .filter(item => item.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const rootSections = buildTree(sections, null)

  // Render states
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <Card className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proposal Outline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generating outline from compliance matrix...
          </p>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <p className="text-sm text-gray-600">This may take 15-30 seconds...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proposal Outline</h2>
        </div>
        <ErrorAlert
          variant="page"
          title="Failed to load outline"
          message={error}
          onRetry={() => {
            setError(null)
            if (sections.length === 0) {
              generateOutline()
            }
          }}
        />
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proposal Outline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Structure your technical volume with AI-generated sections
          </p>
        </div>
        <EmptyState
          icon={FileText}
          title="Generate proposal outline"
          description={
            hasComplianceMatrix
              ? "AI will create a structured outline based on your compliance matrix. You can edit sections and add new ones manually."
              : "Generate a compliance matrix first in the Scope tab, then return here to create your outline."
          }
          action={
            hasComplianceMatrix
              ? { label: 'Generate Outline', onClick: generateOutline }
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proposal Outline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Structure your technical volume with AI-generated sections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowRegenerateConfirm(true)}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Regenerate
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Section
          </Button>
          <Button
            size="sm"
            variant={allSectionsLocked ? "outline" : "default"}
            onClick={() => setShowLockConfirm(true)}
            disabled={isLocking || allSectionsLocked}
          >
            {isLocking ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Locking...</>
            ) : allSectionsLocked ? (
              <><Lock className="w-4 h-4 mr-1.5" />All Locked</>
            ) : (
              <><Lock className="w-4 h-4 mr-1.5" />Lock All Sections</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-4 flex-wrap">
          <StatBadge label="Total" value={stats.total} color="gray" />
          <StatBadge label="Draft" value={stats.draft} color="gray" />
          <StatBadge label="In Progress" value={stats.inProgress} color="blue" />
          <StatBadge label="Review" value={stats.review} color="amber" />
          <StatBadge label="Complete" value={stats.complete} color="green" />
          <StatBadge label="Locked" value={stats.locked || 0} color="purple" />
        </div>
      )}

      {/* Outline Tree */}
      <Card className="divide-y divide-gray-100">
        {rootSections.map(section => (
          <SectionRow
            key={section.id}
            section={section}
            allSections={sections}
            depth={0}
            isExpanded={expandedSections.has(section.id)}
            onToggleExpand={toggleExpand}
            expandedSections={expandedSections}
            proposalId={proposalId}
            onUpdate={handleUpdateSection}
            onDelete={handleDeleteSection}
            isEditing={editingSection === section.id}
            setEditingSection={setEditingSection}
          />
        ))}
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate outline?</DialogTitle>
            <DialogDescription>
              This will delete all existing sections and generate a new outline from your compliance matrix.
              Any manual edits will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={regenerateOutline}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock All Sections Confirmation Dialog */}
      <Dialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock all sections?</DialogTitle>
            <DialogDescription>
              This will lock {unlockedCount} section{unlockedCount !== 1 ? 's' : ''} to mark them as final.
              Locked sections can still be unlocked individually if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={lockAllSections}>
              <Lock className="w-4 h-4 mr-1.5" />
              Lock All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        proposalId={proposalId}
        existingSections={sections}
        onAdd={(newSection) => {
          setSections(prev => [...prev, newSection])
          if (stats) {
            setStats({
              ...stats,
              total: stats.total + 1,
              draft: stats.draft + 1,
            })
          }
        }}
      />
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
      <span className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

interface SectionRowProps {
  section: Section
  allSections: Section[]
  depth: number
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  expandedSections: Set<string>
  proposalId: string
  onUpdate: (section: Section) => void
  onDelete: (id: string) => void
  isEditing: boolean
  setEditingSection: (id: string | null) => void
}

function SectionRow({
  section,
  allSections,
  depth,
  isExpanded,
  onToggleExpand,
  expandedSections,
  proposalId,
  onUpdate,
  onDelete,
  isEditing,
  setEditingSection,
}: SectionRowProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const children = allSections
    .filter(s => s.parentId === section.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const hasChildren = children.length > 0
  const statusConfig = STATUS_CONFIG[section.status]
  const StatusIcon = statusConfig.icon

  const updateField = useCallback(async (field: string, value: string) => {
    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await sectionsApi.update(proposalId, section.id, {
          [field]: value || null,
        }) as { section: Section }
        onUpdate(response.section)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1000)
  }, [proposalId, section.id, onUpdate])

  const handleDelete = async () => {
    try {
      await sectionsApi.delete(proposalId, section.id)
      onDelete(section.id)
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Failed to delete section:', err)
    }
  }

  const wordProgress = section.targetWordCount
    ? Math.min(100, Math.round((section.actualWordCount / section.targetWordCount) * 100))
    : null

  return (
    <>
      <div
        className={`flex items-center gap-2 py-3 px-4 hover:bg-gray-50 transition-colors ${
          depth > 0 ? 'border-l-2 border-gray-200' : ''
        }`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Drag Handle */}
        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(section.id)}
            className="p-0.5 hover:bg-gray-100 rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Section Number */}
        {section.sectionNumber && (
          <Badge variant="outline" className="font-mono text-xs shrink-0">
            {section.sectionNumber}
          </Badge>
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              defaultValue={section.title}
              autoFocus
              className="h-8 text-sm"
              onBlur={(e) => {
                updateField('title', e.target.value)
                setEditingSection(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateField('title', e.currentTarget.value)
                  setEditingSection(null)
                }
                if (e.key === 'Escape') {
                  setEditingSection(null)
                }
              }}
            />
          ) : (
            <button
              className="text-sm font-medium text-gray-900 text-left truncate hover:text-blue-600"
              onClick={() => setEditingSection(section.id)}
            >
              {section.title}
            </button>
          )}
        </div>

        {/* Word Count Progress */}
        {section.targetWordCount && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  wordProgress! >= 100 ? 'bg-green-500' : wordProgress! >= 50 ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                style={{ width: `${wordProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-20 text-right">
              {section.actualWordCount}/{section.targetWordCount}
            </span>
          </div>
        )}

        {/* Status */}
        <Select
          value={section.status}
          onValueChange={(value) => updateField('status', value)}
        >
          <SelectTrigger className={`h-7 w-28 text-xs ${statusConfig.color} border-0`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => {
              const Icon = config.icon
              return (
                <SelectItem key={value} value={value} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* AI Badge */}
        {section.aiGenerated && (
          <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-purple-50 text-purple-700">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            AI
          </Badge>
        )}

        {/* Save Status */}
        <SaveStatus status={saveStatus} />

        {/* Delete Button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1 text-gray-400 hover:text-red-600 rounded shrink-0"
          title="Delete section"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Children */}
      {isExpanded && children.map(child => (
        <SectionRow
          key={child.id}
          section={child}
          allSections={allSections}
          depth={depth + 1}
          isExpanded={expandedSections.has(child.id)}
          onToggleExpand={onToggleExpand}
          expandedSections={expandedSections}
          proposalId={proposalId}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isEditing={false}
          setEditingSection={setEditingSection}
        />
      ))}

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete section?</DialogTitle>
            <DialogDescription>
              {hasChildren
                ? `This will delete "${section.title}" and its ${children.length} subsection(s). This cannot be undone.`
                : `This will delete "${section.title}". This cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface AddSectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  existingSections: Section[]
  onAdd: (section: Section) => void
}

function AddSectionDialog({ open, onOpenChange, proposalId, existingSections, onAdd }: AddSectionDialogProps) {
  const [title, setTitle] = useState('')
  const [sectionNumber, setSectionNumber] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [summary, setSummary] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get root sections for parent dropdown
  const rootSections = existingSections.filter(s => !s.parentId)

  const handleSubmit = async () => {
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      const response = await sectionsApi.create(proposalId, {
        title,
        sectionNumber: sectionNumber || undefined,
        parentId: parentId || null,
        summary: summary || undefined,
        sortOrder: existingSections.length,
      }) as { section: Section }
      onAdd(response.section)
      setTitle('')
      setSectionNumber('')
      setParentId('')
      setSummary('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to add section:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add section</DialogTitle>
          <DialogDescription>
            Add a new section to your proposal outline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Section Number</label>
              <Input
                placeholder="e.g., 2.3"
                value={sectionNumber}
                onChange={(e) => setSectionNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent Section</label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="None (root level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (root level)</SelectItem>
                  {rootSections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.sectionNumber ? `${section.sectionNumber} - ` : ''}{section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Enter section title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Summary (optional)</label>
            <Textarea
              placeholder="Brief description of what this section covers..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isSubmitting}>
            Add Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default Outline
