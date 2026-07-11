import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable in production, or in development when DSN is set
  enabled: process.env.NODE_ENV === 'production' || !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})
