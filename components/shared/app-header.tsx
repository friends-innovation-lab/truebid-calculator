'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HelpCircle,
  Wrench,
  LogOut,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

export function AppHeader() {
  const router = useRouter()
  const { companyProfile } = useAppContext()
  const { user } = useAuth()

  const [theme, setTheme] = useState<Theme>('system')
  const [userProfile, setUserProfile] = useState({
    name: 'User',
    email: 'user@company.com',
    avatarUrl: '',
  })

  const companyName = companyProfile?.name || 'TrueBid'

  // Load user profile - prefer Supabase user, fall back to localStorage
  useEffect(() => {
    if (user) {
      // Use authenticated user's email
      const emailName = user.email?.split('@')[0] || 'User'
      setUserProfile({
        name: user.user_metadata?.full_name || emailName,
        email: user.email || 'user@company.com',
        avatarUrl: user.user_metadata?.avatar_url || '',
      })
    } else {
      // Fall back to localStorage
      const stored = localStorage.getItem('truebid-company-profile')
      if (stored) {
        const data = JSON.parse(stored)
        setUserProfile({
          name: data.userName || 'User',
          email: data.userEmail || 'user@company.com',
          avatarUrl: data.avatarUrl || '',
        })
      }
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
    
    // Apply theme to document
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else if (newTheme === 'light') {
      root.classList.remove('dark')
    } else {
      // System preference
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

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="h-14 bg-slate-900 border-b-2 border-emerald-500 sticky top-0 z-50">
      <div className="h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Left: Logo + Breadcrumb */}
        <div className="flex items-center gap-3">
          {/* TrueBid Logo */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-all shadow-sm"
            aria-label="Go to dashboard"
          >
            <span className="text-white font-bold text-sm">T</span>
          </Link>

          {/* Separator */}
          <span className="text-slate-600 text-lg font-light">/</span>

          {/* Company Name */}
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white hover:text-slate-300 transition-colors"
          >
            {companyName}
          </Link>
        </div>

        {/* Right: Tools, Help, User Menu */}
        <div className="flex items-center gap-2">
          {/* Tools Link */}
          <Link href="/tools">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Tools</span>
            </Button>
          </Link>

          {/* Help */}
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800">
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help</span>
          </Button>

          {/* User Menu (Avatar) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-emerald-500 transition-all" aria-label="Account menu">
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-medium">
                    {getInitials(userProfile.name)}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {/* User Identity */}
              <div className="px-3 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-medium">
                      {getInitials(userProfile.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {userProfile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mb-2">Theme</p>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === 'light' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Light
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === 'dark' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === 'system' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
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

export default AppHeader