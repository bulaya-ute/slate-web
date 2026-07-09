import { api } from '../../lib/api/client'
import type { GraphResponse } from '../../lib/api/types'

/** `GET /vaults/{v}/graph` — every note as a node (sized by `linkCount`) plus the wikilink edges between them. */
export function fetchGraph(vaultId: string): Promise<GraphResponse> {
  return api.get<GraphResponse>(`/api/vaults/${vaultId}/graph`)
}
