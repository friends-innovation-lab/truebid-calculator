'use client'

import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean
}

/**
 * Hook to detect online/offline network status.
 *
 * Returns:
 * - isOnline: Current network status
 * - wasOffline: True if the user was offline at some point in this session
 *               (useful for showing "reconnected" messages)
 *
 * Usage:
 * ```tsx
 * const { isOnline, wasOffline } = useNetworkStatus()
 *
 * if (!isOnline) {
 *   return <OfflineBanner />
 * }
 *
 * if (wasOffline && isOnline) {
 *   return <ReconnectedToast />
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() => {
    // Default to online for SSR
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  const [wasOffline, setWasOffline] = useState(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setWasOffline(true)
  }, [])

  useEffect(() => {
    // Initialize with actual value on mount
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return { isOnline, wasOffline }
}

export default useNetworkStatus
