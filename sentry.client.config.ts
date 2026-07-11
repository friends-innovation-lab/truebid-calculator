import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Enable in production, or in development when SENTRY_DEBUG is set
  enabled: process.env.NODE_ENV === 'production' || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate (0.0 to 1.0)
  // Adjust based on traffic - lower for high-traffic sites
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for debugging user issues
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
