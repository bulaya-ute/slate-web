import { useQuery } from '@tanstack/react-query'
import * as tagsApi from './tagsApi'

export function tagsQueryKey(vaultId: string) {
  return ['tags', vaultId] as const
}

/** `GET /vaults/{v}/tags` — vault-wide tag names + counts (tag pane, `#` autocomplete). */
export function useVaultTags(vaultId: string | null) {
  return useQuery({
    queryKey: tagsQueryKey(vaultId ?? 'none'),
    queryFn: () => tagsApi.fetchVaultTags(vaultId as string),
    enabled: Boolean(vaultId),
    staleTime: 30_000,
  })
}
