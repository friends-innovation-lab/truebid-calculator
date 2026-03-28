'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { complianceApi, requirementsApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { ListChecks, Plus, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react'

// ==================== TYPES ====================

type ComplianceStatus = 'unaddressed' | 'compliant' | 'partial' | 'exception' | 'not_applicable'

type SourceType = 'requirement' | 'instruction'

interface ComplianceItem {
  id: string
  proposal_id: string
  requirement_id: string | null
  requirement_text: string
  requirement_ref: string | null
  proposal_section: string | null
  owner: string | null
  compliance_status: ComplianceStatus
  notes: string | null
  source: SourceType
  created_at: string
  updated_at: string
}

interface ComplianceStats {
  total: number
  compliant: number
  partial: number
  unaddressed: number
  exception: number
  not_applicable: number
}

const PROPOSAL_SECTIONS = [
  'Volume I, Section 1 — Executive Summary',
  'Volume I, Section 2 — Technical Approach',
  'Volume I, Section 3 — Management Approach',
  'Volume I, Section 4 — Past Performance',
  'Volume II, Section 1 — Price/Cost',
  'Volume II, Section 2 — Basis of Estimate',
  'Other',
]

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; borderColor: string }> = {
  unaddressed: { label: 'Unaddressed', color: 'bg-gray-100 text-gray-700', borderColor: '' },
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-800', borderColor: 'border-l-green-500' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800', borderColor: 'border-l-amber-500' },
  exception: { label: 'Exception', color: 'bg-red-100 text-red-800', borderColor: 'border-l-red-500' },
  not_applicable: { label: 'N/A', color: 'bg-gray-50 text-gray-500 italic', borderColor: 'border-l-gray-300' },
}

// ==================== MAIN COMPONENT ====================

