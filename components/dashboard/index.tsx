'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { proposalsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { CardSkeletonGrid } from '@/components/ui/skeletons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  Building2,
  Check,
  Send,
  Trash2,
  Copy,
  Grid3X3,
  List,
  ChevronDown,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Upload,
  Sparkles,
  ArrowUpDown,
  Kanban,
  CalendarDays,
  Filter,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type ProposalStatus = 'draft' | 'in-review' | 'submitted' | 'won' | 'lost' | 'no-bid'
type ViewMode = 'grid' | 'list' | 'kanban' | 'calendar'
type SortOption = 'dueDate' | 'value' | 'updatedAt' | 'title' | 'status'

interface Proposal {
  id: string
  title: string
  solicitation: string
  client: string
  status: ProposalStatus
  totalValue: number
  dueDate: string | null
  updatedAt: string
  createdAt: string
  teamSize: number
  progress: number
  starred: boolean
  archived: boolean
  contractType: 'tm' | 'ffp' | 'hybrid'
  periodOfPerformance: string
}

// Card display settings - what shows on proposal cards
interface CardDisplaySettings {
  showStatus: boolean
  showContractType: boolean
  showDueDate: boolean
  showValue: boolean
  showClient: boolean
  showTeamSize: boolean
  showSolicitation: boolean
  showProgress: boolean
  showLastUpdated: boolean
}

const DEFAULT_CARD_SETTINGS: CardDisplaySettings = {
  showStatus: true,
  showContractType: true,
  showDueDate: true,
  showValue: true,
  showClient: true,
  showTeamSize: true,
  showSolicitation: true,
  showProgress: true,
  showLastUpdated: true,
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'prop-1',
    title: 'CAMP Modernization Services',
    solicitation: '19AQMM25Q0273',
    client: 'General Services Administration',
    status: 'draft',
    totalValue: 1247500,
    dueDate: '2025-12-20',
    updatedAt: '2025-12-13T10:30:00Z',
    createdAt: '2025-12-01T09:00:00Z',
    teamSize: 6,
    progress: 65,
    starred: true,
    archived: false,
    contractType: 'tm',
    periodOfPerformance: '1 Base + 2 OYs',
  },
  {
    id: 'prop-2',
    title: 'Data Analytics Platform',
    solicitation: 'HHS-2025-0142',
    client: 'Department of Health and Human Services',
    status: 'in-review',
    totalValue: 2100000,
    dueDate: '2025-12-28',
    updatedAt: '2025-12-12T14:20:00Z',
    createdAt: '2025-11-15T08:00:00Z',
    teamSize: 8,
    progress: 90,
    starred: true,
    archived: false,
    contractType: 'ffp',
    periodOfPerformance: '1 Base + 4 OYs',
  },
  {
    id: 'prop-3',
    title: 'Cloud Migration Support',
    solicitation: 'VA-IT-2025-0089',
    client: 'Department of Veterans Affairs',
    status: 'won',
    totalValue: 1890000,
    dueDate: null,
    updatedAt: '2025-12-10T16:45:00Z',
    createdAt: '2025-10-20T11:00:00Z',
    teamSize: 5,
    progress: 100,
    starred: false,
    archived: false,
    contractType: 'hybrid',
    periodOfPerformance: '1 Base + 2 OYs',
  },
  {
    id: 'prop-4',
    title: 'Cybersecurity Assessment',
    solicitation: 'DHS-CYBER-2025-012',
    client: 'Department of Homeland Security',
    status: 'lost',
    totalValue: 750000,
    dueDate: null,
    updatedAt: '2025-12-08T09:15:00Z',
    createdAt: '2025-10-05T14:00:00Z',
    teamSize: 4,
    progress: 100,
    starred: false,
    archived: false,
    contractType: 'ffp',
    periodOfPerformance: '1 Base + 1 OY',
  },
  {
    id: 'prop-5',
    title: 'Case Management System',
    solicitation: 'DOJ-CMS-2025-001',
    client: 'Department of Justice',
    status: 'submitted',
    totalValue: 3500000,
    dueDate: null,
    updatedAt: '2025-12-11T11:30:00Z',
    createdAt: '2025-09-15T10:00:00Z',
    teamSize: 12,
    progress: 100,
    starred: true,
    archived: false,
    contractType: 'tm',
    periodOfPerformance: '1 Base + 4 OYs',
  },
]

