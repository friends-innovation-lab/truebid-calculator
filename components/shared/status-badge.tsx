'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ScenarioStatus = 'draft' | 'approved' | 'superseded' | 'generated'

interface StatusBadgeProps {
  status: ScenarioStatus
  className?: string
}

/**
 * Status badge for pricing scenarios.
 *
 * Per PRINCIPLES.md §4 and wireframe vocabulary:
 * - draft: dashed border, muted color
 * - approved: solid green, human-accepted state
 * - superseded: struck through, muted
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    draft: {
      label: 'Draft',
      className: 'border-dashed border-amber-400 bg-amber-50 text-amber-700',
    },
    approved: {
      label: 'Approved',
      className: 'border-solid border-green-500 bg-green-50 text-green-700',
    },
    superseded: {
      label: 'Superseded',
      className: 'border-solid border-gray-300 bg-gray-50 text-gray-500 line-through',
    },
    generated: {
      label: 'Generated',
      className: 'border-solid border-green-500 bg-green-50 text-green-700',
    },
  }

  const { label, className: statusClassName } = config[status]

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium px-2 py-0.5',
        statusClassName,
        className
      )}
    >
      {label}
    </Badge>
  )
}

export default StatusBadge
