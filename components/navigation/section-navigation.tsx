'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Search,
  Layers,
  Grid3X3,
  Clock,
  Users,
  Shield,
  Building2,
  CheckCircle2,
  FileDown,
  Link2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Pencil,
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

// Tab components
import { UploadTab } from '@/components/tabs/upload-tab'
import { EstimateTab } from '@/components/tabs/estimate-tab'
import { RolesAndPricingTab } from '@/components/tabs/roles-and-pricing-tab'
import { RateJustificationTab } from '@/components/tabs/rate-justification-tab'
import { TeamingPartnersTab } from '@/components/tabs/teaming-partners-tab'
import { LaborMatrix } from '@/components/tabs/staff/labor-matrix'
import { ExportTab } from '@/components/tabs/export-tab'
import { ProposalStatus } from '@/components/tabs/deliver/proposal-status'
import { CollabManager } from '@/components/tabs/staff/collab-manager'
import { ShareLink } from '@/components/tabs/deliver/share-link'
import { contractTypeLabels, setAsideLabels } from '@/lib/solicitation-type'

// ==================== TYPES ====================

type SectionId = 'scope' | 'staff' | 'deliver'

type ViewId =
  // Scope
  | 'solicitation-summary'
  | 'requirements'
  // Staff
  | 'wbs-elements'
  | 'labor-matrix'
  | 'timeline'
  | 'roles-pricing'
  | 'rate-justification'
  | 'subs-partners'
  | 'director-review'
  // Deliver
  | 'proposal-status'
  | 'boe-preview'
  | 'export-documents'
  | 'share-link'

interface SidebarItem {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  isPanel?: boolean // Opens as side panel instead of replacing main content
}

interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

interface SectionConfig {
  id: SectionId
  label: string
  groups: SidebarGroup[]
}

// ==================== SECTION CONFIG ====================

