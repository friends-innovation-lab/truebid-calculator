'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export type SectionId = 'scope' | 'staff' | 'write' | 'deliver'

interface ProposalTabsProps {
  activeSection: SectionId
  onSectionChange: (section: SectionId) => void
  /** Contract type (T&M, FFP, CPFF, etc.) */
  contractType?: string
  /** Days until due (negative = overdue) */
  daysUntilDue?: number | null
  /** Status label override */
  statusLabel?: string
}

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'staff', label: 'Staff' },
  { id: 'write', label: 'Write' },
  { id: 'deliver', label: 'Deliver' },
]

export function ProposalTabs({
  activeSection,
  onSectionChange,
  contractType,
  daysUntilDue,
  statusLabel,
}: ProposalTabsProps) {
  // Compute status badge
  const statusBadge = useMemo(() => {
    if (statusLabel) {
      return { label: statusLabel, variant: 'default' as const }
    }
    if (daysUntilDue === null || daysUntilDue === undefined) {
      return null
    }
    if (daysUntilDue < 0) {
      return {
        label: `${Math.abs(daysUntilDue)}d overdue`,
        variant: 'danger' as const,
      }
    }
    if (daysUntilDue <= 14) {
      return {
        label: `${daysUntilDue}d until due`,
        variant: 'warning' as const,
      }
    }
    return {
      label: `${daysUntilDue}d until due`,
      variant: 'default' as const,
    }
  }, [daysUntilDue, statusLabel])

  return (
    <div
      className="h-[var(--tabs-height)] bg-ink px-6 flex items-end justify-between"
      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
    >
      {/* Tabs */}
      <nav className="flex h-full" role="tablist" aria-label="Proposal sections">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                'px-4 h-full flex items-center text-[12px] border-b-2 transition-fast',
                isActive
                  ? 'text-white font-medium border-signal'
                  : 'text-white/35 font-normal border-transparent hover:text-white/60'
              )}
            >
              {section.label}
            </button>
          )
        })}
      </nav>

      {/* Right side: badges */}
      <div className="flex items-center gap-2 pb-2">
        {/* Contract type badge */}
        {contractType && (
          <span
            className="px-2 py-0.5 text-[11px] font-medium rounded"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {contractType}
          </span>
        )}

        {/* Status badge */}
        {statusBadge && (
          <span
            className={cn(
              'px-2 py-0.5 text-[11px] font-medium rounded',
              statusBadge.variant === 'danger' && 'bg-danger/20 text-danger-border',
              statusBadge.variant === 'warning' && 'bg-warning/20 text-warning-border',
              statusBadge.variant === 'default' && 'bg-white/8 text-white/60'
            )}
          >
            {statusBadge.label}
          </span>
        )}
      </div>
    </div>
  )
}
