import { useQuery } from '@tanstack/react-query'
import * as backlinksApi from './backlinksApi'

export function backlinksQueryKey(noteId: string) {
  return ['backlinks', noteId] as const
}

/** `GET /notes/{id}/backlinks` — right sidebar's backlinks section for the currently open note. */
export function useBacklinks(noteId: string | null) {
  return useQuery({
    queryKey: backlinksQueryKey(noteId ?? 'none'),
    queryFn: () => backlinksApi.fetchBacklinks(noteId as string),
    enabled: Boolean(noteId),
    staleTime: 15_000,
  })
}
