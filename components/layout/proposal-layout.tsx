'use client'

import { useState, useMemo, ReactNode } from 'react'
import { TopBar } from './top-bar'
import { ProposalTabs, SectionId } from './proposal-tabs'
import { Sidebar, SidebarGroup } from './sidebar'
import { useAppContext } from '@/contexts/app-context'
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
  PenLine,
  Target,
  ListChecks,
} from 'lucide-react'

// Section configurations
const SECTION_GROUPS: Record<SectionId, SidebarGroup[]> = {
  scope: [
    {
      label: 'Documents',
      items: [
        { id: 'strategy', label: 'Strategy', icon: Target },
        { id: 'solicitation-summary', label: 'Solicitation Summary', icon: FileText },
        { id: 'requirements', label: 'Requirements', icon: Search },
        { id: 'compliance-matrix', label: 'Compliance Matrix', icon: ListChecks },
      ],
    },
  ],
  staff: [
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
  write: [
    {
      label: 'Technical Volume',
      items: [
        { id: 'outline', label: 'Proposal Outline', icon: PenLine },
        { id: 'technical-editor', label: 'Write Content', icon: FileText },
      ],
    },
  ],
  deliver: [
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
}

// Default view for each section
const SECTION_DEFAULT_VIEWS: Record<SectionId, string> = {
  scope: 'strategy',
  staff: 'wbs-elements',
  write: 'outline',
  deliver: 'proposal-status',
}

interface ProposalLayoutProps {
  children: ReactNode
  activeSection: SectionId
  activeView: string
  onSectionChange: (section: SectionId) => void
  onViewChange: (viewId: string) => void
}

export function ProposalLayout({
  children,
  activeSection,
  activeView,
  onSectionChange,
  onViewChange,
}: ProposalLayoutProps) {
  const { solicitation } = useAppContext()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Future: tablet mode collapsed sidebar
  const isTabletCollapsed = false

  // Calculate days until due
  const daysUntilDue = useMemo(() => {
    if (!solicitation?.proposalDueDate) return null
    const due = new Date(solicitation.proposalDueDate)
    const now = new Date()
    const diffTime = due.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [solicitation])

  // Get sidebar groups for current section
  const currentGroups = SECTION_GROUPS[activeSection]

  // Handle section change - also switch to default view
  const handleSectionChange = (section: SectionId) => {
    onSectionChange(section)
    onViewChange(SECTION_DEFAULT_VIEWS[section])
  }

  // Detect tablet mode for collapsed sidebar
  // In real implementation, you'd use a resize observer or media query hook

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <TopBar
        proposalTitle={solicitation?.title || 'Untitled Proposal'}
        showMobileMenu
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Proposal Tabs */}
      <ProposalTabs
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        contractType={solicitation?.contractType}
        daysUntilDue={daysUntilDue}
      />

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          groups={currentGroups}
          activeItemId={activeView}
          onItemClick={onViewChange}
          collapsed={isTabletCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: 'var(--canvas)' }}
        >
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export { SECTION_GROUPS, SECTION_DEFAULT_VIEWS }
export type { SectionId }
