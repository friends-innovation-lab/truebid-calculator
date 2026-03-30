'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { useAuth } from '@/contexts/auth-context'
import { migrateLocalStorageToSupabase } from '@/hooks/use-proposal-sync'
import { NewProposalModal } from '@/components/new-proposal-modal'
import { toast } from 'sonner'
import { proposalsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
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
  ChevronRight,
  Trash2,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type ProposalStatus = 'draft' | 'in-review' | 'submitted' | 'won' | 'lost' | 'no-bid'
type ProposalPhase = 'Scope' | 'Staff' | 'Write' | 'Deliver'

interface Proposal {
  id: string
  title: string
  solicitation: string
  client: string
  agency: string
  status: ProposalStatus
  totalValue: number
  dueDate: string | null
  updatedAt: string
  createdAt: string
  teamSize: number
  progress: number
  starred: boolean
  archived: boolean
  contractType: 'tm' | 'ffp' | 'cpff' | 'hybrid'
  periodOfPerformance: string
  role: 'prime' | 'sub' | 'jv'
  phase: ProposalPhase
  complianceGapCount: number
  lowestCoachingScore: number | null
}

interface AttentionItem {
  id: string
  proposalId: string
  proposalTitle: string
  type: 'coaching' | 'compliance' | 'expiring-link' | 'missing-roles' | 'no-bid-decision'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
}

interface ActivityItem {
  id: string
  proposalId: string
  text: string
  timestamp: string
  dotColor: string
}

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
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const getRelativeTime = (dateString: string): string => {
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

const getUrgencyColor = (daysUntilDue: number | null): string => {
  if (daysUntilDue === null) return '#E8E7E2'
  if (daysUntilDue < 30) return '#A32D2D'
  if (daysUntilDue <= 60) return '#BA7517'
  return '#639922'
}

const getSeverityColor = (severity: 'critical' | 'warning' | 'info'): string => {
  switch (severity) {
    case 'critical': return '#A32D2D'
    case 'warning': return '#BA7517'
    case 'info': return '#C4C3BE'
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPOSALS_STORAGE_KEY = 'truebid-proposals'

// ============================================================================
// COMPONENTS
// ============================================================================

// Greeting Section
function Greeting({
  firstName,
  proposalCount,
  mostUrgentProposal,
  pipelineValue,
}: {
  firstName: string
  proposalCount: number
  mostUrgentProposal: string | null
  pipelineValue: number
}) {
  const greeting = getTimeBasedGreeting()

  let subtitle = ''
  if (proposalCount > 0) {
    const parts = []
    parts.push(`${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} in progress`)
    if (mostUrgentProposal) {
      parts.push(`${mostUrgentProposal} is your most urgent`)
    }
    parts.push(`${formatCurrency(pipelineValue)} in pipeline`)
    subtitle = parts.join(' · ')
  }

  return (
    <div className="mb-6">
      <h1
        className="font-extrabold text-[30px] tracking-[-0.8px]"
        style={{ color: 'var(--ink)' }}
      >
        {greeting}, {firstName}.
      </h1>
      {subtitle && (
        <p
          className="text-[14px] mt-[5px]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

// Alert Banner
function AlertBanner({
  title,
  description,
  onFix,
}: {
  title: string
  description: string
  onFix: () => void
}) {
  return (
    <div
      className="flex items-center gap-4 mb-4 rounded-r-lg"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderLeft: '3px solid #A32D2D',
        borderRadius: '0 8px 8px 0',
        padding: '14px 20px',
      }}
    >
      <div className="flex-1 flex items-start gap-3">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: '#A32D2D' }}
        />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
            {title}
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={onFix}
        className="text-[12px] font-bold shrink-0"
        style={{ color: '#A32D2D' }}
      >
        Fix now →
      </button>
    </div>
  )
}

// Attention Card
function AttentionCard({
  item,
  onClick,
}: {
  item: AttentionItem
  onClick: () => void
}) {
  const severityColor = getSeverityColor(item.severity)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 p-3 text-left transition-all"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderLeft: `2px solid ${severityColor}`,
        borderRadius: '8px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#D4D3CE'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E8E7E2'
        e.currentTarget.style.borderLeftColor = severityColor
      }}
    >
      <div
        className="w-[7px] h-[7px] rounded-full shrink-0"
        style={{ backgroundColor: severityColor }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] font-semibold truncate"
          style={{ color: 'var(--ink)' }}
        >
          {item.title}
        </p>
        <p
          className="text-[11px] line-clamp-2"
          style={{ color: 'var(--text-tertiary)', lineHeight: '1.4' }}
        >
          {item.description}
        </p>
      </div>
      <ChevronRight
        className="w-[13px] h-[13px] shrink-0"
        style={{ color: '#D4D3CE' }}
      />
    </button>
  )
}

// Attention Strip
function AttentionStrip({
  items,
  onItemClick,
}: {
  items: AttentionItem[]
  onItemClick: (item: AttentionItem) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-7">
      {items.slice(0, 3).map((item) => (
        <AttentionCard
          key={item.id}
          item={item}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  )
}

// Proposal Card
function ProposalCard({
  proposal,
  onClick,
  onDelete,
}: {
  proposal: Proposal
  onClick: () => void
  onDelete: () => void
}) {
  const daysUntilDue = getDaysUntilDue(proposal.dueDate)
  const urgencyColor = getUrgencyColor(daysUntilDue)
  const isActive = ['draft', 'in-review'].includes(proposal.status)

  // Due date chip styling
  const getDueDateChipStyle = () => {
    if (daysUntilDue === null) return { bg: '#F4F3EF', color: '#6B6A65' }
    if (daysUntilDue < 30) return { bg: '#FAEEDA', color: '#412402' }
    return { bg: '#F4F3EF', color: '#6B6A65' }
  }
  const dueDateStyle = getDueDateChipStyle()

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-all group"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#D4D3CE'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E8E7E2'
      }}
    >
      {/* Top Section */}
      <div className="flex gap-3 p-4 pb-3">
        {/* Urgency Bar */}
        <div
          className="w-[3px] rounded-sm shrink-0 self-stretch"
          style={{ backgroundColor: urgencyColor }}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-[15px] font-bold tracking-[-0.2px] leading-[1.3] line-clamp-2 mb-1"
            style={{ color: 'var(--ink)' }}
          >
            {proposal.title}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              {proposal.agency || proposal.client}
            </span>
            {proposal.contractType && (
              <>
                <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  {proposal.contractType.toUpperCase()}
                </span>
              </>
            )}
            {proposal.role && (
              <span
                className="text-[11px] font-semibold px-1.5 py-[1px] rounded-[3px]"
                style={{ backgroundColor: '#F4F3EF', color: 'var(--text-secondary)' }}
              >
                {proposal.role === 'prime' ? 'Prime' : proposal.role === 'sub' ? 'Sub' : 'JV'}
              </span>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
            aria-label="Delete proposal"
            title="Delete proposal"
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: '#C4C3BE' }} />
          </button>
          {proposal.dueDate && isActive && (
            <span
              className="text-[11px] font-semibold px-2 py-[3px] rounded-[3px]"
              style={{ backgroundColor: dueDateStyle.bg, color: dueDateStyle.color }}
            >
              {daysUntilDue !== null && daysUntilDue >= 0
                ? `${daysUntilDue}d`
                : daysUntilDue !== null
                  ? 'Overdue'
                  : new Date(proposal.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            </span>
          )}
          <span className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(proposal.totalValue)}
          </span>
        </div>
      </div>

      {/* Bottom Section */}
      {isActive && (
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{
            borderTop: '0.5px solid #F4F3EF',
            paddingLeft: '35px', // Aligns with content above bar
          }}
        >
          <span
            className="text-[11px] shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {proposal.phase || 'Scope'}
          </span>

          {/* Progress Bar */}
          <div className="flex-1 flex items-center gap-2">
            <div
              className="flex-1 h-[3px] rounded-sm"
              style={{ backgroundColor: '#F0EDE6' }}
            >
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${proposal.progress}%`,
                  backgroundColor: isActive ? '#F5C200' : '#E8E7E2',
                }}
              />
            </div>
            <span
              className="text-[11px] shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {proposal.progress}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Win Rate Panel
function WinRatePanel({
  winRate,
  won,
  lost,
  noAward,
}: {
  winRate: number | null
  won: number
  lost: number
  noAward: number
}) {
  const total = won + lost
  const rate = total > 0 ? Math.round((won / total) * 100) : null

  return (
    <div
      className="p-[18px_20px]"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: '10px',
      }}
    >
      <h3
        className="text-[12px] font-bold tracking-[-0.1px] mb-3.5"
        style={{ color: 'var(--ink)' }}
      >
        Win Rate
      </h3>

      {rate !== null ? (
        <>
          <p
            className="text-[44px] font-extrabold tracking-[-2px] leading-none"
            style={{ color: 'var(--ink)' }}
          >
            {rate}%
          </p>
          <p
            className="text-[11px] uppercase tracking-[1px] mt-[3px] mb-3.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {won} of {total} awarded
          </p>

          {/* Progress bar */}
          <div
            className="h-[5px] rounded-[3px] mb-3"
            style={{ backgroundColor: '#F0EDE6' }}
          >
            <div
              className="h-full rounded-[3px]"
              style={{ width: `${rate}%`, backgroundColor: '#F5C200' }}
            />
          </div>

          {/* Won / Lost / N/A row */}
          <div className="flex justify-between">
            <div>
              <p
                className="text-[17px] font-extrabold"
                style={{ color: '#639922' }}
              >
                {won}
              </p>
              <p
                className="text-[9px] uppercase tracking-[1px]"
                style={{ color: '#C4C3BE' }}
              >
                Won
              </p>
            </div>
            <div>
              <p
                className="text-[17px] font-extrabold"
                style={{ color: '#A32D2D' }}
              >
                {lost}
              </p>
              <p
                className="text-[9px] uppercase tracking-[1px]"
                style={{ color: '#C4C3BE' }}
              >
                Lost
              </p>
            </div>
            <div>
              <p
                className="text-[17px] font-extrabold"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {noAward}
              </p>
              <p
                className="text-[9px] uppercase tracking-[1px]"
                style={{ color: '#C4C3BE' }}
              >
                N/A
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p
            className="text-[44px] font-extrabold tracking-[-2px] leading-none"
            style={{ color: 'var(--text-disabled)' }}
          >
            --
          </p>
          <p
            className="text-[11px] mt-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Coming soon
          </p>
        </div>
      )}
    </div>
  )
}

// Pipeline Panel
function PipelinePanel({
  tracking,
  pursuing,
  submitted,
  wonYtd,
}: {
  tracking: { count: number; value: number }
  pursuing: { count: number; value: number }
  submitted: { count: number; value: number }
  wonYtd: { count: number; value: number }
}) {
  const rows = [
    { label: 'Tracking', dot: '#C4C3BE', ...tracking },
    { label: 'Pursuing', dot: '#BA7517', ...pursuing },
    { label: 'Submitted', dot: '#185FA5', ...submitted },
    { label: 'Won YTD', dot: '#639922', ...wonYtd },
  ]

  return (
    <div
      className="p-[18px_20px]"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: '10px',
      }}
    >
      <h3
        className="text-[12px] font-bold tracking-[-0.1px] mb-3.5"
        style={{ color: 'var(--ink)' }}
      >
        Pipeline
      </h3>

      {rows.map((row, i) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-[7px]"
          style={{
            borderBottom: i < rows.length - 1 ? '0.5px solid #F4F3EF' : 'none',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: row.dot }}
            />
            <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {row.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-bold"
              style={{ color: 'var(--ink)' }}
            >
              {row.count}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {formatCurrency(row.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Recent Activity Panel
function RecentActivityPanel({
  activities,
}: {
  activities: ActivityItem[]
}) {
  return (
    <div
      className="p-[18px_20px]"
      style={{
        backgroundColor: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: '10px',
      }}
    >
      <h3
        className="text-[12px] font-bold tracking-[-0.1px] mb-3.5"
        style={{ color: 'var(--ink)' }}
      >
        Recent Activity
      </h3>

      {activities.length === 0 ? (
        <p className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
          No recent activity
        </p>
      ) : (
        activities.slice(0, 4).map((activity, i) => (
          <div
            key={activity.id}
            className="flex gap-2.5 py-1.5"
            style={{
              borderBottom: i < Math.min(activities.length, 4) - 1 ? '0.5px solid #F4F3EF' : 'none',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: activity.dotColor }}
            />
            <div>
              <p
                className="text-[12px] leading-[1.4]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {activity.text}
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: '#C4C3BE' }}
              >
                {getRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export function Dashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const { setActiveUtilityTool } = useAppContext()

  // Core state
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null)

  // Load proposals from API
  useEffect(() => {
    async function loadProposals() {
      try {
        const response = await proposalsApi.list() as { proposals: Record<string, unknown>[] }
        // Transform API response to match our Proposal interface
        const transformed = (response.proposals || []).map((p) => ({
          id: p.id as string,
          title: p.title as string,
          solicitation: (p.solicitation as string) || '',
          client: (p.client as string) || '',
          agency: (p.agency as string) || (p.client as string) || '',
          status: (p.status as ProposalStatus) || 'draft',
          totalValue: (p.totalValue as number) || 0,
          dueDate: (p.dueDate as string) || null,
          updatedAt: (p.updatedAt as string) || new Date().toISOString(),
          createdAt: (p.createdAt as string) || new Date().toISOString(),
          teamSize: (p.teamSize as number) || 0,
          progress: (p.progress as number) || 0,
          starred: (p.starred as boolean) || false,
          archived: (p.archived as boolean) || false,
          contractType: (p.contractType as 'tm' | 'ffp' | 'cpff' | 'hybrid') || 'tm',
          periodOfPerformance: (p.periodOfPerformance as string) || '',
          role: (p.role as 'prime' | 'sub' | 'jv') || 'prime',
          phase: (p.phase as ProposalPhase) || 'Scope',
          complianceGapCount: (p.complianceGapCount as number) || 0,
          lowestCoachingScore: (p.lowestCoachingScore as number) || null,
        })) as Proposal[]
        setProposals(transformed)
      } catch (error) {
        console.error('Failed to load proposals from API:', error)
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

      migrateLocalStorageToSupabase().catch(e =>
        console.warn('[Dashboard] localStorage migration failed:', e)
      )

      setIsLoaded(true)
    }

    loadProposals()
  }, [])

  // Cache proposals to localStorage
  useEffect(() => {
    if (isLoaded && proposals.length > 0) {
      localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(proposals))
    }
  }, [proposals, isLoaded])

  // Get first name from user
  const firstName = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0]
    }
    if (user?.email) {
      return user.email.split('@')[0]
    }
    return 'there'
  }, [user])

  // Active proposals (not archived, in progress)
  const activeProposals = useMemo(() => {
    return proposals.filter(p => !p.archived && ['draft', 'in-review'].includes(p.status))
  }, [proposals])

  // Most urgent proposal
  const mostUrgentProposal = useMemo(() => {
    const withDates = activeProposals.filter(p => p.dueDate)
    if (withDates.length === 0) return null

    const sorted = [...withDates].sort((a, b) => {
      const daysA = getDaysUntilDue(a.dueDate)
      const daysB = getDaysUntilDue(b.dueDate)
      if (daysA === null) return 1
      if (daysB === null) return -1
      return daysA - daysB
    })

    return sorted[0]?.title || null
  }, [activeProposals])

  // Pipeline value
  const pipelineValue = useMemo(() => {
    return activeProposals.reduce((sum, p) => sum + (p.totalValue || 0), 0)
  }, [activeProposals])

  // Attention items
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = []

    // Check for coaching scores below 2.5
    activeProposals.forEach(p => {
      if (p.lowestCoachingScore !== null && p.lowestCoachingScore < 2.5) {
        items.push({
          id: `coaching-${p.id}`,
          proposalId: p.id,
          proposalTitle: p.title,
          type: 'coaching',
          severity: p.lowestCoachingScore < 2.0 ? 'critical' : 'warning',
          title: `Low coaching score on ${p.title}`,
          description: `Coaching score is ${p.lowestCoachingScore.toFixed(1)} — review feedback and improve sections.`,
        })
      }
    })

    // Check for compliance gaps
    activeProposals.forEach(p => {
      if (p.complianceGapCount > 0) {
        items.push({
          id: `compliance-${p.id}`,
          proposalId: p.id,
          proposalTitle: p.title,
          type: 'compliance',
          severity: 'critical',
          title: `${p.complianceGapCount} compliance gap${p.complianceGapCount !== 1 ? 's' : ''} on ${p.title}`,
          description: 'Requirements are not linked to WBS elements.',
        })
      }
    })

    // Sort by severity
    return items.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }, [activeProposals])

  // Alert (most urgent issue)
  const alertItem = useMemo(() => {
    // Check for past due proposals
    const pastDue = activeProposals.find(p => {
      const days = getDaysUntilDue(p.dueDate)
      return days !== null && days < 0
    })
    if (pastDue) {
      return {
        title: `${pastDue.title} is past due`,
        description: 'This proposal missed its deadline. Update status or extend the due date.',
        proposalId: pastDue.id,
      }
    }

    // Check for compliance gaps
    const withGaps = activeProposals.find(p => p.complianceGapCount > 0)
    if (withGaps) {
      return {
        title: `${withGaps.complianceGapCount} unlinked requirement${withGaps.complianceGapCount !== 1 ? 's' : ''} on ${withGaps.title}`,
        description: 'Link requirements to WBS elements to ensure compliance.',
        proposalId: withGaps.id,
      }
    }

    return null
  }, [activeProposals])

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    const tracking = proposals.filter(p => !p.archived && p.status === 'draft' && p.progress < 20)
    const pursuing = proposals.filter(p => !p.archived && ['draft', 'in-review'].includes(p.status) && p.progress >= 20)
    const submitted = proposals.filter(p => !p.archived && p.status === 'submitted')
    const wonYtd = proposals.filter(p => {
      if (p.status !== 'won') return false
      const updated = new Date(p.updatedAt)
      const thisYear = new Date().getFullYear()
      return updated.getFullYear() === thisYear
    })

    return {
      tracking: {
        count: tracking.length,
        value: tracking.reduce((sum, p) => sum + (p.totalValue || 0), 0),
      },
      pursuing: {
        count: pursuing.length,
        value: pursuing.reduce((sum, p) => sum + (p.totalValue || 0), 0),
      },
      submitted: {
        count: submitted.length,
        value: submitted.reduce((sum, p) => sum + (p.totalValue || 0), 0),
      },
      wonYtd: {
        count: wonYtd.length,
        value: wonYtd.reduce((sum, p) => sum + (p.totalValue || 0), 0),
      },
    }
  }, [proposals])

  // Win/loss stats
  const winLossStats = useMemo(() => {
    const won = proposals.filter(p => p.status === 'won').length
    const lost = proposals.filter(p => p.status === 'lost').length
    const noAward = proposals.filter(p => p.status === 'no-bid').length
    return { won, lost, noAward }
  }, [proposals])

  // Recent activity (mock for now - would come from API)
  const recentActivity: ActivityItem[] = useMemo(() => {
    // Generate from recent proposal updates
    return activeProposals
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
      .map(p => ({
        id: `activity-${p.id}`,
        proposalId: p.id,
        text: `${p.title} was updated`,
        timestamp: p.updatedAt,
        dotColor: '#185FA5',
      }))
  }, [activeProposals])

  // Handlers
  const [showNewProposalModal, setShowNewProposalModal] = useState(false)
  const handleNewProposal = () => {
    setActiveUtilityTool(null)
    setShowNewProposalModal(true)
  }

  const handleOpenProposal = (proposalId: string) => {
    setActiveUtilityTool(null)
    router.push(`/${proposalId}?tab=estimate`)
  }

  const handleAttentionClick = (item: AttentionItem) => {
    router.push(`/${item.proposalId}?tab=estimate`)
  }

  const handleAlertFix = (proposalId: string) => {
    router.push(`/${proposalId}?tab=estimate`)
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div
        className="min-h-screen py-9 px-10"
        style={{ backgroundColor: 'var(--canvas)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          {/* Skeleton greeting */}
          <div className="mb-6">
            <div className="h-9 w-64 bg-surface-2 rounded animate-pulse mb-2" />
            <div className="h-5 w-96 bg-surface-2 rounded animate-pulse" />
          </div>

          {/* Skeleton attention strip */}
          <div className="grid grid-cols-3 gap-2 mb-7">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-surface-2 rounded-lg animate-pulse" />
            ))}
          </div>

          {/* Skeleton content */}
          <div className="flex gap-6">
            <div className="flex-1 space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-surface-2 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="w-[300px] space-y-3">
              <div className="h-48 bg-surface-2 rounded-lg animate-pulse" />
              <div className="h-48 bg-surface-2 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (proposals.length === 0) {
    return (
      <div
        className="min-h-screen py-9 px-10"
        style={{ backgroundColor: 'var(--canvas)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          {/* Greeting with empty subtitle */}
          <div className="mb-6">
            <h1 className="font-extrabold text-[30px] tracking-[-0.8px]" style={{ color: 'var(--ink)' }}>
              {getTimeBasedGreeting()}, {firstName}.
            </h1>
            <p className="text-[14px] mt-[5px]" style={{ color: '#6B6A65' }}>
              Ready to start your first proposal?
            </p>
          </div>

          {/* Empty state */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F4F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FileText size={22} color="#C4C3BE" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111110', letterSpacing: '-0.2px', marginBottom: 6 }}>
              No proposals yet
            </div>
            <div style={{ fontSize: 13, color: '#6B6A65', lineHeight: 1.6, maxWidth: 280, marginBottom: 24 }}>
              Create your first proposal to get started. Upload an RFP and TrueBid will extract requirements, build your WBS, and help you write a winning response.
            </div>
            <button
              onClick={handleNewProposal}
              style={{ background: '#111110', color: '#FFFFFF', fontSize: 13, fontWeight: 600, padding: '9px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', letterSpacing: '-0.1px' }}
            >
              + New Proposal
            </button>
          </div>
        </div>

        <NewProposalModal open={showNewProposalModal} onClose={() => setShowNewProposalModal(false)} />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen py-9 px-10 md:px-10"
      style={{ backgroundColor: 'var(--canvas)' }}
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Greeting */}
        <Greeting
          firstName={firstName}
          proposalCount={activeProposals.length}
          mostUrgentProposal={mostUrgentProposal}
          pipelineValue={pipelineValue}
        />

        {/* Alert Banner — hide when no active proposals */}
        {alertItem && activeProposals.length > 0 && (
          <AlertBanner
            title={alertItem.title}
            description={alertItem.description}
            onFix={() => handleAlertFix(alertItem.proposalId)}
          />
        )}

        {/* Attention Strip — hide when no active proposals */}
        {activeProposals.length > 0 && (
          <AttentionStrip
            items={attentionItems}
            onItemClick={handleAttentionClick}
          />
        )}

        {/* Two-column layout */}
        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Proposals Column */}
          <div className="flex-1">
            {activeProposals.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F4F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FileText size={22} color="#C4C3BE" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111110', letterSpacing: '-0.2px', marginBottom: 6 }}>
                  No active proposals
                </div>
                <div style={{ fontSize: 13, color: '#6B6A65', lineHeight: 1.6, maxWidth: 280, marginBottom: 24 }}>
                  Create your first proposal to get started. Upload an RFP and TrueBid will extract requirements, build your WBS, and help you write a winning response.
                </div>
                <button
                  onClick={handleNewProposal}
                  style={{ background: '#111110', color: '#FFFFFF', fontSize: 13, fontWeight: 600, padding: '9px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', letterSpacing: '-0.1px' }}
                >
                  + New Proposal
                </button>
              </div>
            ) : (
              <>
                <p
                  className="text-[10px] font-bold tracking-[2px] uppercase mb-2.5"
                  style={{ color: '#C4C3BE' }}
                >
                  Active proposals
                </p>
                <div className="flex flex-col gap-2">
                  {activeProposals.map(proposal => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onClick={() => handleOpenProposal(proposal.id)}
                      onDelete={() => setProposalToDelete(proposal.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right Panel — hide when no active proposals */}
          {activeProposals.length > 0 && <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-3">
            <WinRatePanel
              winRate={null}
              won={winLossStats.won}
              lost={winLossStats.lost}
              noAward={winLossStats.noAward}
            />

            <PipelinePanel
              tracking={pipelineStats.tracking}
              pursuing={pipelineStats.pursuing}
              submitted={pipelineStats.submitted}
              wonYtd={pipelineStats.wonYtd}
            />

            <RecentActivityPanel activities={recentActivity} />
          </div>}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!proposalToDelete} onOpenChange={(open) => { if (!open) setProposalToDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this proposal?</DialogTitle>
            <DialogDescription>
              This will permanently delete the proposal and all its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProposalToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (proposalToDelete) {
                  try {
                    await proposalsApi.delete(proposalToDelete)
                    setProposals(prev => prev.filter(p => p.id !== proposalToDelete))
                    toast.success('Proposal deleted')
                  } catch {
                    toast.error('Failed to delete proposal')
                  }
                }
                setProposalToDelete(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewProposalModal open={showNewProposalModal} onClose={() => setShowNewProposalModal(false)} />
    </div>
  )
}

export default Dashboard
