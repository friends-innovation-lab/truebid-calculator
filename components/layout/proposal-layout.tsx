'use client'

import { useState, useMemo, ReactNode } from 'react'
import { TopBar, SectionId } from './top-bar'
import { IconRail, IconRailItem } from './icon-rail'
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
  FileDown,
  Link2,
  PenLine,
  Target,
  Eye,
} from 'lucide-react'

// Icon rail items for each section
const SECTION_ICONS: IconRailItem[] = [
  { id: 'scope', label: 'Scope', icon: Target },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'write', label: 'Write', icon: PenLine },
  { id: 'deliver', label: 'Deliver', icon: FileDown },
]

// Section configurations
const SECTION_GROUPS: Record<SectionId, SidebarGroup[]> = {
  scope: [
    {
      label: 'Scope',
      items: [
        { id: 'solicitation', label: 'Solicitation', icon: FileText },
        { id: 'strategy', label: 'Strategy', icon: Target },
        { id: 'requirements', label: 'Requirements', icon: Search },
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
        { id: 'proposal-status', label: 'Proposal Status', icon: Eye },
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
  scope: 'solicitation',
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

  // Handle icon rail click
  const handleIconRailClick = (sectionId: string) => {
    handleSectionChange(sectionId as SectionId)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar with Phase Progress */}
      <TopBar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        showPhaseProgress
        contractType={solicitation?.contractType}
        daysUntilDue={daysUntilDue}
      />

      {/* Body: Icon Rail + Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Icon Rail (dark, left) */}
        <IconRail
          items={SECTION_ICONS}
          activeItemId={activeSection}
          onItemClick={handleIconRailClick}
        />

        {/* Content Sidebar (light) */}
        <Sidebar
          groups={currentGroups}
          activeItemId={activeView}
          onItemClick={onViewChange}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface)' }}
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
