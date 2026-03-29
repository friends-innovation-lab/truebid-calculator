'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { X, History, Save, RotateCcw, Trash2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useAppContext } from '@/contexts/app-context'
import { ProposalLayout, SectionId, SECTION_DEFAULT_VIEWS } from '@/components/layout/proposal-layout'

// Tab components
import { EstimateTab } from '@/components/tabs/estimate-tab'
import { RolesAndPricingTab } from '@/components/tabs/roles-and-pricing-tab'
import { RateJustificationTab } from '@/components/tabs/rate-justification-tab'
import { TeamingPartnersTab } from '@/components/tabs/teaming-partners-tab'
import { LaborMatrix } from '@/components/tabs/staff/labor-matrix'
import { ExportTab } from '@/components/tabs/export-tab'
import { ProposalStatus } from '@/components/tabs/deliver/proposal-status'
import { CollabManager } from '@/components/tabs/staff/collab-manager'
import { ShareLink } from '@/components/tabs/deliver/share-link'
import { EmptyState } from '@/components/ui/empty-state'
import { Strategy } from '@/components/tabs/scope/strategy'
import { Solicitation } from '@/components/tabs/scope/solicitation'
import { Requirements } from '@/components/tabs/scope/requirements'
import { Outline } from '@/components/tabs/write/outline'
import { TechnicalVolume } from '@/components/tabs/write/technical-volume'

// ==================== TYPES ====================

type ViewId =
  // Scope
  | 'solicitation'
  | 'strategy'
  | 'requirements'
  // Staff
  | 'wbs-elements'
  | 'labor-matrix'
  | 'timeline'
  | 'roles-pricing'
  | 'rate-justification'
  | 'subs-partners'
  | 'director-review'
  // Write
  | 'outline'
  | 'technical-editor'
  // Deliver
  | 'proposal-status'
  | 'boe-preview'
  | 'export-documents'
  | 'share-link'

// Map old tab IDs to new view IDs for URL compatibility
const TAB_TO_VIEW: Record<string, { section: SectionId; view: ViewId }> = {
  'upload': { section: 'scope', view: 'solicitation' },
  'solicitation': { section: 'scope', view: 'solicitation' },
  'estimate': { section: 'staff', view: 'wbs-elements' },
  'roles': { section: 'staff', view: 'roles-pricing' },
  'rate-justification': { section: 'staff', view: 'rate-justification' },
  'teaming-partners': { section: 'staff', view: 'subs-partners' },
  'write': { section: 'write', view: 'outline' },
  'export': { section: 'deliver', view: 'export-documents' },
}

// ==================== MAIN COMPONENT ====================

