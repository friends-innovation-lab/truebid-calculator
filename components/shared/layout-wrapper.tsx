'use client'

import { usePathname } from 'next/navigation'
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar'
import { Footer } from '@/components/shared/footer'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Auth pages and onboarding - no nav
  const isAuthPage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/onboarding')

  // Proposal pages use their own layout (ProposalLayout via SectionNavigation)
  const isProposalPage = pathname?.match(/^\/[a-f0-9-]{36}/)

  // BOE and collab pages have their own layouts
  const isSpecialPage =
    pathname?.startsWith('/boe/') ||
    pathname?.startsWith('/collab/') ||
    pathname?.startsWith('/collaborate/')

  // Account pages also use their own layout with account-specific nav
  const isAccountPage = pathname?.startsWith('/account')

  // Auth pages, proposal pages, special pages, and account pages get no wrapper
  if (isAuthPage || isProposalPage || isSpecialPage || isAccountPage) {
    return <>{children}</>
  }

  // Dashboard and tools pages get the light top bar
  return (
    <>
      <DashboardTopBar />
      <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--canvas)' }}>
        {children}
      </div>
      <Footer />
    </>
  )
}
