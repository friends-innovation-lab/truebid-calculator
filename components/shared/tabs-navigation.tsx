'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  Users,
  Building2,
  FileDown,
  FileText,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  Pencil,
  PenLine,
  Shield,
  AlertCircle,
  Layers,
  HelpCircle,
  Wrench,
  ChevronRight,
  ChevronLeft,
  History,
  Save,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useAppContext } from '@/contexts/app-context'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UploadTab } from '@/components/tabs/upload-tab'
import { EstimateTab } from '@/components/tabs/estimate-tab'
import { RolesAndPricingTab } from '@/components/tabs/roles-and-pricing-tab'
import { TeamingPartnersTab } from '@/components/tabs/teaming-partners-tab'
import { SubRatesTab } from '@/components/tabs/sub-rates-tab'
import { Outline } from '@/components/tabs/write/outline'
import { ExportTab } from '@/components/tabs/export-tab'

// ==================== CONSTANTS ====================

// Label mappings for display
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  'FFP': 'Firm Fixed Price',
  'T&M': 'Time & Materials',
  'CPFF': 'Cost Plus Fixed Fee',
  'CPAF': 'Cost Plus Award Fee',
  'IDIQ': 'IDIQ',
  'BPA': 'BPA',
  'hybrid': 'Hybrid',
  'GSA': 'GSA Schedule',
} as const

const SET_ASIDE_LABELS: Record<string, string> = {
  'full-open': 'Full & Open',
  'small-business': 'Small Business',
  '8a': '8(a)',
  'hubzone': 'HUBZone',
  'sdvosb': 'SDVOSB',
  'wosb': 'WOSB',
  'edwosb': 'EDWOSB'
} as const

const CLEARANCE_LEVEL_LABELS: Record<string, string> = {
  'public-trust': 'Public Trust',
  'secret': 'Secret',
  'top-secret': 'Top Secret',
  'ts-sci': 'TS/SCI'
} as const

// Tab type definition - main flow only (utilities are separate)
type TabType =
  | 'upload'
  | 'estimate'
  | 'roles'
  | 'teaming-partners'
  | 'write'
  | 'export'

// Tab configuration with accessibility metadata
interface TabConfig {
  id: TabType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string // For screen readers
}

// ==================== MAIN COMPONENT ====================

