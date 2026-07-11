'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, User, Building2, DollarSign, Users, UserPlus, CreditCard, FileText, Library } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface AccountLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Profile', href: '/account/profile', icon: User },
  { name: 'Company', href: '/account/company', icon: Building2 },
  { name: 'Content Library', href: '/account/content-library', icon: Library },
  { name: 'Rates & Margins', href: '/account/rates', icon: DollarSign },
  { name: 'GSA Schedule', href: '/account/gsa', icon: FileText },
  { name: 'Labor Categories', href: '/account/labor', icon: Users },
  { name: 'Team', href: '/account/team', icon: UserPlus, locked: true },
  { name: 'Billing', href: '/account/billing', icon: CreditCard, locked: true },
]

export function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0">
            <h1 className="text-lg font-semibold text-gray-900 mb-6">Settings</h1>
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                
                return (
                  <Link
                    key={item.name}
                    href={item.locked ? '#' : item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-gray-900 text-white'
                        : item.locked
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                    onClick={(e) => {
                      if (item.locked) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                    {item.locked && (
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-5 bg-gray-100 text-gray-500">
                        Soon
                      </Badge>
                    )}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout