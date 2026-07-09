import { api } from '../../lib/api/client'
import type { NoteConflicts, ResolveNoteRequest, ResolveNoteResponse } from '../../lib/api/types'

/** `GET /vaults/{v}/conflicts` — every note in the vault with at least one unresolved conflict blob. */
export function fetchVaultConflicts(vaultId: string): Promise<NoteConflicts[]> {
  return api.get<NoteConflicts[]>(`/api/vaults/${vaultId}/conflicts`)
}

/** `GET /conflicts/{revId}/content` — the raw markdown of one conflicting blob. */
export function fetchConflictContent(revId: string): Promise<string> {
  return api.get<string>(`/api/conflicts/${revId}/content`, { parseAs: 'text' })
}

/** `POST /notes/{id}/resolve` — replaces head with merged content and clears the listed conflict revisions. */
export function resolveNote(noteId: string, body: ResolveNoteRequest): Promise<ResolveNoteResponse> {
  return api.post<ResolveNoteResponse>(`/api/notes/${noteId}/resolve`, body)
}
