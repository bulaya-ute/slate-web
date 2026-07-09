import { api } from '../../lib/api/client'
import type { SearchResult } from '../../lib/api/types'

/** `GET /vaults/{v}/search?q=` — FTS across the vault; `snippetHtml` carries server-rendered `<mark>` highlights. */
export function searchVault(vaultId: string, query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  return api.get<SearchResult[]>(`/api/vaults/${vaultId}/search?${params.toString()}`)
}
