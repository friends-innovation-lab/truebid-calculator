'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Circle, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GateCondition {
  /** Label displayed for this condition */
  label: string
  /** Whether the condition is currently met */
  met: boolean
  /** Optional detail text explaining the condition */
  detail?: string
  /** Optional href to navigate to fix the issue */
  fixHref?: string
  /** Optional inline resolver component (e.g., a button to fix in place) */
  inlineResolver?: ReactNode
}

interface GateChecklistProps {
  /** List of conditions that must be met before the action can proceed */
  conditions: GateCondition[]
  /** Label for the action button (e.g., "Approve") */
  actionLabel: string
  /** Handler called when the action button is clicked */
  onAction: () => void
  /** Whether the action is currently in progress */
  loading?: boolean
  /** Optional className for the container */
  className?: string
}

/**
 * Gate checklist component per PRINCIPLES.md §3.
 *
 * Gates are announced, never discovered:
 * - Renders live checklist before user acts
 * - Blocked buttons state their count: "Approve — 2 items need resolution"
 * - Never a dead button; never enabled button that errors on click
 * - Each unmet condition shows why it blocks and how to fix it
 */
export function GateChecklist({
  conditions,
  actionLabel,
  onAction,
  loading = false,
  className,
}: GateChecklistProps) {
  const unmetConditions = conditions.filter((c) => !c.met)
  const isBlocked = unmetConditions.length > 0

  // Button label per spec: if blocked, show count
  const buttonLabel = isBlocked
    ? `${actionLabel} — ${unmetConditions.length} item${unmetConditions.length === 1 ? '' : 's'} need${unmetConditions.length === 1 ? 's' : ''} resolution`
    : actionLabel

  return (
    <div className={cn('space-y-4', className)}>
      {/* Checklist */}
      <Card className="p-0 divide-y divide-gray-100">
        {conditions.map((condition, index) => (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3 p-4',
              !condition.met && 'bg-amber-50/50'
            )}
          >
            {/* Status icon */}
            {condition.met ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  condition.met ? 'text-gray-900' : 'text-amber-700'
                )}
              >
                {condition.label}
              </p>
              {condition.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {condition.detail}
                </p>
              )}
            </div>

            {/* Fix action */}
            {!condition.met && (condition.fixHref || condition.inlineResolver) && (
              <div className="shrink-0">
                {condition.inlineResolver ? (
                  condition.inlineResolver
                ) : condition.fixHref ? (
                  <a
                    href={condition.fixHref}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Fix
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Action button */}
      <Button
        onClick={onAction}
        disabled={isBlocked || loading}
        className={cn(
          'w-full',
          isBlocked && 'bg-gray-100 text-gray-500 hover:bg-gray-100 cursor-not-allowed'
        )}
        variant={isBlocked ? 'outline' : 'default'}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  )
}

export default GateChecklist