export function SectionNavigation() {
  const [activeSection, setActiveSection] = useState<SectionId>('scope')
  const [activeView, setActiveView] = useState<ViewId>('solicitation')
  const [rateJustificationOpen, setRateJustificationOpen] = useState(false)
  const [isVersionsSlideoutOpen, setIsVersionsSlideoutOpen] = useState(false)
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionNotes, setNewVersionNotes] = useState('')

  const {
    solicitation,
    updateSolicitation,
    isSolicitationEditorOpen,
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
      setActiveView(viewParam as ViewId)
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

  const handleViewChange = (viewId: string) => {
    const typedViewId = viewId as ViewId

    // Handle panel items
    if (typedViewId === 'rate-justification') {
      setRateJustificationOpen(true)
      return
    }

    setActiveView(typedViewId)
    setRateJustificationOpen(false)

    // Sync with old context for components that read activeMainTab
    const viewToTab: Record<string, string> = {
      'solicitation': 'upload',
      'strategy': 'upload',
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
    if (viewToTab[typedViewId]) {
      setActiveMainTab(viewToTab[typedViewId] as MainTabId)
      setActiveUtilityTool(null)
    }
  }

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId)
    setActiveView(SECTION_DEFAULT_VIEWS[sectionId] as ViewId)
    setRateJustificationOpen(false)
  }

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
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [rateJustificationOpen, isVersionsSlideoutOpen, isSolicitationEditorOpen, closeSolicitationEditor])

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
      <ProposalLayout
        activeSection={activeSection}
        activeView={activeView}
        onSectionChange={handleSectionChange}
        onViewChange={handleViewChange}
      >
        {/* Main content area */}
        <div className="max-w-5xl mx-auto">
          {/* SCOPE views */}
          {activeView === 'solicitation' && activeSection === 'scope' && (
            <Solicitation />
          )}
          {activeView === 'strategy' && activeSection === 'scope' && (
            <Strategy />
          )}
          {activeView === 'requirements' && activeSection === 'scope' && (
            <Requirements />
          )}

          {/* STAFF views */}
          {activeView === 'wbs-elements' && activeSection === 'staff' && (
            <EstimateTab />
          )}
          {activeView === 'labor-matrix' && activeSection === 'staff' && (
            <LaborMatrix />
          )}
          {activeView === 'timeline' && activeSection === 'staff' && (
            <EmptyState
              icon={Calendar}
              title="Timeline available after staffing is complete"
              description="Once WBS elements have roles and hours assigned, the timeline will show FTE loading by month across the contract period."
            />
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

          {/* WRITE views */}
          {activeView === 'outline' && activeSection === 'write' && (
            <Outline />
          )}
          {activeView === 'technical-editor' && activeSection === 'write' && (
            <TechnicalVolume />
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
      </ProposalLayout>

      {/* Rate Justification side panel */}
      {rateJustificationOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setRateJustificationOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 w-[var(--panel-width)] bg-surface z-50 overflow-y-auto"
            style={{ borderLeft: '0.5px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between h-[52px] px-5"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
              <h2 className="text-[14px] font-semibold text-text-primary">Rate Justification</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRateJustificationOpen(false)}
                aria-label="Close rate justification panel"
                className="h-7 w-7"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5">
              <RateJustificationTab />
            </div>
          </div>
        </>
      )}

      {/* Version History Slideout */}
      {isVersionsSlideoutOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsVersionsSlideoutOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 w-96 bg-surface z-50 flex flex-col"
            style={{ borderLeft: '0.5px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between p-4 shrink-0"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-text-tertiary" />
                <h2 className="text-sm font-semibold text-text-primary">Version History</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsVersionsSlideoutOpen(false)}
                aria-label="Close version history"
                className="h-7 w-7"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Save new version */}
            <div
              className="p-4 space-y-3 shrink-0"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
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
                <p className="text-sm text-text-tertiary text-center py-8">No versions saved yet</p>
              ) : (
                <div className="space-y-3">
                  {projectVersions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 rounded-lg space-y-2"
                      style={{ border: '0.5px solid var(--border)' }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{version.name}</p>
                          <p className="text-xs text-text-tertiary">
                            {new Date(version.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestoreVersion(version.id)}
                                aria-label="Restore version"
                                className="h-7 w-7"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restore this version</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteVersion(version.id)}
                                aria-label="Delete version"
                                className="h-7 w-7"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete this version</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {version.notes && (
                        <p className="text-xs text-text-secondary">{version.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Solicitation Editor */}
      {isSolicitationEditorOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closeSolicitationEditor}
          />
          <div
            className="fixed inset-y-0 right-0 w-[500px] bg-surface z-50 overflow-y-auto"
            style={{ borderLeft: '0.5px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
              <h2 className="text-sm font-semibold text-text-primary">Edit Solicitation Details</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSolicitationEditor}
                aria-label="Close solicitation editor"
                className="h-7 w-7"
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
    </TooltipProvider>
  )
}

// Need MainTabId type for context sync
type MainTabId = 'upload' | 'estimate' | 'roles' | 'teaming-partners' | 'rate-justification' | 'write' | 'export'
