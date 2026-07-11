'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Light variant for light backgrounds, dark for dark icon rail */
  variant?: 'light' | 'dark'
  linkTo?: string
  className?: string
}

export function Wordmark({ variant = 'light', linkTo = '/dashboard', className }: WordmarkProps) {
  const isDark = variant === 'dark'

  const content = (
    <div className={cn('flex flex-col leading-none', className)}>
      <span
        className="font-extrabold text-[20px] tracking-[-0.5px]"
        style={{ color: isDark ? '#FFFFFF' : '#111110' }}
      >
        TrueBid
      </span>
      <span
        className="wordmark-cursive text-[11px] leading-[1.3] -mt-[1px]"
        style={{ color: 'var(--signal)' }}
      >
        by Friends
      </span>
    </div>
  )

  if (linkTo) {
    return (
      <Link
        href={linkTo}
        className="focus-ring rounded-sm transition-fast hover:opacity-80"
        aria-label="TrueBid - Go to dashboard"
      >
        {content}
      </Link>
    )
  }

  return content
}