export function ComplianceMatrix() {
  const params = useParams()
  const proposalId = params?.id as string

  const [items, setItems] = useState<ComplianceItem[]>([])
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRequirements, setHasRequirements] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Filters
  const [filterSource, setFilterSource] = useState<'all' | 'requirement' | 'instruction'>('all')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Load data on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadData() {
      try {
        // Check if requirements exist
        const reqResponse = await requirementsApi.list(proposalId) as {
          requirements: unknown[]
        }
        setHasRequirements((reqResponse.requirements?.length || 0) > 0)

        // Load compliance items
        const response = await complianceApi.list(proposalId) as {
          items: ComplianceItem[]
          stats: ComplianceStats
        }
        setItems(response.items || [])
        setStats(response.stats || null)
      } catch (err) {
        console.warn('[ComplianceMatrix] Failed to load:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [proposalId])

  const generateMatrix = async () => {
    if (!proposalId) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await complianceApi.generate(proposalId) as {
        items: ComplianceItem[]
        count: number
      }
      setItems(response.items || [])
      // Refresh stats
      const statsResponse = await complianceApi.list(proposalId) as {
        stats: ComplianceStats
      }
      setStats(statsResponse.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate matrix')
    } finally {
      setIsGenerating(false)
    }
  }

  const regenerateMatrix = async () => {
    setShowRegenerateConfirm(false)
    setIsGenerating(true)
    setError(null)

    try {
      const response = await complianceApi.regenerate(proposalId) as {
        items: ComplianceItem[]
        count: number
      }
      setItems(response.items || [])
      // Refresh stats
      const statsResponse = await complianceApi.list(proposalId) as {
        stats: ComplianceStats
      }
      setStats(statsResponse.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate matrix')
    } finally {
      setIsGenerating(false)
    }
  }

  // Get unique owners for filter dropdown
  const uniqueOwners = [...new Set(items.map(i => i.owner).filter(Boolean))]

  // Count items by source
  const requirementCount = items.filter(i => i.source === 'requirement' || !i.source).length
  const instructionCount = items.filter(i => i.source === 'instruction').length

  // Filter items
  const filteredItems = items.filter(item => {
    if (filterSource !== 'all') {
      const itemSource = item.source || 'requirement'
      if (filterSource !== itemSource) return false
    }
    if (filterSection !== 'all' && item.proposal_section !== filterSection) return false
    if (filterStatus !== 'all' && item.compliance_status !== filterStatus) return false
    if (filterOwner !== 'all' && item.owner !== filterOwner) return false
    if (searchQuery && !item.requirement_text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

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
          <h2 className="text-xl font-semibold text-gray-900">Compliance Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mapping requirements to proposal sections...
          </p>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ListChecks className="w-6 h-6 text-blue-600 animate-pulse" />
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
          <h2 className="text-xl font-semibold text-gray-900">Compliance Matrix</h2>
        </div>
        <ErrorAlert
          variant="page"
          title="Failed to load matrix"
          message={error}
          onRetry={() => {
            setError(null)
            if (items.length === 0) {
              generateMatrix()
            }
          }}
        />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Compliance Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Map every requirement to a proposal section and track completion
          </p>
        </div>
        <EmptyState
          icon={ListChecks}
          title="Generate compliance matrix"
          description={
            hasRequirements
              ? "AI will map your extracted requirements to proposal sections. You can adjust any mapping manually."
              : "Extract requirements first from the Requirements view, then return here to generate the matrix."
          }
          action={
            hasRequirements
              ? { label: 'Generate Matrix', onClick: generateMatrix }
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Compliance Matrix</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Map every requirement to a proposal section and track completion
        </p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-4 flex-wrap">
          <StatBadge label="Total" value={stats.total} color="gray" />
          <StatBadge label="Compliant" value={stats.compliant} color="green" />
          <StatBadge label="Partial" value={stats.partial} color="amber" />
          <StatBadge label="Unaddressed" value={stats.unaddressed} color="gray" />
          <StatBadge label="Exception" value={stats.exception} color="red" />
          <StatBadge label="N/A" value={stats.not_applicable} color="gray" />
        </div>
      )}

      {/* Source Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setFilterSource('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filterSource === 'all'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilterSource('requirement')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filterSource === 'requirement'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Requirements ({requirementCount})
        </button>
        <button
          onClick={() => setFilterSource('instruction')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filterSource === 'instruction'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Instructions ({instructionCount})
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterSection} onValueChange={setFilterSection}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {PROPOSAL_SECTIONS.map(section => (
              <SelectItem key={section} value={section}>{section}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {uniqueOwners.length > 0 && (
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {uniqueOwners.map(owner => (
                <SelectItem key={owner} value={owner!}>{owner}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setShowRegenerateConfirm(true)}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Regenerate
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add item
          </Button>
        </div>
      </div>

      {/* Compliance Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Ref</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requirement</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-56">Section</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Owner</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-48">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map(item => (
                <ComplianceRow
                  key={item.id}
                  item={item}
                  proposalId={proposalId}
                  isInstruction={item.source === 'instruction'}
                  onUpdate={(updated) => {
                    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate compliance matrix?</DialogTitle>
            <DialogDescription>
              This will delete all existing items and generate a new matrix from your requirements.
              Any manual edits will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={regenerateMatrix}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        proposalId={proposalId}
        onAdd={(newItem) => {
          setItems(prev => [...prev, newItem])
          if (stats) {
            setStats({
              ...stats,
              total: stats.total + 1,
              unaddressed: stats.unaddressed + 1,
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
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
      <span className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

interface ComplianceRowProps {
  item: ComplianceItem
  proposalId: string
  isInstruction?: boolean
  onUpdate: (item: ComplianceItem) => void
}

function ComplianceRow({ item, proposalId, isInstruction, onUpdate }: ComplianceRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const statusConfig = STATUS_CONFIG[item.compliance_status]

  const updateField = useCallback(async (field: string, value: string) => {
    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await complianceApi.update(proposalId, item.id, {
          [field]: value || null,
        }) as { item: ComplianceItem }
        onUpdate(response.item)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1000)
  }, [proposalId, item.id, onUpdate])

  // Use purple border for instructions, otherwise use status-based color
  const borderColor = isInstruction ? 'border-l-purple-400' : statusConfig.borderColor

  return (
    <tr className={`border-l-4 ${borderColor} hover:bg-gray-50`}>
      {/* Ref */}
      <td className="px-3 py-2 font-mono text-xs text-gray-600">
        {item.requirement_ref || '—'}
      </td>

      {/* Requirement */}
      <td className="px-3 py-2">
        <div className="flex items-start gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 mt-0.5"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <p className={`text-sm text-gray-900 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {item.requirement_text}
          </p>
        </div>
      </td>

      {/* Section */}
      <td className="px-3 py-2">
        <Select
          value={item.proposal_section || ''}
          onValueChange={(value) => updateField('proposal_section', value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            {PROPOSAL_SECTIONS.map(section => (
              <SelectItem key={section} value={section} className="text-xs">
                {section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Owner */}
      <td className="px-3 py-2">
        {editingField === 'owner' ? (
          <Input
            defaultValue={item.owner || ''}
            autoFocus
            className="h-8 text-xs"
            onBlur={(e) => {
              updateField('owner', e.target.value)
              setEditingField(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateField('owner', e.currentTarget.value)
                setEditingField(null)
              }
            }}
          />
        ) : (
          <button
            className="text-xs text-gray-600 hover:text-gray-900 text-left w-full"
            onClick={() => setEditingField('owner')}
          >
            {item.owner || <span className="text-gray-400">Add owner</span>}
          </button>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <Select
          value={item.compliance_status}
          onValueChange={(value) => updateField('compliance_status', value)}
        >
          <SelectTrigger className={`h-8 text-xs ${statusConfig.color} border-0`}>
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
      </td>

      {/* Notes */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {editingField === 'notes' ? (
            <Textarea
              defaultValue={item.notes || ''}
              autoFocus
              className="text-xs min-h-[60px]"
              onBlur={(e) => {
                updateField('notes', e.target.value)
                setEditingField(null)
              }}
            />
          ) : (
            <button
              className="text-xs text-gray-600 hover:text-gray-900 text-left line-clamp-2"
              onClick={() => setEditingField('notes')}
            >
              {item.notes || <span className="text-gray-400">Add notes</span>}
            </button>
          )}
          <SaveStatus status={saveStatus} />
        </div>
      </td>
    </tr>
  )
}

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  onAdd: (item: ComplianceItem) => void
}

function AddItemDialog({ open, onOpenChange, proposalId, onAdd }: AddItemDialogProps) {
  const [requirementText, setRequirementText] = useState('')
  const [requirementRef, setRequirementRef] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!requirementText.trim()) return

    setIsSubmitting(true)
    try {
      const response = await complianceApi.create(proposalId, {
        requirement_text: requirementText,
        requirement_ref: requirementRef || undefined,
      }) as { item: ComplianceItem }
      onAdd(response.item)
      setRequirementText('')
      setRequirementRef('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to add item:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add compliance item</DialogTitle>
          <DialogDescription>
            Manually add a requirement to track in the compliance matrix.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reference (optional)</label>
            <Input
              placeholder="e.g., REQ-001, Section C.3.2"
              value={requirementRef}
              onChange={(e) => setRequirementRef(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Requirement text</label>
            <Textarea
              placeholder="Enter the requirement..."
              value={requirementText}
              onChange={(e) => setRequirementText(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!requirementText.trim() || isSubmitting}>
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ComplianceMatrix
