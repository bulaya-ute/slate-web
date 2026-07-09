import { api } from '../../lib/api/client'
import type { TagCount, TagNoteEntry } from '../../lib/api/types'

export function fetchVaultTags(vaultId: string): Promise<TagCount[]> {
  return api.get<TagCount[]>(`/api/vaults/${vaultId}/tags`)
}

/** `GET /vaults/{v}/tags/{tag}/notes` — notes carrying a given tag (tags pane drill-down). */
export function fetchNotesForTag(vaultId: string, tag: string): Promise<TagNoteEntry[]> {
  return api.get<TagNoteEntry[]>(`/api/vaults/${vaultId}/tags/${encodeURIComponent(tag)}/notes`)
}
