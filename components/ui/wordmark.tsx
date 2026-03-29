'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface WordmarkProps {
  variant?: 'default' | 'large'
  linkTo?: string
  className?: string
}

export function Wordmark({ variant = 'default', linkTo = '/dashboard', className }: WordmarkProps) {
  const content = (
    <div className={cn('flex flex-col leading-none', className)}>
      {variant === 'default' ? (
        <>
          <span className="wordmark-primary text-[14px] text-white tracking-[-0.5px]">
            TrueBid
          </span>
          <span className="wordmark-cursive text-[10px] leading-[1.4]">
            by Friends
          </span>
        </>
      ) : (
        <>
          <span className="wordmark-primary text-[24px] text-ink tracking-[-0.8px]">
            TrueBid
          </span>
          <span className="wordmark-cursive text-[14px] leading-[1.4]">
            by Friends
          </span>
        </>
      )}
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
