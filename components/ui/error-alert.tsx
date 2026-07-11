import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message: string
  title?: string
  onRetry?: () => void
  variant?: 'inline' | 'form' | 'page'
}

/**
 * Centralized error display component.
 *
 * Usage guidelines:
 * - **'form'**: Auth errors, form validation, API errors on a specific form.
 *   Renders as a red-tinted alert box with icon.
 * - **'inline'**: Field-level validation below an input.
 *   Renders as small red text with icon, no background.
 * - **'page'**: Upload failures, fatal load errors.
 *   Renders as a centered layout with large icon, title, message, and optional retry.
 * - **toast()**: Use Sonner toast for save success/failure, add/remove operations,
 *   copy actions — not this component.
 */
export function ErrorAlert({
  message,
  title = 'Something went wrong',
  onRetry,
  variant = 'form',
}: ErrorAlertProps) {
  if (variant === 'inline') {
    return (
      <p className="text-sm text-destructive flex items-center gap-1.5" role="alert">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {message}
      </p>
    )
  }

  if (variant === 'page') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center" role="alert">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            Try Again
          </Button>
        )}
      </div>
    )
  }

  // variant === 'form' (default)
  return (
    <div
      className={cn(
        'bg-destructive/10 border border-destructive/20 rounded-lg p-3',
        'flex items-start gap-2',
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  )
}
