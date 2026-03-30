'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NewProposalModal } from '@/components/new-proposal-modal'
import { LogOut, Settings, Sun, Moon, Monitor, LayoutDashboard, Plus } from 'lucide-react'
import { Wordmark } from '@/components/ui/wordmark'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/account', label: 'Account' },
  { href: '/tools', label: 'Tools' },
]

export function DashboardTopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const [theme, setTheme] = useState<Theme>('system')
  const [userProfile, setUserProfile] = useState({
    name: 'User',
    email: 'user@company.com',
    avatarUrl: '',
  })

  // Load user profile
  useEffect(() => {
    if (user) {
      const emailName = user.email?.split('@')[0] || 'User'
      setUserProfile({
        name: user.user_metadata?.full_name || emailName,
        email: user.email || 'user@company.com',
        avatarUrl: user.user_metadata?.avatar_url || '',
      })
    }
  }, [user])

  // Load theme preference
  useEffect(() => {
    const stored = localStorage.getItem('truebid-theme') as Theme
    if (stored) {
      setTheme(stored)
    }
  }, [])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('truebid-theme', newTheme)

    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else if (newTheme === 'light') {
      root.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const [showNewProposal, setShowNewProposal] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname?.startsWith(href)
  }

  return (
    <header
      className="h-[var(--nav-height)] sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--canvas)',
        borderBottom: '2.5px solid var(--ink)',
      }}
    >
      <div className="h-full px-10 flex items-center justify-between">
        {/* Left side: Wordmark + Nav */}
        <div className="flex items-center">
          <div className="mr-12">
            <Wordmark variant="light" />
          </div>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center h-full" aria-label="Main navigation">
            {NAV_LINKS.map((link) => {
              const isActive = isActiveLink(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'h-full flex items-center px-3.5 text-[13px] border-b-[2.5px] -mb-[2.5px] transition-fast',
                    isActive
                      ? 'font-semibold border-ink'
                      : 'font-normal border-transparent hover:text-text-primary'
                  )}
                  style={{
                    color: isActive ? 'var(--ink)' : 'var(--text-tertiary)',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side: New Proposal + Avatar */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNewProposal(true)}
            className="flex items-center gap-1.5 px-3.5 py-[7px] text-[13px] font-semibold rounded-md transition-fast"
            style={{
              backgroundColor: 'var(--ink)',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1C1C1A'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ink)'}
          >
            <Plus className="w-4 h-4" />
            New Proposal
          </button>
          <NewProposalModal open={showNewProposal} onClose={() => setShowNewProposal(false)} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="focus-ring rounded-full"
                aria-label="Account menu"
              >
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-[30px] h-[30px] rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-extrabold"
                    style={{ backgroundColor: 'var(--signal)', color: 'var(--ink)' }}
                  >
                    {getInitials(userProfile.name)}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {/* User Identity */}
              <div className="px-3 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                      style={{ backgroundColor: 'var(--signal)', color: 'var(--ink)' }}
                    >
                      {getInitials(userProfile.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {userProfile.name}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {userProfile.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="py-1">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator />

              {/* Theme Toggle */}
              <div className="px-2 py-2">
                <p className="text-xs text-text-tertiary px-2 mb-2">Theme</p>
                <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast ${
                      theme === 'light'
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Light
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast ${
                      theme === 'dark'
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast ${
                      theme === 'system'
                        ? 'bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    System
                  </button>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Logout */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-danger focus:text-danger focus:bg-danger-bg"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
