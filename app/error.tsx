'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report error to Sentry
    Sentry.captureException(error)
    // Also log to console in development
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mb-6 text-muted-foreground">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
