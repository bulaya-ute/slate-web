import { useEffect, useRef, useState } from 'react'
import type { SystemHealth } from '../../lib/api/types'
import { fetchSystemHealth } from './adminApi'
import { HealthPoller } from './healthPolling'

export interface HealthPollingState {
  health: SystemHealth | null
  error: unknown
  /** True only until the first response (success or error) lands. */
  isLoading: boolean
  refresh: () => void
}

/**
 * React binding for `HealthPoller`: fetches `/system/health` immediately
 * on mount, then every `intervalMs` while the tab is visible (Page
 * Visibility API — a hidden tab just skips the scheduled tick rather
 * than accumulating missed calls), and always stops the interval on
 * unmount so nothing leaks.
 */
export function useHealthPolling(intervalMs = 15000): HealthPollingState {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pollerRef = useRef<HealthPoller<SystemHealth> | null>(null)

  useEffect(() => {
    const poller = new HealthPoller<SystemHealth>({
      fetch: fetchSystemHealth,
      onUpdate: (data) => {
        setHealth(data)
        setError(null)
        setIsLoading(false)
      },
      onError: (err) => {
        setError(err)
        setIsLoading(false)
      },
      intervalMs,
      isVisible: () => document.visibilityState === 'visible',
    })
    pollerRef.current = poller
    poller.start()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void poller.refreshNow()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      poller.stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      pollerRef.current = null
    }
  }, [intervalMs])

  return { health, error, isLoading, refresh: () => void pollerRef.current?.refreshNow() }
}
