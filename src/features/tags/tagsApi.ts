import { api } from '../../lib/api/client'
import type { TagCount } from '../../lib/api/types'

export function fetchVaultTags(vaultId: string): Promise<TagCount[]> {
  return api.get<TagCount[]>(`/api/vaults/${vaultId}/tags`)
}
