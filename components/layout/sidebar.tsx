'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface SidebarItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isPanel?: boolean // Opens as side panel instead of replacing main content
}

export interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

interface SidebarProps {
  groups: SidebarGroup[]
  activeItemId: string
  onItemClick: (itemId: string) => void
  /** Mobile overlay mode */
  mobileOpen?: boolean
  onMobileClose?: () => void
  className?: string
}

export function Sidebar({
  groups,
  activeItemId,
  onItemClick,
  mobileOpen = false,
  onMobileClose,
  className,
}: SidebarProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onMobileClose) {
        onMobileClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, onMobileClose])

  const sidebarContent = (
    <nav
      className={cn(
        'h-full w-[var(--sidebar-width)] overflow-y-auto py-4 shrink-0',
        className
      )}
      style={{
        backgroundColor: 'var(--canvas)',
        borderRight: '0.5px solid var(--border)',
      }}
      aria-label="Section navigation"
    >
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Group label */}
            <p
              className="text-micro px-4 pb-2"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {group.label}
            </p>

            {/* Items */}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeItemId === item.id

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onItemClick(item.id)
                        if (mobileOpen && onMobileClose) {
                          onMobileClose()
                        }
                      }}
                      className={cn(
                        'w-full flex items-center px-4 py-2 text-[13px] transition-fast text-left',
                        isActive
                          ? 'font-medium'
                          : 'hover:bg-surface-2'
                      )}
                      style={{
                        borderLeft: isActive ? '2px solid var(--signal)' : '2px solid transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        backgroundColor: isActive ? 'var(--surface-2)' : undefined,
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )

  // Mobile overlay mode
  if (mobileOpen) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-50 md:hidden">
          {sidebarContent}
        </div>
      </>
    )
  }

  // Desktop sidebar (hidden on mobile unless mobileOpen)
  return (
    <div className="hidden md:block shrink-0">
      {sidebarContent}
    </div>
  )
}
