'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type SaveStatusValue = 'idle' | 'saving' | 'saved' | 'error'

interface SaveStatusProps {
  status: SaveStatusValue
  className?: string
}

export function SaveStatus({ status, className }: SaveStatusProps) {
  const [visible, setVisible] = useState(status)

  useEffect(() => {
    setVisible(status)

    if (status === 'saved') {
      const timer = setTimeout(() => setVisible('idle'), 2500)
      return () => clearTimeout(timer)
    }
  }, [status])

  if (visible === 'idle') return null

  return (
    <div className={cn('flex items-center gap-1.5 animate-in fade-in duration-200', className)}>
      {visible === 'saving' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Saving...</span>
        </>
      )}
      {visible === 'saved' && (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs text-muted-foreground">Saved</span>
        </>
      )}
      {visible === 'error' && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs text-destructive">Save failed</span>
        </>
      )}
    </div>
  )
}
