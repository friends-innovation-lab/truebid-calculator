'use client'

import { useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

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
  /** Collapsed mode (icons only) */
  collapsed?: boolean
  /** Mobile overlay mode */
  mobileOpen?: boolean
  onMobileClose?: () => void
  className?: string
}

export function Sidebar({
  groups,
  activeItemId,
  onItemClick,
  collapsed = false,
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
        'h-full bg-ink overflow-y-auto pt-2',
        collapsed ? 'w-12' : 'w-[var(--sidebar-width)]',
        className
      )}
      style={{ borderRight: '0.5px solid rgba(255,255,255,0.06)' }}
      aria-label="Section navigation"
    >
      <TooltipProvider delayDuration={0}>
        <div className="space-y-4 px-1">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              {!collapsed && (
                <p
                  className="text-micro px-3 py-2"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  {group.label}
                </p>
              )}

              {/* Items */}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeItemId === item.id

                  const button = (
                    <button
                      onClick={() => {
                        onItemClick(item.id)
                        if (mobileOpen && onMobileClose) {
                          onMobileClose()
                        }
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md transition-fast',
                        collapsed ? 'px-3 py-2 justify-center' : 'px-3 py-[7px] mx-1',
                        isActive
                          ? 'font-medium'
                          : 'hover:bg-white/5'
                      )}
                      style={{
                        backgroundColor: isActive ? 'rgba(245,194,0,0.10)' : undefined,
                        color: isActive ? 'var(--signal)' : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="text-[12px] truncate flex-1 text-left">
                            {item.label}
                          </span>
                          {item.isPanel && (
                            <ChevronRight
                              className="w-3.5 h-3.5 shrink-0 text-white/20"
                            />
                          )}
                        </>
                      )}
                    </button>
                  )

                  // Wrap in tooltip when collapsed
                  if (collapsed) {
                    return (
                      <li key={item.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {button}
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    )
                  }

                  return <li key={item.id}>{button}</li>
                })}
              </ul>
            </div>
          ))}
        </div>
      </TooltipProvider>
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
