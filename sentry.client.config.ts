import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production, or when explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',

  // Performance monitoring sample rate (0.0 to 1.0)
  // Adjust based on traffic - lower for high-traffic sites
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for debugging user issues
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Don't send errors in development unless explicitly enabled
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development' && process.env.SENTRY_ENABLED !== 'true') {
      return null
    }
    return event
  },

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
