import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'outline'
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('border border-dashed rounded-lg py-12 px-8 text-center', className)}>
      <Icon className="w-10 h-10 text-muted-foreground mx-auto" />
      <p className="text-sm font-medium text-foreground mt-3">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {action && (
            <Button variant={action.variant ?? 'default'} size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
