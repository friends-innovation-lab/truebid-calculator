import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { AppProvider } from '@/contexts/app-context'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/components/shared/theme-provider'
import { LayoutWrapper } from '@/components/shared/layout-wrapper'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'TrueBid - Government Contracting Calculator',
  description: 'AI-powered bid analysis and pricing tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.className} min-h-screen flex flex-col`}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AppProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </AppProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}