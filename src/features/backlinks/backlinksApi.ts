import { api } from '../../lib/api/client'
import type { Backlink } from '../../lib/api/types'

/** `GET /notes/{id}/backlinks` — notes that link to this one, with a plain-text context snippet. */
export function fetchBacklinks(noteId: string): Promise<Backlink[]> {
  return api.get<Backlink[]>(`/api/notes/${noteId}/backlinks`)
}
