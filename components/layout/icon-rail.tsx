'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

export interface IconRailItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface IconRailProps {
  items: IconRailItem[]
  activeItemId: string
  onItemClick: (itemId: string) => void
  className?: string
}

export function IconRail({
  items,
  activeItemId,
  onItemClick,
  className,
}: IconRailProps) {
  return (
    <nav
      className={cn(
        'h-full w-[var(--icon-rail-width)] flex flex-col items-center py-3 shrink-0',
        className
      )}
      style={{ backgroundColor: 'var(--ink)' }}
      aria-label="Section navigation"
    >
      <TooltipProvider delayDuration={0}>
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeItemId === item.id

            return (
              <li key={item.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onItemClick(item.id)}
                      className={cn(
                        'w-9 h-9 flex items-center justify-center rounded-md transition-fast',
                        isActive
                          ? 'text-ink'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                      )}
                      style={{
                        backgroundColor: isActive ? 'var(--signal)' : undefined,
                      }}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      </TooltipProvider>
    </nav>
  )
}
