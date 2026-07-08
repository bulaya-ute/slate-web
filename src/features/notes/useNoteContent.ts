import { useQuery } from '@tanstack/react-query'
import { fetchNoteContent, type NoteContentResult } from '../sync/notesSyncApi'

export function noteContentQueryKey(noteId: string) {
  return ['note-content', noteId] as const
}

/**
 * `GET /notes/{id}/content` — markdown text plus the `X-Rev-Id` /
 * `X-Content-Hash` headers the editor's autosave loop needs as its
 * initial `baseRevId`.
 */
export function useNoteContentQuery(noteId: string | null) {
  return useQuery<NoteContentResult>({
    queryKey: noteContentQueryKey(noteId ?? 'none'),
    queryFn: () => fetchNoteContent(noteId as string),
    enabled: Boolean(noteId),
  })
}