const SECTIONS: SectionConfig[] = [
  {
    id: 'scope',
    label: 'Scope',
    groups: [
      {
        label: 'Documents',
        items: [
          { id: 'solicitation-summary', label: 'Solicitation Summary', icon: FileText },
          { id: 'requirements', label: 'Requirements', icon: Search },
        ],
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    groups: [
      {
        label: 'Estimate',
        items: [
          { id: 'wbs-elements', label: 'WBS Elements', icon: Layers },
          { id: 'labor-matrix', label: 'Labor Matrix', icon: Grid3X3 },
          { id: 'timeline', label: 'Timeline', icon: Clock },
        ],
      },
      {
        label: 'Pricing',
        items: [
          { id: 'roles-pricing', label: 'Roles & Pricing', icon: Users },
          { id: 'rate-justification', label: 'Rate Justification', icon: Shield, isPanel: true },
        ],
      },
      {
        label: 'Partners',
        items: [
          { id: 'subs-partners', label: 'Subs & Partners', icon: Building2 },
        ],
      },
      {
        label: 'Collaboration',
        items: [
          { id: 'director-review', label: 'Director Review', icon: Users },
        ],
      },
    ],
  },
  {
    id: 'deliver',
    label: 'Deliver',
    groups: [
      {
        label: 'Review',
        items: [
          { id: 'proposal-status', label: 'Proposal Status', icon: CheckCircle2 },
          { id: 'boe-preview', label: 'BOE Preview', icon: FileText },
        ],
      },
      {
        label: 'Export',
        items: [
          { id: 'export-documents', label: 'Export Documents', icon: FileDown },
          { id: 'share-link', label: 'Shareable BOE Link', icon: Link2 },
        ],
      },
    ],
  },
]

// Map old tab IDs to new view IDs for URL compatibility
const TAB_TO_VIEW: Record<string, { section: SectionId; view: ViewId }> = {
  'upload': { section: 'scope', view: 'solicitation-summary' },
  'estimate': { section: 'staff', view: 'wbs-elements' },
  'roles': { section: 'staff', view: 'roles-pricing' },
  'rate-justification': { section: 'staff', view: 'rate-justification' },
  'teaming-partners': { section: 'staff', view: 'subs-partners' },
  'export': { section: 'deliver', view: 'export-documents' },
}

// ==================== MAIN COMPONENT ====================

export function SectionNavigation() {
  const [activeSection, setActiveSection] = useState<SectionId>('scope')
  const [activeView, setActiveView] = useState<ViewId>('solicitation-summary')
  const [rateJustificationOpen, setRateJustificationOpen] = useState(false)
  const [showSolicitationExpanded, setShowSolicitationExpanded] = useState(false)
  const [isVersionsSlideoutOpen, setIsVersionsSlideoutOpen] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionNotes, setNewVersionNotes] = useState('')

  const {
    solicitation,
    updateSolicitation,
    isSolicitationEditorOpen,
    openSolicitationEditor,
    closeSolicitationEditor,
    activeMainTab,
    setActiveMainTab,
    setActiveUtilityTool,
    projectVersions,
    saveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
  } = useAppContext()

  // Read tab from URL params on mount (backwards compatibility)
  const searchParams = useSearchParams()
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && TAB_TO_VIEW[tabParam]) {
      const { section, view } = TAB_TO_VIEW[tabParam]
      setActiveSection(section)
      setActiveView(view)
    }
    const viewParam = searchParams.get('view')
    if (viewParam) {
      // Find which section this view belongs to
      for (const section of SECTIONS) {
        for (const group of section.groups) {
          if (group.items.some(item => item.id === viewParam)) {
            setActiveSection(section.id)
            setActiveView(viewParam as ViewId)
            break
          }
        }
      }
    }
  }, [searchParams])

  // Sync old context tab state for components that use setActiveMainTab
  useEffect(() => {
    if (activeMainTab === 'rate-justification') {
      setRateJustificationOpen(true)
      setActiveMainTab('roles' as MainTabId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab])

  const handleViewChange = (viewId: ViewId) => {
    const item = SECTIONS.flatMap(s => s.groups.flatMap(g => g.items)).find(i => i.id === viewId)
    if (item?.isPanel) {
      setRateJustificationOpen(true)
    } else {
      setActiveView(viewId)
      setRateJustificationOpen(false)
    }

    // Sync with old context for components that read activeMainTab
    const viewToTab: Record<string, string> = {
      'solicitation-summary': 'upload',
      'requirements': 'estimate',
      'wbs-elements': 'estimate',
      'labor-matrix': 'estimate',
      'timeline': 'estimate',
      'roles-pricing': 'roles',
      'subs-partners': 'teaming-partners',
      'boe-preview': 'export',
      'export-documents': 'export',
      'proposal-status': 'export',
      'share-link': 'export',
    }
    if (viewToTab[viewId]) {
      setActiveMainTab(viewToTab[viewId] as MainTabId)
      setActiveUtilityTool(null)
    }
  }

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId)
    // Navigate to first view in section
    const firstView = SECTIONS.find(s => s.id === sectionId)?.groups[0]?.items[0]?.id
    if (firstView) {
      handleViewChange(firstView)
    }
  }

  // Date calculations
  const daysUntilDue = useMemo(() => {
    if (!solicitation?.proposalDueDate) return null
    const due = new Date(solicitation.proposalDueDate)
    const now = new Date()
    const diffTime = due.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [solicitation])

  const isUrgent = daysUntilDue !== null && daysUntilDue <= 14 && daysUntilDue >= 0
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rateJustificationOpen) {
          setRateJustificationOpen(false)
        } else if (isVersionsSlideoutOpen) {
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
  }, [rateJustificationOpen, isVersionsSlideoutOpen, isSolicitationEditorOpen, closeSolicitationEditor, showSolicitationExpanded])

  // Version handlers
  const handleSaveVersion = useCallback(() => {
    if (!newVersionName.trim()) return
    saveProjectVersion(newVersionName.trim(), newVersionNotes.trim())
    setNewVersionName('')
    setNewVersionNotes('')
  }, [newVersionName, newVersionNotes, saveProjectVersion])

  const handleRestoreVersion = useCallback((versionId: string) => {
    restoreProjectVersion(versionId)
    setIsVersionsSlideoutOpen(false)
  }, [restoreProjectVersion])

  const handleDeleteVersion = useCallback((versionId: string) => {
    deleteProjectVersion(versionId)
  }, [deleteProjectVersion])

  // ==================== RENDER ====================
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* ===== PROPOSAL HEADER BAR ===== */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shrink-0">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between h-12">
              {/* Breadcrumb */}
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
                  {solicitation.title || 'Untitled Proposal'}
                </span>
              </nav>

              {/* Status pills */}
              <div className="flex items-center gap-2 shrink-0">
                {solicitation.contractType && (
                  <Badge variant="secondary" className="text-xs">
                    {contractTypeLabels[solicitation.contractType] || solicitation.contractType}
                  </Badge>
                )}
                {daysUntilDue !== null && (
                  <Badge
                    variant={isOverdue ? 'destructive' : isUrgent ? 'outline' : 'secondary'}
                    className="text-xs"
                  >
                    {isOverdue
                      ? `${Math.abs(daysUntilDue)}d overdue`
                      : `${daysUntilDue}d until due`}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowSolicitationExpanded(!showSolicitationExpanded)}
                  aria-label="Toggle solicitation details"
                >
                  {showSolicitationExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Expanded solicitation details */}
          {showSolicitationExpanded && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-3">
              <div className="container mx-auto flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
                {solicitation.solicitationNumber && (
                  <span>Sol #: <strong>{solicitation.solicitationNumber}</strong></span>
                )}
                {solicitation.clientAgency && (
                  <span>Agency: <strong>{solicitation.clientAgency}</strong></span>
                )}
                {solicitation.setAside && (
                  <span>Set-Aside: <strong>{setAsideLabels[solicitation.setAside] || solicitation.setAside}</strong></span>
                )}
                {solicitation.naicsCode && (
                  <span>NAICS: <strong>{solicitation.naicsCode}</strong></span>
                )}
                <Button variant="ghost" size="sm" onClick={openSolicitationEditor} className="text-xs h-6 px-2">
                  <Pencil className="w-3 h-3 mr-1" /> Edit Details
                </Button>
              </div>
            </div>
          )}
        </header>

        {/* ===== SECTION TABS ===== */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="container mx-auto px-4 md:px-6">
            <nav className="flex gap-0" role="tablist" aria-label="Proposal sections">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSectionChange(section.id)}
                    className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                  >
                    {section.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* ===== SIDEBAR + CONTENT ===== */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="w-56 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 shrink-0 overflow-y-auto">
            <nav className="p-3 space-y-4" aria-label="Section navigation">
              {SECTIONS.find(s => s.id === activeSection)?.groups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-2 mb-1">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeView === item.id && !item.isPanel
                      const isPanelActive = item.isPanel && rateJustificationOpen
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => handleViewChange(item.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              isActive || isPanelActive
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-900/40 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                            {item.isPanel && (
                              <ChevronRight className="w-3 h-3 ml-auto text-gray-400" aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}

              {/* Version History button in Scope section */}
              {activeSection === 'scope' && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => setIsVersionsSlideoutOpen(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-900/40 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <History className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Version History</span>
                  </button>
                </div>
              )}
            </nav>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-6 max-w-5xl">
              {/* SCOPE views */}
              {activeView === 'solicitation-summary' && activeSection === 'scope' && (
                <UploadTab onContinue={() => { setActiveSection('staff'); handleViewChange('wbs-elements') }} />
              )}
              {activeView === 'requirements' && activeSection === 'scope' && (
                <EstimateTab />
              )}

              {/* STAFF views */}
              {activeView === 'wbs-elements' && activeSection === 'staff' && (
                <EstimateTab />
              )}
              {activeView === 'labor-matrix' && activeSection === 'staff' && (
                <LaborMatrix />
              )}
              {activeView === 'timeline' && activeSection === 'staff' && (
                <EstimateTab />
              )}
              {activeView === 'roles-pricing' && activeSection === 'staff' && (
                <RolesAndPricingTab />
              )}
              {activeView === 'subs-partners' && activeSection === 'staff' && (
                <TeamingPartnersTab />
              )}
              {activeView === 'director-review' && activeSection === 'staff' && (
                <CollabManager />
              )}

              {/* DELIVER views */}
              {activeView === 'proposal-status' && activeSection === 'deliver' && (
                <ProposalStatus />
              )}
              {activeView === 'boe-preview' && activeSection === 'deliver' && (
                <ExportTab />
              )}
              {activeView === 'export-documents' && activeSection === 'deliver' && (
                <ExportTab />
              )}
              {activeView === 'share-link' && activeSection === 'deliver' && (
                <ShareLink />
              )}
            </div>
          </main>

          {/* Rate Justification side panel */}
          {rateJustificationOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={() => setRateJustificationOpen(false)}
              />
              <div className="fixed inset-y-0 right-0 w-[560px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl z-50 overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold">Rate Justification</h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRateJustificationOpen(false)}
                    aria-label="Close rate justification panel"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <RateJustificationTab />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== VERSION HISTORY SLIDEOUT ===== */}
        {isVersionsSlideoutOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsVersionsSlideoutOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl z-50 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold">Version History</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsVersionsSlideoutOpen(false)}
                  aria-label="Close version history"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Save new version */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-3 shrink-0">
                <div className="space-y-2">
                  <Label htmlFor="version-name" className="text-xs font-medium">Version Name</Label>
                  <Input
                    id="version-name"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    placeholder="e.g., Pre-review draft"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version-notes" className="text-xs font-medium">Notes (optional)</Label>
                  <Input
                    id="version-notes"
                    value={newVersionNotes}
                    onChange={(e) => setNewVersionNotes(e.target.value)}
                    placeholder="What changed?"
                    className="text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveVersion}
                  disabled={!newVersionName.trim()}
                  className="w-full"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Version
                </Button>
              </div>

              {/* Version list */}
              <div className="flex-1 overflow-y-auto p-4">
                {projectVersions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No versions saved yet</p>
                ) : (
                  <div className="space-y-3">
                    {projectVersions.map((version) => (
                      <div key={version.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{version.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(version.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" onClick={() => handleRestoreVersion(version.id)} aria-label="Restore version">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restore this version</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteVersion(version.id)} aria-label="Delete version">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete this version</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        {version.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">{version.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== SOLICITATION EDITOR (from old tabs-navigation) ===== */}
        {isSolicitationEditorOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={closeSolicitationEditor}
            />
            <div className="fixed inset-y-0 right-0 w-[500px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl z-50 overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm font-semibold">Edit Solicitation Details</h2>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={closeSolicitationEditor}
                  aria-label="Close solicitation editor"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sol-title">Title</Label>
                  <Input
                    id="sol-title"
                    value={solicitation.title || ''}
                    onChange={(e) => updateSolicitation({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sol-number">Solicitation Number</Label>
                  <Input
                    id="sol-number"
                    value={solicitation.solicitationNumber || ''}
                    onChange={(e) => updateSolicitation({ solicitationNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sol-agency">Agency</Label>
                  <Input
                    id="sol-agency"
                    value={solicitation.clientAgency || ''}
                    onChange={(e) => updateSolicitation({ clientAgency: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sol-due">Due Date</Label>
                  <Input
                    id="sol-due"
                    type="date"
                    value={solicitation.proposalDueDate || ''}
                    onChange={(e) => updateSolicitation({ proposalDueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sol-naics">NAICS Code</Label>
                  <Input
                    id="sol-naics"
                    value={solicitation.naicsCode || ''}
                    onChange={(e) => updateSolicitation({ naicsCode: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

// Need MainTabId type for context sync
type MainTabId = 'upload' | 'estimate' | 'roles' | 'teaming-partners' | 'rate-justification' | 'export'
