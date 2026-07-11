'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="mx-auto max-w-md text-center">
            <h2 className="mb-2 text-2xl font-semibold">
              Something went wrong
            </h2>
            <p className="mb-6 text-gray-600">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => reset()}>Try again</Button>
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
            {error.digest && (
              <p className="mt-4 text-xs text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
