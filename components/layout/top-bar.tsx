'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, LayoutDashboard, Sun, Moon, Monitor } from 'lucide-react'
import { Wordmark } from '@/components/ui/wordmark'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SectionId = 'scope' | 'staff' | 'write' | 'deliver'

interface TopBarProps {
  /** Current active section for phase progress */
  activeSection?: SectionId
  /** Section change handler */
  onSectionChange?: (section: SectionId) => void
  /** Show phase progress nav (proposal context) */
  showPhaseProgress?: boolean
  /** Contract type badge */
  contractType?: string
  /** Called when badge is clicked */
  onContractTypeClick?: () => void
  /** Days until due */
  daysUntilDue?: number | null
}

const PHASES: { id: SectionId; number: string; label: string }[] = [
  { id: 'scope', number: '01', label: 'Scope' },
  { id: 'staff', number: '02', label: 'Staff' },
  { id: 'write', number: '03', label: 'Write' },
  { id: 'deliver', number: '04', label: 'Deliver' },
]

type Theme = 'light' | 'dark' | 'system'

export function TopBar({
  activeSection,
  onSectionChange,
  showPhaseProgress = false,
  contractType,
  daysUntilDue,
  onContractTypeClick,
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

  // Get active phase index for progress indicator
  const activePhaseIndex = PHASES.findIndex(p => p.id === activeSection)

  return (
    <header
      className="h-[var(--nav-height)] sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--canvas)',
        borderBottom: '2px solid var(--ink)',
      }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Wordmark */}
        <div className="flex items-center">
          <Wordmark variant="light" />
        </div>

        {/* Center: Phase Progress Nav */}
        {showPhaseProgress && (
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1" role="tablist" aria-label="Proposal phases">
            {PHASES.map((phase, index) => {
              const isActive = activeSection === phase.id
              const isPast = index < activePhaseIndex

              return (
                <button
                  key={phase.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSectionChange?.(phase.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-fast',
                    isActive
                      ? 'bg-ink text-white font-medium'
                      : isPast
                        ? 'text-text-primary hover:bg-surface-2'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
                  )}
                >
                  <span className={cn(
                    'font-mono text-[10px]',
                    isActive ? 'text-signal' : 'opacity-50'
                  )}>
                    {phase.number}
                  </span>
                  <span>{phase.label}</span>
                </button>
              )
            })}

            {/* Status badges */}
            {(contractType || daysUntilDue !== null && daysUntilDue !== undefined) && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                {contractType && (() => {
                  const labelMap: Record<string, string> = {
                    'tm': 'T&M', 'TM': 'T&M', 'T&M': 'T&M',
                    'ffp': 'FFP', 'FFP': 'FFP',
                    'cpff': 'CPFF', 'CPFF': 'CPFF',
                    'CPAF': 'CPAF', 'IDIQ': 'IDIQ', 'BPA': 'BPA',
                    'hybrid': 'Hybrid', 'GSA': 'GSA',
                  }
                  return (
                    <span
                      onClick={onContractTypeClick}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-surface-2 text-text-secondary"
                      style={{ cursor: onContractTypeClick ? 'pointer' : 'default' }}
                      title="Edit proposal setup"
                    >
                      {labelMap[contractType] || contractType}
                    </span>
                  )
                })()}
                {daysUntilDue !== null && daysUntilDue !== undefined && (
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-medium rounded',
                      daysUntilDue < 0
                        ? 'bg-danger-bg text-danger'
                        : daysUntilDue <= 14
                          ? 'bg-warning-bg text-warning'
                          : 'bg-surface-2 text-text-secondary'
                    )}
                  >
                    {daysUntilDue < 0
                      ? `${Math.abs(daysUntilDue)}d overdue`
                      : `${daysUntilDue}d until due`}
                  </span>
                )}
              </div>
            )}
          </nav>
        )}

        {/* Right: Avatar Menu */}
        <div className="flex items-center gap-3">
          <Link
            href="/tools"
            className="text-[12px] text-text-secondary hover:text-text-primary transition-fast"
          >
            Tools
          </Link>
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
