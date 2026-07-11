'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook that provides a fetch function that:
 * 1. Automatically cancels the previous request when a new one is made
 * 2. Cleans up pending requests on component unmount
 *
 * This prevents "state update on unmounted component" warnings and ensures
 * only the most recent request's response is used.
 *
 * Usage:
 * ```tsx
 * const cancellableFetch = useCancellableFetch()
 *
 * useEffect(() => {
 *   cancellableFetch('/api/data')
 *     .then(res => res.json())
 *     .then(data => setData(data))
 *     .catch(err => {
 *       if (err.name !== 'AbortError') console.error(err)
 *     })
 * }, [dependency])
 * ```
 */
export function useCancellableFetch() {
  const controllerRef = useRef<AbortController | null>(null)

  const fetchFn = useCallback(async (
    url: string,
    options?: RequestInit
  ): Promise<Response> => {
    // Cancel any pending request
    if (controllerRef.current) {
      controllerRef.current.abort()
    }

    // Create new controller for this request
    controllerRef.current = new AbortController()

    return fetch(url, {
      ...options,
      signal: controllerRef.current.signal,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort()
      }
    }
  }, [])

  return fetchFn
}

/**
 * Hook that creates an AbortController that is automatically cleaned up on unmount.
 * Useful for custom fetch logic where you need direct access to the controller.
 *
 * Usage:
 * ```tsx
 * const getSignal = useAbortSignal()
 *
 * async function loadData() {
 *   const signal = getSignal()
 *   const res = await fetch('/api/data', { signal })
 *   // ...
 * }
 * ```
 */
export function useAbortSignal() {
  const controllerRef = useRef<AbortController | null>(null)

  const getSignal = useCallback(() => {
    // Abort previous if exists
    if (controllerRef.current) {
      controllerRef.current.abort()
    }
    controllerRef.current = new AbortController()
    return controllerRef.current.signal
  }, [])

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort()
      }
    }
  }, [])

  return getSignal
}

export default useCancellableFetch