export function TabsNavigation() {
  const [showSolicitationExpanded, setShowSolicitationExpanded] = useState(false)
  const [isVersionsSlideoutOpen, setIsVersionsSlideoutOpen] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionNotes, setNewVersionNotes] = useState('')
  const [versionConfirm, setVersionConfirm] = useState<{ type: 'restore' | 'delete'; id: string } | null>(null)
  
  const { 
    solicitation, 
    updateSolicitation,
    isSolicitationEditorOpen,
    openSolicitationEditor,
    closeSolicitationEditor,
    // Tab Navigation from context
    activeMainTab,
    setActiveMainTab,
    // Utility Tool from context
    activeUtilityTool,
    setActiveUtilityTool,
    // Version History from context
    projectVersions,
    saveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
  } = useAppContext()
  
  // Use context state for tabs (allows child components to navigate)
  const activeTab = activeMainTab as TabType
  const setActiveTab = (tab: TabType) => {
    setActiveMainTab(tab)
    setActiveUtilityTool(null) // Clear utility tool when switching to main tab
  }

  // Read tab from URL params on mount
  const searchParams = useSearchParams()
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['upload', 'estimate', 'roles', 'teaming-partners', 'write', 'export'].includes(tabParam)) {
      setActiveMainTab(tabParam as TabType)
    }
  }, [searchParams, setActiveMainTab])

  // Main bid flow tabs - ordered by workflow sequence
  // Upload → Estimate → Roles & Pricing → Teaming Partners → Write → Export
  const bidFlowTabs: TabConfig[] = useMemo(() => [
    {
      id: 'upload',
      label: 'Upload',
      icon: Upload,
      description: 'Upload and analyze RFP documents, select contract type'
    },
    {
      id: 'estimate',
      label: 'Estimate',
      icon: Layers,
      description: 'Build your Basis of Estimate with WBS elements and labor hours'
    },
    {
      id: 'roles',
      label: 'Roles & Pricing',
      icon: Users,
      description: 'Define team roles and calculate pricing'
    },
    {
      id: 'teaming-partners',
      label: 'Teaming Partners',
      icon: Building2,
      description: 'Manage subcontractor companies and teaming arrangements'
    },
    {
      id: 'write',
      label: 'Write',
      icon: PenLine,
      description: 'Structure and write your technical volume content'
    },
    {
      id: 'export',
      label: 'Export',
      icon: FileDown,
      description: 'Generate proposal documents and exports'
    },
  ], [])

  // Check if a utility tool is active
  const isUtilityToolActive = activeUtilityTool !== null

  // ==================== DATE CALCULATIONS ====================

  const daysUntilDue = useMemo(() => {
    if (!solicitation?.proposalDueDate) return null
    const due = new Date(solicitation.proposalDueDate)
    const now = new Date()
    const diffTime = due.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [solicitation])
  const isUrgent = daysUntilDue !== null && daysUntilDue <= 14 && daysUntilDue >= 0
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0

  const formatDate = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  // ==================== KEYBOARD NAVIGATION ====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close slideout on Escape
      if (e.key === 'Escape') {
        if (isVersionsSlideoutOpen) {
          setIsVersionsSlideoutOpen(false)
        } else if (isSolicitationEditorOpen) {
          closeSolicitationEditor()
        } else if (showSolicitationExpanded) {
          setShowSolicitationExpanded(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSolicitationEditorOpen, closeSolicitationEditor, showSolicitationExpanded, isVersionsSlideoutOpen])

  // ==================== TAB CHANGE HANDLER ====================

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId)
    // Announce tab change to screen readers
    const tab = bidFlowTabs.find(t => t.id === tabId)
    if (tab) {
      const announcement = document.getElementById('tab-announcement')
      if (announcement) {
        announcement.textContent = `${tab.label} tab selected. ${tab.description}`
      }
    }
  }

  // ==================== UTILITY TOOL HANDLER ====================

  const handleBackToMainFlow = useCallback(() => {
    setActiveUtilityTool(null)
  }, [setActiveUtilityTool])

  // ==================== VERSION HANDLERS ====================

  const handleSaveVersion = useCallback(() => {
    if (!newVersionName.trim()) return
    saveProjectVersion(newVersionName.trim(), newVersionNotes.trim() || undefined)
    setNewVersionName('')
    setNewVersionNotes('')
  }, [newVersionName, newVersionNotes, saveProjectVersion])

  const handleRestoreVersion = useCallback((versionId: string) => {
    setVersionConfirm({ type: 'restore', id: versionId })
  }, [])

  const handleDeleteVersion = useCallback((versionId: string) => {
    setVersionConfirm({ type: 'delete', id: versionId })
  }, [])

  const formatVersionDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Show solicitation bar on main bid flow tabs (not upload, not utility tools)
  const showSolicitationBar = !isUtilityToolActive && activeTab !== 'upload' && solicitation?.solicitationNumber

  // Get proposal display name
  const proposalName = solicitation?.title || solicitation?.solicitationNumber || 'New Proposal'

  // ==================== RENDER ====================

  return (
    <div className="font-sans flex flex-col min-h-0 flex-1">
      {/* Screen reader announcements */}
      <div 
        id="tab-announcement" 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      />

      {/* Breadcrumb Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shrink-0">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-12">
            {/* Left: Breadcrumb */}
            <nav className="flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors shrink-0"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Dashboard</span>
              </Link>
              <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {proposalName}
              </span>
            </nav>

            {/* Right: Status indicator - only show on editing tabs */}
{activeTab !== 'upload' && (
  <div className="flex items-center gap-3 shrink-0">
    <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
      Saved
    </span>
  </div>
)}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav 
        className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-12 z-40 shrink-0"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4 md:px-6">
          <div 
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Bid workflow tabs"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Main Bid Flow Tabs */}
            {bidFlowTabs.map((tab, index) => {
              const Icon = tab.icon
              const isActive = !isUtilityToolActive && activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabChange(tab.id)}
                  onKeyDown={(e) => {
                    // Arrow key navigation within tabs
                    if (e.key === 'ArrowRight') {
                      const nextIndex = (index + 1) % bidFlowTabs.length
                      handleTabChange(bidFlowTabs[nextIndex].id)
                    } else if (e.key === 'ArrowLeft') {
                      const prevIndex = (index - 1 + bidFlowTabs.length) % bidFlowTabs.length
                      handleTabChange(bidFlowTabs[prevIndex].id)
                    }
                  }}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap 
                    border-b-2 transition-colors focus:outline-none focus-visible:ring-2 
                    focus-visible:ring-blue-500 focus-visible:ring-offset-2
                    ${isActive 
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' 
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Utility Tool Header Bar - shown when a utility tool is active */}
      {isUtilityToolActive && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
          <div className="container mx-auto px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700">
                <Wrench className="w-3 h-3 mr-1" aria-hidden="true" />
                Utility Tool
              </Badge>
              <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {activeUtilityTool === 'sub-rates' ? 'Sub Rates Calculator' : activeUtilityTool}
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                — Not part of bid workflow
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMainFlow}
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-800"
            >
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" aria-hidden="true" />
              Back to Bid Flow
            </Button>
          </div>
        </div>
      )}

      {/* Solicitation Bar - Own row below tabs */}
      {showSolicitationBar && (
        <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 shrink-0" role="region" aria-label="Solicitation information">
          <div className="container mx-auto px-4 md:px-6">
            {/* Collapsed view */}
            <div className="flex items-center justify-between py-2 gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="flex items-center gap-2 shrink-0">
                  <FileText className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                    {solicitation.solicitationNumber}
                  </span>
                  {solicitation.title && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600 hidden md:inline" aria-hidden="true">·</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px] md:max-w-md hidden md:inline">
                        {solicitation.title}
                      </span>
                    </>
                  )}
                </div>
                
                {/* Badges */}
                <div className="flex items-center gap-1 md:gap-2 shrink-0" aria-label="Contract details">
                  {solicitation.contractType && (
                    <Badge variant="secondary" className="text-xs">
                      {solicitation.contractType}
                    </Badge>
                  )}
                  {solicitation.setAside && solicitation.setAside !== 'full-open' && (
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                    >
                      {SET_ASIDE_LABELS[solicitation.setAside] || solicitation.setAside}
                    </Badge>
                  )}
                  {solicitation.clearanceLevel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full">
                      <Shield className="w-3 h-3" aria-hidden="true" />
                      <span>{CLEARANCE_LEVEL_LABELS[solicitation.clearanceLevel] || solicitation.clearanceLevel}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-3 shrink-0">
                {/* Due date */}
                {daysUntilDue !== null && (
                  <div 
                    className={`flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-1 rounded text-xs font-medium ${
                      isOverdue 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' 
                        : isUrgent 
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                    role="status"
                    aria-label={isOverdue ? 'Proposal is overdue' : `${daysUntilDue} days until proposal is due`}
                  >
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{isOverdue ? 'Overdue' : `${daysUntilDue}d`}</span>
                  </div>
                )}

                {/* Versions button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVersionsSlideoutOpen(true)}
                  className="h-7 px-1.5 md:px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="View version history"
                >
                  <History className="w-3.5 h-3.5 md:mr-1" aria-hidden="true" />
                  <span className="hidden md:inline">Versions</span>
                  {projectVersions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 md:ml-1.5 h-4 px-1 text-[10px]">
                      {projectVersions.length}
                    </Badge>
                  )}
                </Button>

                {/* Edit button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openSolicitationEditor()}
                  className="h-7 px-1.5 md:px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Edit solicitation details"
                >
                  <Pencil className="w-3.5 h-3.5 md:mr-1" aria-hidden="true" />
                  <span className="hidden md:inline">Edit</span>
                </Button>

                {/* Expand/Collapse */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSolicitationExpanded(!showSolicitationExpanded)}
                  className="h-7 w-7 p-0 text-gray-400 dark:text-gray-500"
                  aria-expanded={showSolicitationExpanded}
                  aria-label={showSolicitationExpanded ? 'Collapse solicitation details' : 'Expand solicitation details'}
                >
                  {showSolicitationExpanded ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            {/* Expanded view */}
            {showSolicitationExpanded && (
              <div className="pb-4 pt-3 border-t border-gray-100">
                {/* Title row */}
                {solicitation.title && (
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {solicitation.title}
                    </h3>
                  </div>
                )}

                {/* Pricing Assumptions - Prominent top section */}
                <div 
                  className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
                  role="region"
                  aria-label="Pricing assumptions for this bid"
                >
                  <div className="flex items-center justify-between">
                    <dl className="flex items-center gap-6">
                      <div>
                        <dt className="text-xs text-gray-600">Profit Margin</dt>
                        <dd className="text-sm font-semibold text-gray-900">
                          {solicitation.pricingSettings?.profitMargin ?? 8}%
                        </dd>
                      </div>
                      <div className="h-8 w-px bg-blue-200" aria-hidden="true" />
                      <div>
                        <dt className="text-xs text-gray-600">Billable Hours</dt>
                        <dd className="text-sm font-semibold text-gray-900">
                          {(solicitation.pricingSettings?.billableHours ?? 1920).toLocaleString()} per year
                        </dd>
                      </div>
                      <div className="h-8 w-px bg-blue-200" aria-hidden="true" />
                      <div>
                        <dt className="text-xs text-gray-600">Annual Increases</dt>
                        <dd className="text-sm font-semibold text-gray-900">
                          {(solicitation.pricingSettings?.escalationEnabled ?? true) 
                            ? `Labor ${solicitation.pricingSettings?.laborEscalation ?? 3}%, ODCs ${solicitation.pricingSettings?.odcEscalation ?? 0}%`
                            : 'None'
                          }
                        </dd>
                      </div>
                    </dl>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSolicitationEditor()}
                      className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                      aria-label="Edit pricing settings for this bid"
                    >
                      <Pencil className="w-3 h-3 mr-1" aria-hidden="true" />
                      Edit Settings
                    </Button>
                  </div>
                </div>

                {/* Detail columns */}
                <div className="grid grid-cols-4 gap-6">
                  {/* Column 1: Solicitation */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Solicitation
                    </h4>
                    <dl className="space-y-1.5">
                      <div className="text-sm">
                        <dt className="inline text-gray-600">Number: </dt>
                        <dd className="inline font-medium text-gray-900">{solicitation.solicitationNumber}</dd>
                      </div>
                      {solicitation.clientAgency && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Agency: </dt>
                          <dd className="inline text-gray-900">{solicitation.clientAgency}</dd>
                        </div>
                      )}
                      {solicitation.subAgency && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Office: </dt>
                          <dd className="inline text-gray-900">{solicitation.subAgency}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Column 2: Contract */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Contract
                    </h4>
                    <dl className="space-y-1.5">
                      {solicitation.contractType && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Type: </dt>
                          <dd className="inline text-gray-900">
                            {CONTRACT_TYPE_LABELS[solicitation.contractType] || solicitation.contractType}
                          </dd>
                        </div>
                      )}
                      {solicitation.periodOfPerformance && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Duration: </dt>
                          <dd className="inline text-gray-900">
                            {solicitation.periodOfPerformance.baseYear ? '1 Base Year' : ''}
                            {solicitation.periodOfPerformance.optionYears 
                              ? ` + ${solicitation.periodOfPerformance.optionYears} Option Years`
                              : ''
                            }
                          </dd>
                        </div>
                      )}
                      {solicitation.naicsCode && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">NAICS: </dt>
                          <dd className="inline text-gray-900">{solicitation.naicsCode}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Column 3: Key Dates */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Key Dates
                    </h4>
                    <dl className="space-y-1.5">
                      <div className="text-sm">
                        <dt className="inline text-gray-600">Proposal Due: </dt>
                        <dd className={`inline font-medium ${
                          isOverdue ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-900'
                        }`}>
                          {formatDate(solicitation.proposalDueDate)}
                        </dd>
                      </div>
                      {solicitation.questionsDeadline && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Questions Due: </dt>
                          <dd className="inline text-gray-900">{formatDate(solicitation.questionsDeadline)}</dd>
                        </div>
                      )}
                      {solicitation.anticipatedAwardDate && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Expected Award: </dt>
                          <dd className="inline text-gray-900">{formatDate(solicitation.anticipatedAwardDate)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Column 4: Requirements */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Requirements
                    </h4>
                    <dl className="space-y-1.5">
                      {solicitation.setAside && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Set-Aside: </dt>
                          <dd className="inline text-gray-900">
                            {SET_ASIDE_LABELS[solicitation.setAside] || solicitation.setAside}
                          </dd>
                        </div>
                      )}
                      {solicitation.clearanceLevel && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Clearance: </dt>
                          <dd className="inline text-gray-900">
                            {CLEARANCE_LEVEL_LABELS[solicitation.clearanceLevel] || solicitation.clearanceLevel}
                          </dd>
                        </div>
                      )}
                      {solicitation.placeOfPerformance?.type && (
                        <div className="text-sm">
                          <dt className="inline text-gray-600">Work Location: </dt>
                          <dd className="inline text-gray-900 capitalize">
                            {solicitation.placeOfPerformance.type}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* Urgency alerts */}
                {isUrgent && !isOverdue && (
                  <div 
                    className="flex items-center gap-2 mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" aria-hidden="true" />
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Due soon!</span> Only {daysUntilDue} days remaining to submit your proposal.
                    </p>
                  </div>
                )}

                {isOverdue && (
                  <div 
                    className="flex items-center gap-2 mt-4 p-3 bg-red-50 rounded-lg border border-red-200"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" aria-hidden="true" />
                    <p className="text-sm text-red-800">
                      <span className="font-medium">Overdue!</span> The proposal deadline has passed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Solicitation Slideout */}
      {isSolicitationEditorOpen && (
        <EditSolicitationSlideout
          solicitation={solicitation}
          updateSolicitation={updateSolicitation}
          onClose={() => closeSolicitationEditor()}
        />
      )}

      {/* Versions History Slideout */}
      <ConfirmDialog
        open={!!versionConfirm}
        title={versionConfirm?.type === 'restore' ? 'Restore version?' : 'Delete version?'}
        body={versionConfirm?.type === 'restore'
          ? 'Are you sure you want to restore this version? Current unsaved changes will be lost.'
          : 'Are you sure you want to delete this version? This cannot be undone.'}
        confirmLabel={versionConfirm?.type === 'restore' ? 'Restore' : 'Delete'}
        destructive
        onConfirm={() => {
          if (versionConfirm?.type === 'restore') {
            restoreProjectVersion(versionConfirm.id)
            setIsVersionsSlideoutOpen(false)
          } else if (versionConfirm?.type === 'delete') {
            deleteProjectVersion(versionConfirm.id)
          }
          setVersionConfirm(null)
        }}
        onCancel={() => setVersionConfirm(null)}
      />

      {isVersionsSlideoutOpen && (
        <VersionsSlideout
          versions={projectVersions}
          onClose={() => setIsVersionsSlideoutOpen(false)}
          onSave={handleSaveVersion}
          onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
          newVersionName={newVersionName}
          setNewVersionName={setNewVersionName}
          newVersionNotes={newVersionNotes}
          setNewVersionNotes={setNewVersionNotes}
          formatDate={formatVersionDate}
        />
      )}

      {/* Tab Content */}
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-6 flex-1 overflow-y-auto">
        {/* Utility Tools (shown when active) */}
        {activeUtilityTool === 'sub-rates' && <SubRatesTab />}
        
        {/* Main Bid Flow (hidden when utility tool is active) */}
        {!isUtilityToolActive && (
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
          >
            {activeTab === 'upload' && <UploadTab onContinue={() => handleTabChange('estimate')} />}
            {activeTab === 'estimate' && <EstimateTab />}
            {activeTab === 'roles' && <RolesAndPricingTab />}
            {activeTab === 'teaming-partners' && <TeamingPartnersTab />}
            {activeTab === 'write' && <Outline />}
            {activeTab === 'export' && <ExportTab />}
          </div>
        )}
      </main>
    </div>
  )
}

// ==================== EDIT SOLICITATION SLIDEOUT ====================

interface EditSolicitationSlideoutProps {
  solicitation: any
  updateSolicitation: (updates: any) => void
  onClose: () => void
}

function EditSolicitationSlideout({ 
  solicitation, 
  updateSolicitation, 
  onClose 
}: EditSolicitationSlideoutProps) {
  
  // Focus trap and escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Slideout Panel */}
      <div 
        className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-solicitation-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 id="edit-solicitation-title" className="text-xl font-semibold text-gray-900">
            Edit Solicitation Details
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Basic Information
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="solNum">Solicitation Number</Label>
                <Input
                  id="solNum"
                  value={solicitation?.solicitationNumber || ''}
                  onChange={(e) => updateSolicitation({ solicitationNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internalBidNum">Internal Bid Number</Label>
                <Input
                  id="internalBidNum"
                  value={solicitation?.internalBidNumber || ''}
                  onChange={(e) => updateSolicitation({ internalBidNumber: e.target.value })}
                  placeholder="e.g., BID-2024-042"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={solicitation?.title || ''}
                onChange={(e) => updateSolicitation({ title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agency">Agency</Label>
                <select
                  id="agency"
                  value={solicitation?.clientAgency || ''}
                  onChange={(e) => updateSolicitation({ clientAgency: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Agency</option>
                  <option value="DOD">Department of Defense (DOD)</option>
                  <option value="HHS">Health & Human Services (HHS)</option>
                  <option value="VA">Veterans Affairs (VA)</option>
                  <option value="DHS">Homeland Security (DHS)</option>
                  <option value="DOJ">Department of Justice (DOJ)</option>
                  <option value="Treasury">Department of Treasury</option>
                  <option value="State">Department of State</option>
                  <option value="DOE">Department of Energy (DOE)</option>
                  <option value="EPA">Environmental Protection Agency (EPA)</option>
                  <option value="NASA">NASA</option>
                  <option value="GSA">General Services Administration (GSA)</option>
                  <option value="SSA">Social Security Administration (SSA)</option>
                  <option value="USDA">Department of Agriculture (USDA)</option>
                  <option value="Commerce">Department of Commerce</option>
                  <option value="Labor">Department of Labor</option>
                  <option value="Interior">Department of Interior</option>
                  <option value="Education">Department of Education</option>
                  <option value="HUD">Housing & Urban Development (HUD)</option>
                  <option value="Transportation">Department of Transportation</option>
                  <option value="OPM">Office of Personnel Management (OPM)</option>
                  <option value="SBA">Small Business Administration (SBA)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subAgency">Sub-Agency / Bureau</Label>
                <Input
                  id="subAgency"
                  value={solicitation?.subAgency || ''}
                  onChange={(e) => updateSolicitation({ subAgency: e.target.value })}
                  placeholder="e.g., CDC, FBI, USCIS"
                />
              </div>
            </div>
          </fieldset>

          {/* Contract Details */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Contract Details
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractType">Contract Type</Label>
                <select
                  id="contractType"
                  value={solicitation?.contractType || ''}
                  onChange={(e) => updateSolicitation({ contractType: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="T&M">Time & Materials (T&M)</option>
                  <option value="FFP">Firm Fixed Price (FFP)</option>
                  <option value="GSA">GSA Schedule</option>
                  <option value="CPFF">Cost Plus Fixed Fee (CPFF)</option>
                  <option value="CPAF">Cost Plus Award Fee (CPAF)</option>
                  <option value="IDIQ">IDIQ</option>
                  <option value="BPA">Blanket Purchase Agreement (BPA)</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evaluationMethod">Evaluation Method</Label>
                <select
                  id="evaluationMethod"
                  value={solicitation?.evaluationMethod || ''}
                  onChange={(e) => updateSolicitation({ evaluationMethod: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Method</option>
                  <option value="LPTA">Lowest Price Technically Acceptable (LPTA)</option>
                  <option value="best-value">Best Value</option>
                  <option value="tradeoff">Tradeoff</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="naics">NAICS Code</Label>
                <Input
                  id="naics"
                  value={solicitation?.naicsCode || ''}
                  onChange={(e) => updateSolicitation({ naicsCode: e.target.value })}
                  placeholder="e.g., 541512"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="psc">PSC Code</Label>
                <Input
                  id="psc"
                  value={solicitation?.psc || ''}
                  onChange={(e) => updateSolicitation({ psc: e.target.value })}
                  placeholder="e.g., D302"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractVehicle">Contract Vehicle</Label>
              <Input
                id="contractVehicle"
                value={solicitation?.contractVehicle || ''}
                onChange={(e) => updateSolicitation({ contractVehicle: e.target.value })}
                placeholder="e.g., GSA MAS, CIO-SP3, Alliant 2"
              />
            </div>
          </fieldset>

          {/* Period of Performance */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Period of Performance
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Year</Label>
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    id="baseYear"
                    checked={solicitation?.periodOfPerformance?.baseYear ?? true}
                    onChange={(e) => updateSolicitation({ 
                      periodOfPerformance: { 
                        ...solicitation?.periodOfPerformance,
                        baseYear: e.target.checked 
                      }
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="baseYear" className="text-sm text-gray-700">
                    Include Base Year
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="optionYears">Option Years</Label>
                <select
                  id="optionYears"
                  value={solicitation?.periodOfPerformance?.optionYears ?? 2}
                  onChange={(e) => updateSolicitation({ 
                    periodOfPerformance: { 
                      ...solicitation?.periodOfPerformance,
                      optionYears: parseInt(e.target.value) 
                    }
                  })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <option key={num} value={num}>
                      {num} Option Year{num !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* ==================== PRICING SETTINGS ==================== */}
          <TooltipProvider>
            <fieldset className="space-y-4 pt-4 border-t">
              <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Pricing Settings
              </legend>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Billable Hours */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="billableHours">Billable Hours per Year</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label="More information about billable hours" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          A full work year is 2,080 hours. Most contracts use 1,920 hours to account for 
                          holidays and paid time off. This affects total cost but not hourly rates.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="billableHours"
                    type="number"
                    min="1000"
                    max="2080"
                    step="40"
                    value={solicitation?.pricingSettings?.billableHours ?? 1920}
                    onChange={(e) => updateSolicitation({ 
                      pricingSettings: { 
                        ...solicitation?.pricingSettings,
                        billableHours: parseInt(e.target.value) || 1920
                      }
                    })}
                    placeholder="1920"
                    aria-describedby="billableHours-help"
                  />
                  <p id="billableHours-help" className="text-xs text-gray-600">
                    Common: 1,920 (with PTO) or 2,080 (full year)
                  </p>
                </div>

                {/* Profit Margin */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="profitMargin">Profit Margin (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label="More information about profit margin" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          The percentage added to your costs to determine your bill rate. 
                          Typical range is 5-15% depending on contract type and competition level.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="profitMargin"
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={solicitation?.pricingSettings?.profitMargin ?? 8}
                    onChange={(e) => updateSolicitation({ 
                      pricingSettings: { 
                        ...solicitation?.pricingSettings,
                        profitMargin: parseFloat(e.target.value) || 8
                      }
                    })}
                    placeholder="8"
                    aria-describedby="profitMargin-help"
                  />
                  <p id="profitMargin-help" className="text-xs text-gray-600">
                    Typical: 8-10% for competitive bids
                  </p>
                </div>
              </div>

              {/* Annual Rate Increases */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="escalationEnabled">Annual Rate Increases</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label="More information about annual rate increases" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          Increase rates each option year to account for inflation and rising costs. 
                          Typically 2-4% per year based on market conditions.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    id="escalationEnabled"
                    aria-checked={solicitation?.pricingSettings?.escalationEnabled ?? true}
                    aria-label={`Annual rate increases are ${(solicitation?.pricingSettings?.escalationEnabled ?? true) ? 'enabled' : 'disabled'}`}
                    onClick={() => updateSolicitation({ 
                      pricingSettings: { 
                        ...solicitation?.pricingSettings,
                        escalationEnabled: !(solicitation?.pricingSettings?.escalationEnabled ?? true)
                      }
                    })}
                    className={`
                      relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      ${(solicitation?.pricingSettings?.escalationEnabled ?? true) ? 'bg-blue-600' : 'bg-gray-200'}
                    `}
                  >
                    <span
                      aria-hidden="true"
                      className={`
                        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 
                        transition duration-200 ease-in-out
                        ${(solicitation?.pricingSettings?.escalationEnabled ?? true) ? 'translate-x-4' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {/* Rate increase fields - only show when enabled */}
                {(solicitation?.pricingSettings?.escalationEnabled ?? true) && (
                  <div className="grid grid-cols-2 gap-4 pl-0 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="laborEscalation" className="text-sm text-gray-700">
                        Labor Rate Increase (% per year)
                      </Label>
                      <Input
                        id="laborEscalation"
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={solicitation?.pricingSettings?.laborEscalation ?? 3}
                        onChange={(e) => updateSolicitation({ 
                          pricingSettings: { 
                            ...solicitation?.pricingSettings,
                            laborEscalation: parseFloat(e.target.value) || 3
                          }
                        })}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="odcEscalation" className="text-sm text-gray-700">
                        ODC Increase (% per year)
                      </Label>
                      <Input
                        id="odcEscalation"
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={solicitation?.pricingSettings?.odcEscalation ?? 0}
                        onChange={(e) => updateSolicitation({ 
                          pricingSettings: { 
                            ...solicitation?.pricingSettings,
                            odcEscalation: parseFloat(e.target.value) || 0
                          }
                        })}
                        placeholder="2"
                      />
                      <p className="text-xs text-gray-600">Travel, materials, equipment</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Preview */}
              <div className="flex items-center gap-2 pt-2 flex-wrap" role="status" aria-live="polite">
                <span className="text-xs text-gray-600">Current settings:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {solicitation?.pricingSettings?.profitMargin ?? 8}% profit
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                  {(solicitation?.pricingSettings?.billableHours ?? 1920).toLocaleString()} hours per year
                </span>
                {(solicitation?.pricingSettings?.escalationEnabled ?? true) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    +{solicitation?.pricingSettings?.laborEscalation ?? 3}% labor, +{solicitation?.pricingSettings?.odcEscalation ?? 0}% ODCs yearly
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    No annual increases
                  </span>
                )}
              </div>
            </fieldset>
          </TooltipProvider>
          {/* ==================== END: PRICING SETTINGS ==================== */}

          {/* Set-Aside & Compliance */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Set-Aside & Compliance
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setAside">Set-Aside</Label>
                <select
                  id="setAside"
                  value={solicitation?.setAside || ''}
                  onChange={(e) => updateSolicitation({ setAside: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Set-Aside</option>
                  <option value="full-open">Full & Open Competition</option>
                  <option value="small-business">Small Business Set-Aside</option>
                  <option value="8a">8(a) Set-Aside</option>
                  <option value="hubzone">HUBZone Set-Aside</option>
                  <option value="sdvosb">SDVOSB Set-Aside</option>
                  <option value="wosb">WOSB Set-Aside</option>
                  <option value="edwosb">EDWOSB Set-Aside</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearance">Clearance Required</Label>
                <select
                  id="clearance"
                  value={solicitation?.clearanceLevel || ''}
                  onChange={(e) => updateSolicitation({ 
                    requiresClearance: e.target.value !== '',
                    clearanceLevel: e.target.value 
                  })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None Required</option>
                  <option value="public-trust">Public Trust</option>
                  <option value="secret">Secret</option>
                  <option value="top-secret">Top Secret</option>
                  <option value="ts-sci">TS/SCI</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Place of Performance */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Place of Performance
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="performanceType">Work Location Type</Label>
                <select
                  id="performanceType"
                  value={solicitation?.placeOfPerformance?.type || ''}
                  onChange={(e) => updateSolicitation({ 
                    placeOfPerformance: { 
                      ...solicitation?.placeOfPerformance,
                      type: e.target.value 
                    }
                  })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="remote">Remote</option>
                  <option value="on-site">On-Site</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="travelPercent">Travel Requirement (%)</Label>
                <Input
                  id="travelPercent"
                  type="number"
                  min="0"
                  max="100"
                  value={solicitation?.placeOfPerformance?.travelPercent || ''}
                  onChange={(e) => updateSolicitation({ 
                    placeOfPerformance: { 
                      ...solicitation?.placeOfPerformance,
                      travelRequired: parseInt(e.target.value) > 0,
                      travelPercent: parseInt(e.target.value) || 0
                    }
                  })}
                  placeholder="0-100"
                />
              </div>
            </div>
          </fieldset>

          {/* Key Dates */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Key Dates
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={solicitation?.releaseDate?.split('T')[0] || ''}
                  onChange={(e) => updateSolicitation({ releaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="questionsDue">Questions Due</Label>
                <Input
                  id="questionsDue"
                  type="date"
                  value={solicitation?.questionsDeadline?.split('T')[0] || ''}
                  onChange={(e) => updateSolicitation({ questionsDeadline: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proposalDue">Proposal Due</Label>
                <Input
                  id="proposalDue"
                  type="date"
                  value={solicitation?.proposalDueDate?.split('T')[0] || ''}
                  onChange={(e) => updateSolicitation({ proposalDueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awardDate">Anticipated Award</Label>
                <Input
                  id="awardDate"
                  type="date"
                  value={solicitation?.anticipatedAwardDate?.split('T')[0] || ''}
                  onChange={(e) => updateSolicitation({ anticipatedAwardDate: e.target.value })}
                />
              </div>
            </div>
          </fieldset>

          {/* Budget */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Budget Range (Optional)
            </legend>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgetMin">Minimum ($)</Label>
                <Input
                  id="budgetMin"
                  type="number"
                  value={solicitation?.budgetRange?.min || ''}
                  onChange={(e) => updateSolicitation({ 
                    budgetRange: { 
                      ...solicitation?.budgetRange,
                      min: parseInt(e.target.value) || undefined 
                    }
                  })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetMax">Maximum ($)</Label>
                <Input
                  id="budgetMax"
                  type="number"
                  value={solicitation?.budgetRange?.max || ''}
                  onChange={(e) => updateSolicitation({ 
                    budgetRange: { 
                      ...solicitation?.budgetRange,
                      max: parseInt(e.target.value) || undefined 
                    }
                  })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetCeiling">Ceiling ($)</Label>
                <Input
                  id="budgetCeiling"
                  type="number"
                  value={solicitation?.budgetRange?.ceiling || ''}
                  onChange={(e) => updateSolicitation({ 
                    budgetRange: { 
                      ...solicitation?.budgetRange,
                      ceiling: parseInt(e.target.value) || undefined 
                    }
                  })}
                  placeholder="0"
                />
              </div>
            </div>
          </fieldset>

          {/* Bid Decision */}
          <fieldset className="space-y-4 pt-4 border-t">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Bid Decision
            </legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bidDecision">Decision</Label>
                <select
                  id="bidDecision"
                  value={solicitation?.bidDecision || ''}
                  onChange={(e) => updateSolicitation({ bidDecision: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not Decided</option>
                  <option value="pending">Pending Review</option>
                  <option value="go">Go</option>
                  <option value="no-go">No-Go</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidDecisionDate">Decision Date</Label>
                <Input
                  id="bidDecisionDate"
                  type="date"
                  value={solicitation?.bidDecisionDate?.split('T')[0] || ''}
                  onChange={(e) => updateSolicitation({ bidDecisionDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bidRationale">Rationale</Label>
              <textarea
                id="bidRationale"
                value={solicitation?.bidDecisionRationale || ''}
                onChange={(e) => updateSolicitation({ bidDecisionRationale: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                placeholder="Why are we pursuing / not pursuing this opportunity?"
              />
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>
            Save Changes
          </Button>
        </div>
      </div>
    </>
  )
}

// ==================== VERSIONS SLIDEOUT ====================

interface VersionsSlideoutProps {
  versions: Array<{
    id: string
    name: string
    notes?: string
    createdAt: string
  }>
  onClose: () => void
  onSave: () => void
  onRestore: (versionId: string) => void
  onDelete: (versionId: string) => void
  newVersionName: string
  setNewVersionName: (name: string) => void
  newVersionNotes: string
  setNewVersionNotes: (notes: string) => void
  formatDate: (date: string) => string
}

function VersionsSlideout({
  versions,
  onClose,
  onSave,
  onRestore,
  onDelete,
  newVersionName,
  setNewVersionName,
  newVersionNotes,
  setNewVersionNotes,
  formatDate,
}: VersionsSlideoutProps) {
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Slideout Panel */}
      <div 
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <History className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 id="versions-title" className="font-semibold text-gray-900">
                Version History
              </h2>
              <p className="text-xs text-gray-500">
                {versions.length} saved version{versions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Save New Version */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Save className="w-4 h-4 text-gray-500" />
              Save Current State
            </h3>
            <div className="space-y-2">
              <Input
                placeholder="Version name (e.g., 'Draft v2', 'Final Submission')"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="text-sm"
              />
              <textarea
                placeholder="Notes (optional)"
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-y"
              />
            </div>
            <Button 
              onClick={onSave}
              disabled={!newVersionName.trim()}
              className="w-full"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Version
            </Button>
          </div>

          {/* Saved Versions List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              Saved Versions
            </h3>
            
            {versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No versions saved yet</p>
                <p className="text-xs mt-1">Save a version to track changes over time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((version, index) => (
                  <div 
                    key={version.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {version.name}
                          </span>
                          {index === 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 bg-green-100 text-green-700">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDate(version.createdAt)}
                        </p>
                        {version.notes && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {version.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(version.id)}
                          className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(version.id)}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete this version"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          <p className="text-xs text-gray-500 text-center">
            Versions are saved locally. Enable cloud sync for permanent storage.
          </p>
        </div>
      </div>
    </>
  )
}