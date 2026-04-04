import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production, or when explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Don't send errors in development unless explicitly enabled
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development' && process.env.SENTRY_ENABLED !== 'true') {
      return null
    }
    return event
  },
})
