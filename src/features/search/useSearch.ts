import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import * as searchApi from './searchApi'

const DEBOUNCE_MS = 250

export function searchQueryKey(vaultId: string, query: string) {
  return ['search', vaultId, query] as const
}

/**
 * Debounces the raw input value before it ever becomes a query key, so
 * keystrokes don't each fire their own request — only once typing
 * pauses for `DEBOUNCE_MS`. `isDebouncing` lets the pane show a loading
 * state during that pause too (not just while the network request is
 * in flight), so the UI never looks "stuck" between keystrokes and the
 * eventual fetch.
 */
export function useSearch(vaultId: string | null, rawQuery: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rawQuery])

  const trimmed = debouncedQuery.trim()
  const isDebouncing = rawQuery !== debouncedQuery

  const query = useQuery({
    queryKey: searchQueryKey(vaultId ?? 'none', trimmed),
    queryFn: () => searchApi.searchVault(vaultId as string, trimmed),
    enabled: Boolean(vaultId) && trimmed.length > 0,
    staleTime: 10_000,
  })

  return { ...query, trimmedQuery: trimmed, isDebouncing }
}
