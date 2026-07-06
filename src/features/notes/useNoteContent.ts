import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'

export function noteContentQueryKey(noteId: string) {
  return ['note-content', noteId] as const
}

/**
 * `GET /notes/{id}/content` — raw markdown text. This is the "raw content
 * fetch is fine" placeholder read path; Task W3 replaces the render side
 * (`NoteView`) with the CodeMirror 6 editor and adds the save loop
 * (baseRevId/X-Rev-Id headers), but the fetch itself doesn't need to
 * change shape for that.
 */
export function useNoteContentQuery(noteId: string | null) {
  return useQuery({
    queryKey: noteContentQueryKey(noteId ?? 'none'),
    queryFn: () => api.get<string>(`/api/notes/${noteId}/content`, { parseAs: 'text' }),
    enabled: Boolean(noteId),
  })
}
