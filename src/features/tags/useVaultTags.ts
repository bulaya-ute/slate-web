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

export function tagNotesQueryKey(vaultId: string, tag: string) {
  return ['tag-notes', vaultId, tag] as const
}

/** `GET /vaults/{v}/tags/{tag}/notes` — notes for one tag, fetched on-demand as the tags pane drills in. */
export function useTagNotes(vaultId: string | null, tag: string | null) {
  return useQuery({
    queryKey: tagNotesQueryKey(vaultId ?? 'none', tag ?? 'none'),
    queryFn: () => tagsApi.fetchNotesForTag(vaultId as string, tag as string),
    enabled: Boolean(vaultId) && Boolean(tag),
    staleTime: 15_000,
  })
}
