import { useQueries, useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from '../../components/ui/Toast'
import { ApiError, type ConflictEntry, type NoteConflicts, type ResolveNoteRequest } from '../../lib/api/types'
import { treeQueryKey } from '../explorer/useTree'
import { fetchNoteContent, type NoteContentResult } from '../sync/notesSyncApi'
import { autosaveManager } from '../sync/syncManager'
import * as conflictsApi from './conflictsApi'

export function vaultConflictsQueryKey(vaultId: string) {
  return ['conflicts', vaultId] as const
}

/** `GET /vaults/{v}/conflicts` — every note in the vault with at least one unresolved conflict blob. */
export function useVaultConflictsQuery(vaultId: string | null) {
  return useQuery({
    queryKey: vaultConflictsQueryKey(vaultId ?? 'none'),
    queryFn: () => conflictsApi.fetchVaultConflicts(vaultId as string),
    enabled: Boolean(vaultId),
    staleTime: 10_000,
  })
}

/**
 * This note's pending conflicts. `undefined` while the vault-wide list
 * is still loading (distinct from `[]`, "loaded, and there are none") so
 * callers can tell "don't know yet" from "definitely clean".
 */
export function useNoteConflicts(vaultId: string | null, noteId: string): ConflictEntry[] | undefined {
  const { data } = useVaultConflictsQuery(vaultId)
  if (!data) return undefined
  return data.find((c) => c.noteId === noteId)?.conflicts ?? []
}

/**
 * The conflicting blobs' raw content, one fetch per conflict entry
 * (`GET /conflicts/{revId}/content`), in the same order as `conflicts`.
 */
export function useConflictBlobsQuery(conflicts: ConflictEntry[]) {
  return useQueries({
    queries: conflicts.map((c) => ({
      queryKey: ['conflict-content', c.revId] as const,
      queryFn: () => conflictsApi.fetchConflictContent(c.revId),
      staleTime: Infinity, // a conflict blob is immutable once created
    })),
  })
}

/**
 * The note's *current* server head content, fetched fresh (not the
 * cached `note-content` entry `EditorHost`'s CM6 view is built from —
 * see that hook's doc comment on why reusing it would risk tearing the
 * live editor down). A save conflict means the head moved to content
 * this device hasn't seen yet, so the resolve view always wants a live
 * read here.
 */
export function useFreshHeadContent(noteId: string) {
  return useQuery<NoteContentResult>({
    queryKey: ['note-content', noteId, 'resolve-head'] as const,
    queryFn: () => fetchNoteContent(noteId),
    staleTime: 0,
    gcTime: 0,
  })
}

export function useResolveNoteMutation(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: ResolveNoteRequest }) =>
      conflictsApi.resolveNote(noteId, body),
    onSuccess: (result, { noteId }) => {
      queryClient.setQueryData<NoteConflicts[]>(vaultConflictsQueryKey(vaultId), (prev) =>
        prev?.filter((c) => c.noteId !== noteId),
      )
      queryClient.invalidateQueries({ queryKey: treeQueryKey(vaultId) })
      queryClient.invalidateQueries({ queryKey: ['note-content', noteId] })
      // Un-freezes the editor (if this note is open) and points its next
      // autosave at the new head revision — see `resolveConflict`'s doc
      // comment on `AutosaveManager`.
      autosaveManager.resolveConflict(noteId, result.revId)
      toast.success('Conflict resolved')
    },
    onError: (err) => {
      toast.danger('Could not resolve conflict', err instanceof ApiError ? err.message : 'Try again.')
    },
  })
}