// ============================================================================
// UTILITIES
// ============================================================================

const formatCurrency = (value: number): string => {
  if (value === undefined || value === null) return '$0'
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toLocaleString()}`
}

const getDaysUntilDue = (dueDate: string | null): number | null => {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const diffTime = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getStatusConfig = (status: ProposalStatus) => {
  const configs = {
    'draft': { label: 'Draft', bgColor: 'bg-gray-100 text-gray-700', dotColor: 'bg-gray-400' },
    'in-review': { label: 'In Review', bgColor: 'bg-yellow-100 text-yellow-700', dotColor: 'bg-yellow-500' },
    'submitted': { label: 'Submitted', bgColor: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500' },
    'won': { label: 'Won', bgColor: 'bg-green-100 text-green-700', dotColor: 'bg-green-500' },
    'lost': { label: 'Lost', bgColor: 'bg-red-100 text-red-700', dotColor: 'bg-red-500' },
    'no-bid': { label: 'No Bid', bgColor: 'bg-gray-100 text-gray-500', dotColor: 'bg-gray-400' },
  }
  return configs[status]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPOSALS_STORAGE_KEY = 'truebid-proposals'
const RECENTLY_VIEWED_KEY = 'truebid-recently-viewed'
const CARD_SETTINGS_KEY = 'truebid-card-display-settings'

const STATUS_OPTIONS: { value: ProposalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in-review', label: 'In Review' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'no-bid', label: 'No Bid' },
]

const CONTRACT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'tm', label: 'T&M' },
  { value: 'ffp', label: 'FFP' },
  { value: 'hybrid', label: 'Hybrid' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'value', label: 'Value' },
  { value: 'title', label: 'Alphabetical' },
  { value: 'status', label: 'Status' },
]

// ============================================================================
// PROPOSAL CARD COMPONENT
// ============================================================================

function ProposalCard({
  proposal,
  onOpen,
  onDuplicate,
  onDelete,
  onToggleArchive,
  onStatusChange,
  isRecentlyViewed,
  displaySettings,
}: {
  proposal: Proposal
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleArchive: () => void
  onStatusChange: (status: ProposalStatus) => void
  isRecentlyViewed?: boolean
  displaySettings: CardDisplaySettings
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusConfig = getStatusConfig(proposal.status)
  const daysUntilDue = getDaysUntilDue(proposal.dueDate)
  const isUrgent = daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue >= 0
  const canArchive = ['won', 'lost', 'no-bid'].includes(proposal.status)

  const allStatuses: { id: ProposalStatus; label: string }[] = [
    { id: 'draft', label: 'Draft' },
    { id: 'in-review', label: 'In Review' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' },
    { id: 'no-bid', label: 'No Bid' },
  ]

  // Check if we have any metadata to show in footer
  const hasFooterContent = displaySettings.showSolicitation || 
    displaySettings.showValue || 
    displaySettings.showDueDate || 
    displaySettings.showTeamSize || 
    displaySettings.showLastUpdated ||
    displaySettings.showProgress

  return (
    <div
      className={`
        group rounded-xl p-4 bg-white shadow-sm
        hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer
        ${proposal.archived ? 'opacity-60' : 'border-l-4 border-l-emerald-500'}
      `}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      {/* Tags row - Recently viewed & Due soon */}
      {(isRecentlyViewed || (isUrgent && displaySettings.showDueDate)) && !proposal.archived && (
        <div className="flex items-center gap-2 mb-2">
          {isRecentlyViewed && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
              Recently viewed
            </span>
          )}
          {isUrgent && displaySettings.showDueDate && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due in {daysUntilDue}d
            </span>
          )}
        </div>
      )}

      {/* Header with title and actions */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-sm text-gray-900 leading-tight line-clamp-2 mb-1.5">
            {proposal.title}
          </h3>
          
          {/* Badges */}
          {(displaySettings.showStatus || displaySettings.showContractType || proposal.archived) && (
            <div className="flex items-center gap-1.5 mb-2">
              {/* Clickable Status Badge */}
              {displaySettings.showStatus && (
                <div className="relative">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowStatusMenu(!showStatusMenu); 
                    }}
                    className={`
                      inline-flex items-center text-[10px] px-1.5 py-0.5 h-5 rounded-md border-0 
                      font-medium transition-all hover:ring-2 hover:ring-blue-200
                      ${statusConfig.bgColor}
                    `}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConfig.dotColor}`} />
                    {statusConfig.label}
                    <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                  </button>
                  
                  {/* Status Dropdown */}
                  {showStatusMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }}
                      />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                        {allStatuses.map((status) => {
                          const config = getStatusConfig(status.id)
                          const isSelected = proposal.status === status.id
                          return (
                            <button
                              key={status.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                onStatusChange(status.id)
                                setShowStatusMenu(false)
                              }}
                              className={`
                                w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left
                                hover:bg-gray-50 transition-colors
                                ${isSelected ? 'bg-gray-50 font-medium' : ''}
                              `}
                            >
                              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                              {status.label}
                              {isSelected && <Check className="w-3 h-3 ml-auto text-blue-600" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {displaySettings.showContractType && (
                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0 h-5">
                  {(proposal.contractType || 'tm').toUpperCase()}
                </Badge>
              )}
              {proposal.archived && (
                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px] px-1.5 py-0 h-5">
                  Archived
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Action buttons - visible on hover */}
        <div className="flex gap-1 ml-2">
          {canArchive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onToggleArchive(); }}
              className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 
                         h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {proposal.archived ? (
                <ArchiveRestore className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 
                       h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 
                       h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Client */}
      {displaySettings.showClient && (
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{proposal.client || 'No agency specified'}</span>
        </div>
      )}

      {/* Horizontal Metrics Row */}
      {hasFooterContent && (
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
          {displaySettings.showValue && (
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Value</div>
              <div className="text-sm text-gray-900">{formatCurrency(proposal.totalValue)}</div>
            </div>
          )}
          {displaySettings.showDueDate && proposal.dueDate && ['draft', 'in-review'].includes(proposal.status) && (
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Due</div>
              <div className="text-sm text-gray-900">
                {new Date(proposal.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )}
          {displaySettings.showTeamSize && (
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Team</div>
              <div className="text-sm text-gray-900">{proposal.teamSize}</div>
            </div>
          )}
          {displaySettings.showProgress && ['draft', 'in-review'].includes(proposal.status) && (
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Progress</div>
              <div className="text-sm text-gray-900">{proposal.progress}%</div>
            </div>
          )}
        </div>
      )}

      {/* Progress bar - full width at bottom */}
      {displaySettings.showProgress && ['draft', 'in-review'].includes(proposal.status) && (
        <div className="mt-3 -mx-4 -mb-4 h-2 bg-gray-100 rounded-b-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${proposal.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// KANBAN VIEW - with Drag & Drop
// ============================================================================

function KanbanView({
  proposals,
  onOpen,
  onStatusChange,
}: {
  proposals: Proposal[]
  onOpen: (id: string) => void
  onStatusChange: (id: string, status: ProposalStatus) => void
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ProposalStatus | null>(null)

  const columns: { status: ProposalStatus; label: string; color: string }[] = [
    { status: 'draft', label: 'Draft', color: 'border-gray-300' },
    { status: 'in-review', label: 'In Review', color: 'border-yellow-400' },
    { status: 'submitted', label: 'Submitted', color: 'border-blue-400' },
    { status: 'won', label: 'Won', color: 'border-green-400' },
    { status: 'lost', label: 'Lost', color: 'border-red-400' },
  ]

  const handleDragStart = (e: React.DragEvent, proposalId: string) => {
    setDraggedId(proposalId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', proposalId)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: ProposalStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, newStatus: ProposalStatus) => {
    e.preventDefault()
    const proposalId = e.dataTransfer.getData('text/plain')
    if (proposalId && draggedId) {
      onStatusChange(proposalId, newStatus)
    }
    setDraggedId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnProposals = proposals.filter(p => p.status === column.status && !p.archived)
        const totalValue = columnProposals.reduce((sum, p) => sum + p.totalValue, 0)
        const isDropTarget = dragOverColumn === column.status
        
        return (
          <div 
            key={column.status}
            className={`
              flex-shrink-0 w-72 rounded-lg border-t-4 transition-colors
              ${column.color}
              ${isDropTarget ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'}
            `}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-gray-900">{column.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {columnProposals.length}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(totalValue)} total
              </p>
            </div>
            
            <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto min-h-[100px]">
              {columnProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, proposal.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onOpen(proposal.id)}
                  className={`
                    bg-white p-3 rounded-lg border border-gray-200 
                    hover:border-blue-400 hover:shadow-sm cursor-grab active:cursor-grabbing
                    transition-all select-none
                    ${draggedId === proposal.id ? 'opacity-50 ring-2 ring-blue-400' : ''}
                  `}
                >
                  <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                    {proposal.title}
                  </h4>
                  <p className="text-xs text-gray-500 mb-2">{proposal.client}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(proposal.totalValue)}
                    </span>
                    {proposal.dueDate && getDaysUntilDue(proposal.dueDate) !== null && (
                      <span className={`flex items-center gap-1 ${
                        getDaysUntilDue(proposal.dueDate)! <= 7 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {getDaysUntilDue(proposal.dueDate)}d
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {columnProposals.length === 0 && (
                <div className={`
                  text-center py-8 text-sm rounded-lg border-2 border-dashed
                  ${isDropTarget ? 'border-blue-300 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-400'}
                `}>
                  {isDropTarget ? 'Drop here' : 'No proposals'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// CALENDAR VIEW
// ============================================================================

function CalendarView({
  proposals,
  onOpen,
}: {
  proposals: Proposal[]
  onOpen: (id: string) => void
}) {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  // Get proposals with due dates this month
  const proposalsWithDates = proposals.filter(p => {
    if (!p.dueDate || p.archived) return false
    const dueDate = new Date(p.dueDate)
    return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear
  })

  // Generate calendar days
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay()
  
  const days = []
  for (let i = 0; i < startingDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const getProposalsForDay = (day: number) => {
    return proposalsWithDates.filter(p => {
      const dueDate = new Date(p.dueDate!)
      return dueDate.getDate() === day
    })
  }

  const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{monthName}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {proposalsWithDates.length} proposal{proposalsWithDates.length !== 1 ? 's' : ''} due this month
        </p>
      </div>
      
      {/* Calendar Header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayProposals = day ? getProposalsForDay(day) : []
          const isToday = day === today.getDate()
          
          return (
            <div 
              key={i} 
              className={`
                min-h-[100px] p-1 border-b border-r border-gray-100
                ${day ? 'bg-white' : 'bg-gray-50'}
                ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}
              `}
            >
              {day && (
                <>
                  <div className={`text-xs font-medium p-1 ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayProposals.slice(0, 2).map((proposal) => (
                      <div
                        key={proposal.id}
                        onClick={() => onOpen(proposal.id)}
                        className={`
                          text-[10px] p-1 rounded truncate cursor-pointer
                          ${proposal.status === 'draft' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : ''}
                          ${proposal.status === 'in-review' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : ''}
                          ${proposal.status === 'submitted' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                        `}
                      >
                        {proposal.title}
                      </div>
                    ))}
                    {dayProposals.length > 2 && (
                      <div className="text-[10px] text-gray-500 pl-1">
                        +{dayProposals.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// EMPTY STATES
// ============================================================================

function EmptyState({
  companyName,
  onImportRFP,
  onExploreSample,
}: {
  companyName: string
  onImportRFP: () => void
  onExploreSample: () => void
}) {
  return (
    <div className="py-16 px-4">
      <div className="max-w-lg mx-auto text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Welcome, {companyName}
        </h2>
        <p className="text-gray-600 mb-8">
          Your proposal workspace is ready. How would you like to get started?
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
          <button
            onClick={onImportRFP}
            className="group p-6 bg-black border-2 border-black rounded-xl hover:bg-gray-800 transition-all text-left"
          >
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-white mb-1">Upload an RFP</h3>
            <p className="text-sm text-white/70">
              Our AI will analyze and extract requirements, roles, and estimates.
            </p>
          </button>
          
          <button
            onClick={onExploreSample}
            className="group p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Explore a sample</h3>
            <p className="text-sm text-gray-500">
              See how TrueBid works with pre-filled example data.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}

function FilteredEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export function Dashboard() {
  const router = useRouter()
  const { companyProfile, setActiveUtilityTool } = useAppContext()
  
  // Core state
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  
  // View state
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showArchived, setShowArchived] = useState(false)
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [agencyFilter, setAgencyFilter] = useState<string>('all')
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dueDate')
  const [sortDesc, setSortDesc] = useState(true)
  
  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([])

  // Card display settings
  const [cardSettings, setCardSettings] = useState<CardDisplaySettings>(DEFAULT_CARD_SETTINGS)

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null)

  // Load proposals from API
  useEffect(() => {
    async function loadProposals() {
      try {
        const response = await proposalsApi.list() as { proposals: Proposal[] }
        setProposals(response.proposals || [])
      } catch (error) {
        console.error('Failed to load proposals from API:', error)
        // Fallback to localStorage cache
        const cached = localStorage.getItem(PROPOSALS_STORAGE_KEY)
        if (cached) {
          try {
            setProposals(JSON.parse(cached))
          } catch (e) {
            console.error('Failed to parse cached proposals:', e)
            setProposals([])
          }
        } else {
          setProposals([])
        }
      }

      // Load recently viewed (keep in localStorage - UI preference)
      const recentStored = localStorage.getItem(RECENTLY_VIEWED_KEY)
      if (recentStored) {
        try {
          setRecentlyViewed(JSON.parse(recentStored))
        } catch (e) {
          console.error('Failed to parse recently viewed:', e)
        }
      }

      // Load card display settings (keep in localStorage - UI preference)
      const cardSettingsStored = localStorage.getItem(CARD_SETTINGS_KEY)
      if (cardSettingsStored) {
        try {
          setCardSettings({ ...DEFAULT_CARD_SETTINGS, ...JSON.parse(cardSettingsStored) })
        } catch (e) {
          console.error('Failed to parse card settings:', e)
        }
      }

      setIsLoaded(true)
    }

    loadProposals()
  }, [])

  // Cache proposals to localStorage for fallback
  useEffect(() => {
    if (isLoaded && proposals.length > 0) {
      localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(proposals))
    }
  }, [proposals, isLoaded])

  // Save recently viewed when it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed))
    }
  }, [recentlyViewed, isLoaded])

  // Save card settings when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(CARD_SETTINGS_KEY, JSON.stringify(cardSettings))
    }
  }, [cardSettings, isLoaded])

  // Auto-disable archive view if no archived proposals exist
  const hasArchivedProposals = proposals.some(p => p.archived)
  const effectiveShowArchived = showArchived && hasArchivedProposals

  // Filter and sort proposals
  const filteredProposals = useMemo(() => {
    let result = proposals

    // Archive filter
    result = result.filter(p => effectiveShowArchived ? p.archived : !p.archived)

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.solicitation.toLowerCase().includes(query) ||
        p.client.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(p => p.contractType === typeFilter)
    }

    // Agency filter
    if (agencyFilter !== 'all') {
      result = result.filter(p => p.client === agencyFilter)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) comparison = 0
          else if (!a.dueDate) comparison = 1
          else if (!b.dueDate) comparison = -1
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'value':
          comparison = a.totalValue - b.totalValue
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'status':
          const statusOrder = ['draft', 'in-review', 'submitted', 'won', 'lost', 'no-bid']
          comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
          break
      }

      return sortDesc ? -comparison : comparison
    })

    return result
  }, [proposals, effectiveShowArchived, searchQuery, statusFilter, typeFilter, agencyFilter, sortBy, sortDesc])

  // Stats calculations
  const stats = useMemo(() => {
    const active = proposals.filter(p => !p.archived && ['draft', 'in-review'].includes(p.status))
    const submitted = proposals.filter(p => !p.archived && p.status === 'submitted')
    
    // Win rate includes ALL won/lost (including archived) for accurate historical rate
    const allWon = proposals.filter(p => p.status === 'won')
    const allLost = proposals.filter(p => p.status === 'lost')
    
    const pipelineValue = active.reduce((sum, p) => sum + p.totalValue, 0) +
                          submitted.reduce((sum, p) => sum + p.totalValue, 0)
    
    const winRate = allWon.length + allLost.length > 0
      ? Math.round((allWon.length / (allWon.length + allLost.length)) * 100)
      : 0

    return {
      active: active.length,
      pipelineValue,
      submitted: submitted.length,
      winRate,
    }
  }, [proposals])

  // Handlers
  const handleImportRFP = async () => {
    setActiveUtilityTool(null)

    try {
      // Create proposal via API
      const response = await proposalsApi.create({
        title: 'New Proposal',
        status: 'draft',
        total_value: 0,
        team_size: 0,
        progress: 0,
        starred: false,
        archived: false,
        contract_type: 'tm',
      }) as { proposal: Proposal }

      const newProposal = response.proposal
      router.push(`/${newProposal.id}?tab=upload`)
    } catch (error) {
      console.error('Failed to create proposal:', error)
      // Fallback to local creation
      const newId = `prop-${Date.now()}`
      router.push(`/${newId}?tab=upload`)
    }
  }

  const handleOpenProposal = (proposalId: string) => {
    setActiveUtilityTool(null)
    // Add to recently viewed
    setRecentlyViewed(prev => {
      const filtered = prev.filter(id => id !== proposalId)
      return [proposalId, ...filtered].slice(0, 10)
    })
    router.push(`/${proposalId}?tab=estimate`)
  }

  const handleToggleArchive = async (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (!proposal) return

    const newArchived = !proposal.archived
    // Optimistic update
    setProposals(prev =>
      prev.map(p => p.id === proposalId ? { ...p, archived: newArchived } : p)
    )

    try {
      await proposalsApi.update(proposalId, { archived: newArchived })
    } catch (error) {
      console.error('Failed to update proposal archive status:', error)
      // Revert on error
      setProposals(prev =>
        prev.map(p => p.id === proposalId ? { ...p, archived: !newArchived } : p)
      )
    }
  }

  const handleDuplicate = useCallback(async (proposalId: string) => {
    const original = proposals.find(p => p.id === proposalId)
    if (!original) return

    try {
      // Create duplicate via API
      const response = await proposalsApi.create({
        title: `${original.title} (Copy)`,
        solicitation_number: original.solicitation,
        client: original.client,
        status: 'draft',
        total_value: original.totalValue,
        due_date: original.dueDate,
        team_size: original.teamSize,
        progress: 0,
        starred: false,
        archived: false,
        contract_type: original.contractType,
        period_of_performance: original.periodOfPerformance,
      }) as { proposal: Proposal }

      setProposals(prev => [response.proposal, ...prev])
    } catch (error) {
      console.error('Failed to duplicate proposal:', error)
      // Fallback to local duplication
      const duplicate: Proposal = {
        ...original,
        id: `prop-${Date.now()}`,
        title: `${original.title} (Copy)`,
        status: 'draft',
        starred: false,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 0,
      }
      setProposals(prev => [duplicate, ...prev])
    }
  }, [proposals])

  const handleDelete = (proposalId: string) => {
    setProposalToDelete(proposalId)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!proposalToDelete) return

    try {
      await proposalsApi.delete(proposalToDelete)
      setProposals(prev => prev.filter(p => p.id !== proposalToDelete))
    } catch (error) {
      console.error('Failed to delete proposal:', error)
      // Still remove from UI even if API fails
      setProposals(prev => prev.filter(p => p.id !== proposalToDelete))
    }

    setDeleteConfirmOpen(false)
    setProposalToDelete(null)
  }

  const handleStatusChange = async (proposalId: string, newStatus: ProposalStatus) => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (!proposal) return

    const previousStatus = proposal.status
    // Optimistic update
    setProposals(prev =>
      prev.map(p => p.id === proposalId ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p)
    )

    try {
      await proposalsApi.update(proposalId, { status: newStatus })
    } catch (error) {
      console.error('Failed to update proposal status:', error)
      // Revert on error
      setProposals(prev =>
        prev.map(p => p.id === proposalId ? { ...p, status: previousStatus } : p)
      )
    }
  }

  const handleStatClick = (stat: 'active' | 'pipeline' | 'submitted' | 'winRate') => {
    // Clear other filters first
    setSearchQuery('')
    setTypeFilter('all')
    setAgencyFilter('all')
    setShowArchived(false)
    
    switch (stat) {
      case 'active':
        setStatusFilter('all') // Will show draft and in-review naturally
        break
      case 'pipeline':
        setStatusFilter('all')
        break
      case 'submitted':
        setStatusFilter('submitted')
        break
      case 'winRate':
        setStatusFilter('won')
        break
    }
  }

  const companyName = companyProfile?.name || 'TrueBid'
  const archivedCount = proposals.filter(p => p.archived).length
  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || agencyFilter !== 'all'

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-6 py-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Cards skeleton */}
          <CardSkeletonGrid count={6} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        {proposals.length === 0 ? (
          <EmptyState
            companyName={companyName}
            onImportRFP={handleImportRFP}
            onExploreSample={() => setProposals(MOCK_PROPOSALS)}
          />
        ) : (
          <>
            {/* Archive View Banner */}
            {showArchived && (
              <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Archive className="w-4 h-4" />
                  <span>Viewing archived proposals</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowArchived(false)}
                  className="h-7 px-2 text-gray-500 hover:text-gray-700"
                >
                  Back to all proposals
                </Button>
              </div>
            )}

            {/* Page Header with New Proposal CTA */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-medium text-black">Proposals</h1>
                <p className="text-sm text-gray-500 mt-2">Manage and track your government contract proposals</p>
              </div>
              <Button onClick={handleImportRFP} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4" />
                New Proposal
              </Button>
            </div>

            {/* Stats Row - Clickable (hidden in archive view) */}
            {!showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => handleStatClick('active')}
                className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Active Proposals</span>
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.active}</div>
                <div className="text-xs text-gray-500">In progress</div>
              </button>

              <button
                onClick={() => handleStatClick('pipeline')}
                className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Pipeline Value</span>
                  <DollarSign className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-600">{formatCurrency(stats.pipelineValue)}</div>
                <div className="text-xs text-gray-500">Total potential</div>
              </button>

              <button
                onClick={() => handleStatClick('submitted')}
                className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Submitted</span>
                  <Send className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.submitted}</div>
                <div className="text-xs text-gray-500">Awaiting decision</div>
              </button>

              <button
                onClick={() => handleStatClick('winRate')}
                className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Win Rate</span>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.winRate}%</div>
                <div className="text-xs text-gray-500">Historical</div>
              </button>
            </div>
            )}

            {/* Toolbar - Sticky */}
            <div className="sticky top-14 z-20 bg-gray-50 py-3 -mx-6 px-6 mb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px] max-w-md relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search-input"
                    placeholder="Search proposals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {/* Combined Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      Filter
                      {(hasActiveFilters || showArchived) && (
                        <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs text-gray-500">Status</DropdownMenuLabel>
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={statusFilter === opt.value}
                        onCheckedChange={() => setStatusFilter(opt.value as ProposalStatus | 'all')}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-gray-500">Contract Type</DropdownMenuLabel>
                    {CONTRACT_TYPE_OPTIONS.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={typeFilter === opt.value}
                        onCheckedChange={() => setTypeFilter(opt.value)}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={showArchived}
                      onCheckedChange={() => {
                        const newShowArchived = !showArchived
                        setShowArchived(newShowArchived)
                        if (newShowArchived && (viewMode === 'kanban' || viewMode === 'calendar')) {
                          setViewMode('grid')
                        }
                      }}
                    >
                      Show archived
                      {archivedCount > 0 && (
                        <span className="ml-auto text-xs text-gray-400">{archivedCount}</span>
                      )}
                    </DropdownMenuCheckboxItem>
                    {(hasActiveFilters || showArchived) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setStatusFilter('all')
                            setTypeFilter('all')
                            setAgencyFilter('all')
                            setShowArchived(false)
                          }}
                          className="text-xs text-gray-500 justify-center"
                        >
                          Clear all filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={sortBy === opt.value}
                        onCheckedChange={() => setSortBy(opt.value)}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={sortDesc}
                      onCheckedChange={() => setSortDesc(!sortDesc)}
                    >
                      Descending
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Spacer */}
                <div className="flex-1" />

                {/* View Toggle */}
                <div className="flex gap-1 border border-gray-200 rounded-md p-0.5 bg-white">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="px-2 h-8"
                    title="Grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="px-2 h-8"
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                    className="px-2 h-8"
                    title="Kanban view"
                    disabled={showArchived}
                  >
                    <Kanban className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('calendar')}
                    className="px-2 h-8"
                    title="Calendar view"
                    disabled={showArchived}
                  >
                    <CalendarDays className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results count - only for grid/list views */}
            {(viewMode === 'grid' || viewMode === 'list') && (
              <p className="text-xs text-gray-500 mb-4">
                {showArchived 
                  ? `Showing ${filteredProposals.length} archived proposal${filteredProposals.length !== 1 ? 's' : ''}`
                  : `Showing ${filteredProposals.length} of ${proposals.filter(p => !p.archived).length} proposals`
                }
                {hasActiveFilters && ' (filtered)'}
              </p>
            )}

            {/* Main Content Area */}
            <div>
              {viewMode === 'grid' && filteredProposals.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onOpen={() => handleOpenProposal(proposal.id)}
                      onToggleArchive={() => handleToggleArchive(proposal.id)}
                      onDuplicate={() => handleDuplicate(proposal.id)}
                      onDelete={() => handleDelete(proposal.id)}
                      onStatusChange={(status) => handleStatusChange(proposal.id, status)}
                      isRecentlyViewed={recentlyViewed[0] === proposal.id}
                      displaySettings={cardSettings}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'list' && filteredProposals.length > 0 && (
                <div className="space-y-2">
                  {filteredProposals.map((proposal) => {
                    const daysUntilDue = getDaysUntilDue(proposal.dueDate)
                    const isUrgent = daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue >= 0
                    const isRecent = recentlyViewed[0] === proposal.id
                    
                    return (
                      <div
                        key={proposal.id}
                        onClick={() => handleOpenProposal(proposal.id)}
                        className={`
                          flex items-center gap-4 p-4 bg-white border rounded-lg 
                          hover:shadow-sm cursor-pointer transition-all
                          ${isUrgent && !proposal.archived && cardSettings.showDueDate
                            ? 'border-l-4 border-l-amber-400 border-t-gray-200 border-r-gray-200 border-b-gray-200'
                            : 'border-gray-200 hover:border-blue-400'
                          }
                        `}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm text-gray-900 truncate">{proposal.title}</h3>
                            {isRecent && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium shrink-0">
                                Recently viewed
                              </span>
                            )}
                            {isUrgent && cardSettings.showDueDate && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3" />
                                Due in {daysUntilDue}d
                              </span>
                            )}
                          </div>
                          {cardSettings.showClient && (
                            <p className="text-xs text-gray-500 truncate">{proposal.client}</p>
                          )}
                        </div>
                        {cardSettings.showStatus && (
                          <Badge className={`shrink-0 ${getStatusConfig(proposal.status).bgColor}`}>
                            {getStatusConfig(proposal.status).label}
                          </Badge>
                        )}
                        {cardSettings.showValue && (
                          <span className="text-sm font-semibold text-gray-900 shrink-0 w-20 text-right">
                            {formatCurrency(proposal.totalValue)}
                          </span>
                        )}
                        {cardSettings.showLastUpdated && (
                          <span className="text-xs text-gray-500 shrink-0 w-24 text-right">
                            {formatRelativeTime(proposal.updatedAt)}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}

              {viewMode === 'kanban' && (
                <KanbanView
                  proposals={proposals}
                  onOpen={handleOpenProposal}
                  onStatusChange={handleStatusChange}
                />
              )}

              {viewMode === 'calendar' && (
                <CalendarView
                  proposals={proposals}
                  onOpen={handleOpenProposal}
                />
              )}

              {/* Empty States */}
              {filteredProposals.length === 0 && viewMode !== 'kanban' && viewMode !== 'calendar' && (
                showArchived ? (
                  <FilteredEmptyState
                    icon={Archive}
                    title="No archived proposals"
                    description="Completed proposals will appear here when archived"
                  />
                ) : searchQuery || hasActiveFilters ? (
                  <FilteredEmptyState
                    icon={Search}
                    title="No matching proposals"
                    description="Try adjusting your search or filters"
                  />
                ) : proposals.length === 0 ? (
                  // Brand new user - no proposals at all
                  <div className="text-center py-16 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No proposals yet</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                      Upload an RFP to get started. TrueBid will extract key details and help you build a competitive proposal.
                    </p>
                    <Button onClick={handleImportRFP} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Create Your First Proposal
                    </Button>
                  </div>
                ) : null
              )}
            </div>
          </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this proposal?</DialogTitle>
            <DialogDescription>
              This will permanently delete the proposal and all its data including requirements and WBS elements.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setProposalToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Dashboard