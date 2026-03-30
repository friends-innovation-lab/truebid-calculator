'use client'

import { useState, useMemo, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { TopBar, SectionId } from './top-bar'
import { IconRail, IconRailItem } from './icon-rail'
import { Sidebar, SidebarGroup } from './sidebar'
import { useAppContext } from '@/contexts/app-context'
import { SetupPanel } from '@/components/proposals/setup-panel'
import {
  FileText,
  Search,
  Layers,
  Grid3X3,
  Users,
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
        { id: 'strategy', label: 'Strategy', icon: Target },
        { id: 'solicitation', label: 'Solicitation', icon: FileText },
        { id: 'requirements', label: 'Requirements', icon: Search },
      ],
    },
  ],
  staff: [
    {
      label: 'Staff',
      items: [
        { id: 'wbs-elements', label: 'Scope of Work', icon: Layers },
        { id: 'roles-pricing', label: 'Roles & Pricing', icon: Users },
        { id: 'team', label: 'Team', icon: Building2 },
        { id: 'labor-loading', label: 'Labor Loading', icon: Grid3X3 },
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

  const params = useParams()
  const proposalId = (params?.id as string) || ''
  const [setupOpen, setSetupOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Bar with Phase Progress */}
      <TopBar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        showPhaseProgress
        contractType={solicitation?.contractType}
        daysUntilDue={daysUntilDue}
        onContractTypeClick={() => setSetupOpen(true)}
      />

      {/* Proposal Setup Panel */}
      <SetupPanel open={setupOpen} onClose={() => setSetupOpen(false)} proposalId={proposalId} />

      {/* Body: Icon Rail + Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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

        {/* Main content - children handle their own scrolling */}
        <main
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
          style={{ backgroundColor: 'var(--surface)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export { SECTION_GROUPS, SECTION_DEFAULT_VIEWS }
export type { SectionId }
