'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ProposalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { component: 'proposal' } })
    console.error('[Proposal Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Error loading proposal
        </h2>
        <p className="mb-6 text-muted-foreground">
          {error.message || 'Failed to load proposal data. Please try again.'}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => reset()}>Retry</Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            Back to Dashboard
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
