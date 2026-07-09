import { useQuery } from '@tanstack/react-query'
import { fetchNoteContent, type NoteContentResult } from '../sync/notesSyncApi'

export function noteContentQueryKey(noteId: string) {
  return ['note-content', noteId] as const
}

/**
 * `GET /notes/{id}/content` — markdown text plus the `X-Rev-Id` /
 * `X-Content-Hash` headers the editor's autosave loop needs as its
 * initial `baseRevId`.
 *
 * `staleTime` matters here beyond the usual "fewer requests": `EditorHost`
 * mounts a CM6 view from whatever `data` this hook returns and rebuilds
 * it (losing cursor/undo history) whenever that `data` object changes —
 * see its mount effect. With the default `staleTime: 0`, a second
 * observer of this same query (the outline panel reads the open note's
 * content from here too) mounting while `EditorHost` is already showing
 * a *previously cached* note would trigger a background refetch whose
 * resolution looks like "the content changed" and tears the editor down
 * for no real reason. `SyncProvider` already explicitly
 * `invalidateQueries` this key when a real out-of-band change happens
 * (which still refetches immediately regardless of `staleTime`), so this
 * only suppresses the *implicit* mount-triggered kind.
 */
export function useNoteContentQuery(noteId: string | null) {
  return useQuery<NoteContentResult>({
    queryKey: noteContentQueryKey(noteId ?? 'none'),
    queryFn: () => fetchNoteContent(noteId as string),
    enabled: Boolean(noteId),
    staleTime: 30_000,
  })
}
