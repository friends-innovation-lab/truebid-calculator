'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { contentLibraryApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Library,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  Sparkles,
  Briefcase,
  User,
  FileText,
  Lightbulb,
  Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentLibraryItem, ContentType } from '@/lib/schemas/content-library'

// ==================== CONSTANTS ====================

const CONTENT_TYPES: { value: ContentType; label: string; icon: LucideIcon; color: string; bgColor: string }[] = [
  { value: 'past_performance', label: 'Past Performance', icon: Briefcase, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'key_personnel', label: 'Key Personnel', icon: User, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { value: 'capability_statement', label: 'Capability Statement', icon: FileText, color: 'text-teal-700', bgColor: 'bg-teal-100' },
  { value: 'standard_approach', label: 'Standard Approaches', icon: Lightbulb, color: 'text-amber-700', bgColor: 'bg-amber-100' },
  { value: 'win_theme', label: 'Win Themes', icon: Trophy, color: 'text-green-700', bgColor: 'bg-green-100' },
]

const CLEARANCE_LEVELS = ['None', 'Public Trust', 'Secret', 'Top Secret', 'TS/SCI']
const APPROACH_CATEGORIES = ['agile', 'engineering', 'design', 'research', 'product', 'delivery', 'security', 'accessibility', 'quality', 'transition', 'staffing', 'other']

// ==================== HELPERS ====================

function getTypeConfig(type: ContentType) {
  return CONTENT_TYPES.find(t => t.value === type) || CONTENT_TYPES[0]
}

function getContentPreview(item: ContentLibraryItem): string {
  const content = item.content as Record<string, unknown>
  switch (item.type) {
    case 'past_performance':
      return (content.scope_description as string) || (content.relevance_statement as string) || ''
    case 'key_personnel':
      return (content.bio as string) || ''
    case 'capability_statement':
      return (content.overview as string) || ''
    case 'standard_approach':
      return (content.body as string) || ''
    case 'win_theme':
      return (content.discriminator_statement as string) || (content.theme as string) || ''
    default:
      return ''
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== MAIN COMPONENT ====================

export function ContentLibraryPage() {
  const [items, setItems] = useState<ContentLibraryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ContentType | 'all'>('all')
  const [editingItem, setEditingItem] = useState<ContentLibraryItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createType, setCreateType] = useState<ContentType>('past_performance')

  // Load items
  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      setIsLoading(true)
      const response = await contentLibraryApi.list() as { items: ContentLibraryItem[] }
      setItems(response.items || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content library')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = () => {
    const type = activeTab === 'all' ? 'past_performance' : activeTab
    setCreateType(type)
    setIsCreating(true)
  }

  const handleSaveNew = async (data: { title: string; content: Record<string, unknown>; tags?: string[] }) => {
    try {
      const response = await contentLibraryApi.create({
        type: createType,
        title: data.title,
        content: data.content,
        tags: data.tags,
      }) as { item: ContentLibraryItem }
      setItems(prev => [response.item, ...prev])
      setIsCreating(false)
      toast.success('Item created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item')
    }
  }

  const handleUpdate = async (itemId: string, data: Partial<ContentLibraryItem>) => {
    try {
      const response = await contentLibraryApi.update(itemId, data) as { item: ContentLibraryItem }
      setItems(prev => prev.map(i => i.id === itemId ? response.item : i))
      toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleDelete = async (itemId: string) => {
    try {
      await contentLibraryApi.delete(itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      setEditingItem(null)
      toast.success('Item deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  // Filter items by active tab
  const filteredItems = activeTab === 'all'
    ? items
    : items.filter(i => i.type === activeTab)

  // Count by type
  const countByType = (type: ContentType) => items.filter(i => i.type === type).length

  // Get add button label
  const getAddLabel = () => {
    if (activeTab === 'all') return 'Add Content'
    const config = getTypeConfig(activeTab)
    return `Add ${config.label.replace(/s$/, '')}`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Content Library</h2>
        </div>
        <ErrorAlert
          variant="page"
          title="Failed to load content library"
          message={error}
          onRetry={loadItems}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Content Library</h2>
          <p className="text-sm text-gray-600 mt-1">Reusable content blocks for proposals</p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {getAddLabel()}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({items.length})
        </button>
        {CONTENT_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => setActiveTab(type.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === type.value
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.label} ({countByType(type.value)})
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {filteredItems.length === 0 ? (
        <EmptyStateForType
          type={activeTab === 'all' ? null : activeTab}
          onAdd={handleCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* Edit Slideout */}
      {editingItem && (
        <ContentSlideout
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(data) => handleUpdate(editingItem.id, data)}
          onDelete={() => handleDelete(editingItem.id)}
        />
      )}

      {/* Create Slideout */}
      {isCreating && (
        <CreateSlideout
          type={createType}
          onClose={() => setIsCreating(false)}
          onSave={handleSaveNew}
        />
      )}
    </div>
  )
}

// ==================== EMPTY STATES ====================

function EmptyStateForType({ type, onAdd }: { type: ContentType | null; onAdd: () => void }) {
  const descriptions: Record<ContentType, string> = {
    past_performance: 'Add contracts you\'ve completed to reference in future proposals. Strong past performance is often the deciding factor in source selection.',
    key_personnel: 'Build a library of key personnel bios that can be quickly inserted into proposals. Include education, certifications, and relevant experience.',
    capability_statement: 'Create reusable capability statements that highlight your company\'s core competencies and differentiators.',
    standard_approach: 'Document your standard approaches to Agile, security, quality, and other common proposal sections.',
    win_theme: 'Capture win themes and discriminators that set your company apart from competitors.',
  }

  if (!type) {
    return (
      <EmptyState
        icon={Library}
        title="Your content library is empty"
        description="Add reusable content blocks like past performance, key personnel, and win themes to speed up proposal writing."
        action={{ label: 'Add Content', onClick: onAdd }}
      />
    )
  }

  const config = getTypeConfig(type)
  return (
    <EmptyState
      icon={config.icon}
      title={`No ${config.label.toLowerCase()} yet`}
      description={descriptions[type]}
      action={{ label: `Add ${config.label.replace(/s$/, '')}`, onClick: onAdd }}
    />
  )
}

// ==================== CONTENT CARD ====================

function ContentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ContentLibraryItem
  onEdit: () => void
  onDelete: () => void
}) {
  const config = getTypeConfig(item.type)
  const preview = getContentPreview(item)
  const Icon = config.icon

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className={`text-[10px] ${config.bgColor} ${config.color} mb-1 capitalize`}>
              {item.type === 'standard_approach' && (item.content as Record<string, unknown>)?.category
                ? (item.content as Record<string, unknown>).category as string
                : config.label}
            </Badge>
            <h4 className="font-medium text-sm text-gray-900 truncate">{item.title}</h4>
            {preview && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{preview.slice(0, 100)}...</p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-[10px] text-gray-400">+{item.tags.length - 3}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Used {item.use_count} time{item.use_count !== 1 ? 's' : ''}</span>
              {item.last_used_at && (
                <>
                  <span>•</span>
                  <span>Last used {formatDate(item.last_used_at)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
            aria-label="Edit item"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
            aria-label="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ==================== SLIDEOUT PANELS ====================

interface SlideoutProps {
  onClose: () => void
}

function ContentSlideout({
  item,
  onClose,
  onSave,
  onDelete,
}: SlideoutProps & {
  item: ContentLibraryItem
  onSave: (data: Partial<ContentLibraryItem>) => Promise<void>
  onDelete: () => void
}) {
  const config = getTypeConfig(item.type)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <config.icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit {config.label.replace(/s$/, '')}</h3>
              <p className="text-sm text-gray-500">{item.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ContentForm
            type={item.type}
            initialData={{ title: item.title, content: item.content, tags: item.tags }}
            onSave={onSave}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </>
  )
}

function CreateSlideout({
  type,
  onClose,
  onSave,
}: SlideoutProps & {
  type: ContentType
  onSave: (data: { title: string; content: Record<string, unknown>; tags?: string[] }) => Promise<void>
}) {
  const config = getTypeConfig(type)
  const [isSaving, setIsSaving] = useState(false)
  const formRef = useRef<{ getData: () => { title: string; content: Record<string, unknown>; tags?: string[] } } | null>(null)

  const handleSave = async () => {
    if (!formRef.current) return
    const data = formRef.current.getData()
    if (!data.title.trim()) {
      toast.error('Title is required')
      return
    }
    setIsSaving(true)
    try {
      await onSave(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <config.icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Add {config.label.replace(/s$/, '')}</h3>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ContentForm
            ref={formRef}
            type={type}
            initialData={{ title: '', content: {}, tags: [] }}
            isCreate
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create
          </Button>
        </div>
      </div>
    </>
  )
}

// ==================== CONTENT FORM ====================

interface ContentFormData {
  title: string
  content: Record<string, unknown>
  tags?: string[]
}

interface ContentFormProps {
  type: ContentType
  initialData: ContentFormData
  onSave?: (data: Partial<ContentLibraryItem>) => Promise<void>
  isCreate?: boolean
}

const ContentForm = React.forwardRef<
  { getData: () => ContentFormData },
  ContentFormProps
>(function ContentForm({ type, initialData, onSave, isCreate }, ref) {
  const [title, setTitle] = useState(initialData.title)
  const [content, setContent] = useState<Record<string, unknown>>(initialData.content)
  const [tags, setTags] = useState<string[]>(initialData.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Expose getData for create mode
  React.useImperativeHandle(ref, () => ({
    getData: () => ({ title, content, tags }),
  }))

  // Autosave for edit mode
  const debouncedSave = useCallback(async (data: Partial<ContentLibraryItem>) => {
    if (isCreate || !onSave) return
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSave(data)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 1500)
  }, [isCreate, onSave])

  const updateContent = (field: string, value: unknown) => {
    const newContent = { ...content, [field]: value }
    setContent(newContent)
    debouncedSave({ content: newContent })
  }

  const updateTitle = (value: string) => {
    setTitle(value)
    debouncedSave({ title: value })
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()]
      setTags(newTags)
      setTagInput('')
      debouncedSave({ tags: newTags })
    }
  }

  const removeTag = (tag: string) => {
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    debouncedSave({ tags: newTags })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Save Status */}
      {!isCreate && saveStatus !== 'idle' && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3 h-3 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Enter a descriptive title"
        />
      </div>

      {/* Type-specific fields */}
      {type === 'past_performance' && (
        <PastPerformanceFields content={content} updateContent={updateContent} />
      )}
      {type === 'key_personnel' && (
        <KeyPersonnelFields content={content} updateContent={updateContent} />
      )}
      {type === 'capability_statement' && (
        <CapabilityStatementFields content={content} updateContent={updateContent} />
      )}
      {type === 'standard_approach' && (
        <StandardApproachFields content={content} updateContent={updateContent} />
      )}
      {type === 'win_theme' && (
        <WinThemeFields content={content} updateContent={updateContent} />
      )}

      {/* Tags */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add a tag..."
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="pr-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// ==================== TYPE-SPECIFIC FORM FIELDS ====================

function PastPerformanceFields({
  content,
  updateContent,
}: {
  content: Record<string, unknown>
  updateContent: (field: string, value: unknown) => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState('')

  const handleAIDraft = async () => {
    setShowPrompt(true)
  }

  const handlePromptSubmit = async () => {
    const description = promptValue.trim()
    if (!description) return
    setShowPrompt(false)
    setPromptValue('')

    setIsGenerating(true)
    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'past_performance_scope',
          context: {
            contract_name: content.contract_name,
            agency: content.agency,
            description,
          },
        }),
      })
      if (response.ok) {
        const data = await response.json()
        updateContent('scope_description', data.content)
        toast.success('Draft generated')
      }
    } catch {
      toast.error('Failed to generate draft')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contract_name">Contract Name *</Label>
          <Input
            id="contract_name"
            value={(content.contract_name as string) || ''}
            onChange={(e) => updateContent('contract_name', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agency">Agency *</Label>
          <Input
            id="agency"
            value={(content.agency as string) || ''}
            onChange={(e) => updateContent('agency', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contract_number">Contract Number</Label>
          <Input
            id="contract_number"
            value={(content.contract_number as string) || ''}
            onChange={(e) => updateContent('contract_number', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract_value">Contract Value ($)</Label>
          <Input
            id="contract_value"
            type="number"
            value={(content.contract_value as number) || ''}
            onChange={(e) => updateContent('contract_value', parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="period_start">Period Start</Label>
          <Input
            id="period_start"
            type="date"
            value={(content.period_start as string) || ''}
            onChange={(e) => updateContent('period_start', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_end">Period End</Label>
          <Input
            id="period_end"
            type="date"
            value={(content.period_end as string) || ''}
            onChange={(e) => updateContent('period_end', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Our Role</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={(content.role as string) === 'prime' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateContent('role', 'prime')}
          >
            Prime
          </Button>
          <Button
            type="button"
            variant={(content.role as string) === 'subcontractor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateContent('role', 'subcontractor')}
          >
            Subcontractor
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="naics_codes">NAICS Codes (comma separated)</Label>
        <Input
          id="naics_codes"
          value={((content.naics_codes as string[]) || []).join(', ')}
          onChange={(e) => updateContent('naics_codes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="541511, 541512"
        />
      </div>

      {showPrompt && (
        <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Label className="text-sm text-blue-800">Briefly describe what this contract involved:</Label>
          <Textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder="e.g. Modernized the agency's case management system, migrated from legacy Oracle DB..."
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowPrompt(false); setPromptValue('') }}>Cancel</Button>
            <Button size="sm" onClick={handlePromptSubmit} disabled={!promptValue.trim()}>Generate</Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="scope_description">Scope Description *</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAIDraft}
            disabled={isGenerating}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Draft with AI
          </Button>
        </div>
        <Textarea
          id="scope_description"
          value={(content.scope_description as string) || ''}
          onChange={(e) => updateContent('scope_description', e.target.value)}
          placeholder="Describe what work was performed, the systems involved, and the scale of the effort."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="relevance_statement">Relevance Statement *</Label>
        <Textarea
          id="relevance_statement"
          value={(content.relevance_statement as string) || ''}
          onChange={(e) => updateContent('relevance_statement', e.target.value)}
          placeholder="Why is this contract relevant to the opportunity you are bidding? Connect the past work to the new requirement."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="results">Results</Label>
        <Textarea
          id="results"
          value={(content.results as string) || ''}
          onChange={(e) => updateContent('results', e.target.value)}
          placeholder="Measurable outcomes, award fees received, performance ratings, notable achievements."
          rows={3}
        />
      </div>
    </div>
  )
}

function KeyPersonnelFields({
  content,
  updateContent,
}: {
  content: Record<string, unknown>
  updateContent: (field: string, value: unknown) => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState('')

  const handleAIDraft = async () => {
    setShowPrompt(true)
  }

  const handlePromptSubmit = async () => {
    const description = promptValue.trim()
    if (!description) return
    setShowPrompt(false)
    setPromptValue('')

    setIsGenerating(true)
    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'key_personnel_bio',
          context: {
            name: content.name,
            proposed_title: content.proposed_title,
            description,
          },
        }),
      })
      if (response.ok) {
        const data = await response.json()
        updateContent('bio', data.content)
        toast.success('Draft generated')
      }
    } catch {
      toast.error('Failed to generate draft')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={(content.name as string) || ''}
            onChange={(e) => updateContent('name', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposed_title">Proposed Title *</Label>
          <Input
            id="proposed_title"
            value={(content.proposed_title as string) || ''}
            onChange={(e) => updateContent('proposed_title', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clearance_level">Clearance Level</Label>
          <Select
            value={(content.clearance_level as string) || 'None'}
            onValueChange={(value) => updateContent('clearance_level', value)}
          >
            <SelectTrigger id="clearance_level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLEARANCE_LEVELS.map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="years_experience">Years of Experience</Label>
          <Input
            id="years_experience"
            type="number"
            value={(content.years_experience as number) || ''}
            onChange={(e) => updateContent('years_experience', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {showPrompt && (
        <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Label className="text-sm text-blue-800">Enter bullet points about this person (experience, skills, achievements):</Label>
          <Textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder="e.g. 10 years in federal IT, led 3 ATO processes, AWS certified..."
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowPrompt(false); setPromptValue('') }}>Cancel</Button>
            <Button size="sm" onClick={handlePromptSubmit} disabled={!promptValue.trim()}>Generate</Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">Bio *</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAIDraft}
            disabled={isGenerating}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Draft with AI
          </Button>
        </div>
        <Textarea
          id="bio"
          value={(content.bio as string) || ''}
          onChange={(e) => updateContent('bio', e.target.value)}
          placeholder="Write in third person. Include relevant experience, technical expertise, and what makes this person valuable for this work."
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="certifications">Certifications (comma separated)</Label>
        <Input
          id="certifications"
          value={((content.certifications as string[]) || []).join(', ')}
          onChange={(e) => updateContent('certifications', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="PMP, CISSP, AWS Solutions Architect"
        />
      </div>
    </div>
  )
}

function CapabilityStatementFields({
  content,
  updateContent,
}: {
  content: Record<string, unknown>
  updateContent: (field: string, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="overview">Company Overview *</Label>
        <Textarea
          id="overview"
          value={(content.overview as string) || ''}
          onChange={(e) => updateContent('overview', e.target.value)}
          placeholder="Brief overview of your company's mission and capabilities"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="core_competencies">Core Competencies (comma separated)</Label>
        <Input
          id="core_competencies"
          value={((content.core_competencies as string[]) || []).join(', ')}
          onChange={(e) => updateContent('core_competencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="Software Development, Cloud Migration, Cybersecurity"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="differentiators">Differentiators (comma separated)</Label>
        <Input
          id="differentiators"
          value={((content.differentiators as string[]) || []).join(', ')}
          onChange={(e) => updateContent('differentiators', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="10+ years DoS experience, Cleared workforce"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="naics_codes">NAICS Codes (comma separated)</Label>
        <Input
          id="naics_codes"
          value={((content.naics_codes as string[]) || []).join(', ')}
          onChange={(e) => updateContent('naics_codes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="541511, 541512, 541519"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="certifications">Certifications (comma separated)</Label>
        <Input
          id="certifications"
          value={((content.certifications as string[]) || []).join(', ')}
          onChange={(e) => updateContent('certifications', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="8(a), SDVOSB, ISO 9001"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contract_vehicles">Contract Vehicles (comma separated)</Label>
        <Input
          id="contract_vehicles"
          value={((content.contract_vehicles as string[]) || []).join(', ')}
          onChange={(e) => updateContent('contract_vehicles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="GSA MAS, CIO-SP3, SEWP V"
        />
      </div>
    </div>
  )
}

function StandardApproachFields({
  content,
  updateContent,
}: {
  content: Record<string, unknown>
  updateContent: (field: string, value: unknown) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={(content.category as string) || 'other'}
          onValueChange={(value) => updateContent('category', value)}
        >
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPROACH_CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body *</Label>
        <Textarea
          id="body"
          value={(content.body as string) || ''}
          onChange={(e) => updateContent('body', e.target.value)}
          placeholder="Write this as it would appear in a proposal section. Use clear headings and structured paragraphs."
          rows={10}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customization_notes">Customization Notes</Label>
        <Textarea
          id="customization_notes"
          value={(content.customization_notes as string) || ''}
          onChange={(e) => updateContent('customization_notes', e.target.value)}
          placeholder="What typically needs to change when using this in a specific proposal?"
          rows={3}
        />
      </div>
    </div>
  )
}

function WinThemeFields({
  content,
  updateContent,
}: {
  content: Record<string, unknown>
  updateContent: (field: string, value: unknown) => void
}) {
  const proofPoints = (content.proof_points as string[]) || []

  const addProofPoint = () => {
    if (proofPoints.length < 5) {
      updateContent('proof_points', [...proofPoints, ''])
    }
  }

  const updateProofPoint = (index: number, value: string) => {
    const newPoints = [...proofPoints]
    newPoints[index] = value
    updateContent('proof_points', newPoints)
  }

  const removeProofPoint = (index: number) => {
    updateContent('proof_points', proofPoints.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="theme">Theme *</Label>
        <Input
          id="theme"
          value={(content.theme as string) || ''}
          onChange={(e) => updateContent('theme', e.target.value)}
          placeholder="e.g., Deep State Dept experience"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discriminator_statement">Discriminator Statement *</Label>
        <Textarea
          id="discriminator_statement"
          value={(content.discriminator_statement as string) || ''}
          onChange={(e) => updateContent('discriminator_statement', e.target.value)}
          placeholder="In 2-3 sentences, articulate why your company wins on this theme. Be specific and evidence-based."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Proof Points (max 5)</Label>
          {proofPoints.length < 5 && (
            <Button type="button" variant="ghost" size="sm" onClick={addProofPoint}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {proofPoints.map((point, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={point}
                onChange={(e) => updateProofPoint(i, e.target.value)}
                placeholder="A specific fact, contract, or achievement that proves this theme."
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeProofPoint(i)}
                className="text-gray-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {proofPoints.length === 0 && (
            <p className="text-xs text-gray-500">No proof points added</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="best_used_for">Best Used For</Label>
        <Input
          id="best_used_for"
          value={(content.best_used_for as string) || ''}
          onChange={(e) => updateContent('best_used_for', e.target.value)}
          placeholder="e.g., DoS, civilian agencies, modernization contracts"
        />
      </div>
    </div>
  )
}

export default ContentLibraryPage
