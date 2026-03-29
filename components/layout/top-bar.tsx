'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, LogOut, Settings, LayoutDashboard, Sun, Moon, Monitor } from 'lucide-react'
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

interface TopBarProps {
  /** Current proposal title (if inside a proposal) */
  proposalTitle?: string
  /** Show mobile menu button */
  showMobileMenu?: boolean
  /** Mobile menu open state */
  mobileMenuOpen?: boolean
  /** Toggle mobile menu */
  onMobileMenuToggle?: () => void
}

type Theme = 'light' | 'dark' | 'system'

export function TopBar({
  proposalTitle,
  showMobileMenu = false,
  mobileMenuOpen = false,
  onMobileMenuToggle
}: TopBarProps) {
  const router = useRouter()
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Truncate proposal title
  const truncatedTitle = proposalTitle && proposalTitle.length > 45
    ? proposalTitle.slice(0, 45) + '...'
    : proposalTitle

  return (
    <header
      className="h-[var(--nav-height)] bg-ink sticky top-0 z-50"
      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
    >
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          {showMobileMenu && (
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-1.5 -ml-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-fast"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          )}

          {/* Wordmark */}
          <Wordmark variant="default" />

          {/* Separator + Proposal breadcrumb */}
          {proposalTitle && (
            <>
              {/* Separator line */}
              <div
                className="hidden sm:block w-[0.5px] h-4 bg-white/15"
                aria-hidden="true"
              />

              {/* Breadcrumb */}
              <nav className="hidden sm:flex items-center gap-2 text-sm" aria-label="Breadcrumb">
                <Link
                  href="/dashboard"
                  className="text-[11px] text-white/30 hover:text-white/60 transition-fast"
                >
                  Dashboard
                </Link>
                <span className="text-white/15" aria-hidden="true">/</span>
                <span className="text-[13px] text-white/65 truncate max-w-[280px]">
                  {truncatedTitle}
                </span>
              </nav>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {/* Tools */}
          <Link href="/tools">
            <button className="px-3 py-1.5 text-[12px] text-white/40 hover:text-white/70 transition-fast rounded-md hover:bg-white/5">
              Tools
            </button>
          </Link>

          {/* Help */}
          <button className="px-3 py-1.5 text-[12px] text-white/40 hover:text-white/70 transition-fast rounded-md hover:bg-white/5">
            Help
          </button>

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-2 focus-ring rounded-full"
                aria-label="Account menu"
              >
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
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
