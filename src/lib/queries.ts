import { useQuery } from '@tanstack/react-query'
import { checkServer } from './api/client'
import { fetchConfig } from './config'

/** `/config.json`, fetched once and cached for the session. */
export function useConfigQuery() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => fetchConfig(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/**
 * Reachability + compatibility + setupRequired for a given server URL.
 * Used by Connect (validation), and by Login/Setup (to gate between
 * the two and to render the server's display name).
 */
export function useServerCheckQuery(url: string | null) {
  return useQuery({
    queryKey: ['server-check', url],
    queryFn: () => checkServer(url as string),
    enabled: Boolean(url),
    retry: false,
    refetchOnWindowFocus: false,
  })
}
