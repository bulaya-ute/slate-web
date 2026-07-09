import { useQuery } from '@tanstack/react-query'
import { fetchGraph } from './graphApi'

export function graphQueryKey(vaultId: string) {
  return ['graph', vaultId] as const
}

export function useGraphQuery(vaultId: string | null) {
  return useQuery({
    queryKey: graphQueryKey(vaultId ?? 'none'),
    queryFn: () => fetchGraph(vaultId as string),
    enabled: Boolean(vaultId),
    staleTime: 30_000,
  })
}
