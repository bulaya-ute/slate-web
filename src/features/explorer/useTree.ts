import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from '../../components/ui/Toast'
import { ApiError, type NoteMeta, type VaultTree } from '../../lib/api/types'
import { tabsForVault, useTabs } from '../tabs/tabs.store'
import * as explorerApi from './explorerApi'
import { isSameOrAncestor, rewritePathPrefix } from './tree'

export function treeQueryKey(vaultId: string) {
  return ['tree', vaultId] as const
}

/** `GET /vaults/{v}/tree` — the flat folder/note listing the tree view builds nesting from. */
export function useTreeQuery(vaultId: string | null) {
  return useQuery({
    queryKey: treeQueryKey(vaultId ?? 'none'),
    queryFn: () => explorerApi.fetchTree(vaultId as string),
    enabled: Boolean(vaultId),
  })
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

function snapshotTree(queryClient: QueryClient, vaultId: string): VaultTree | undefined {
  return queryClient.getQueryData<VaultTree>(treeQueryKey(vaultId))
}

function restoreTree(queryClient: QueryClient, vaultId: string, previous: VaultTree | undefined): void {
  if (previous) queryClient.setQueryData(treeQueryKey(vaultId), previous)
}

interface TreeMutationContext {
  previous: VaultTree | undefined
}

// ---- create (server assigns the id — no optimistic entry needed) --------

export function useCreateNote(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { path: string; content?: string }) => explorerApi.createNote(vaultId, input),
    onSuccess: (created) => {
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev ? { ...prev, notes: [...prev.notes, created] } : prev,
      )
    },
    onError: (err) => {
      toast.danger('Could not create note', errorMessage(err, 'Try again.'))
    },
  })
}

export function useCreateFolder(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => explorerApi.createFolder(vaultId, { path }),
    onSuccess: (_data, path) => {
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev && !prev.folders.includes(path) ? { ...prev, folders: [...prev.folders, path] } : prev,
      )
    },
    onError: (err) => {
      toast.danger('Could not create folder', errorMessage(err, 'Try again.'))
    },
  })
}

// ---- rename / move (optimistic, with rollback) ---------------------------

export function useRenameNote(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation<NoteMeta, unknown, { noteId: string; newPath: string }, TreeMutationContext>({
    mutationFn: ({ noteId, newPath }) => explorerApi.renameNote(noteId, { newPath }),
    onMutate: async ({ noteId, newPath }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKey(vaultId) })
      const previous = snapshotTree(queryClient, vaultId)
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev ? { ...prev, notes: prev.notes.map((n) => (n.id === noteId ? { ...n, path: newPath } : n)) } : prev,
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      restoreTree(queryClient, vaultId, context?.previous)
      toast.danger('Rename failed', errorMessage(err, 'The note keeps its previous name.'))
    },
    onSuccess: (updated, { noteId }) => {
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev ? { ...prev, notes: prev.notes.map((n) => (n.id === noteId ? updated : n)) } : prev,
      )
      useTabs.getState().renameOpenTab(vaultId, noteId, updated.path, updated.title)
    },
  })
}

export function useRenameFolder(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, unknown, { path: string; newPath: string }, TreeMutationContext>({
    mutationFn: ({ path, newPath }) => explorerApi.renameFolder(vaultId, { path, newPath }),
    onMutate: async ({ path, newPath }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKey(vaultId) })
      const previous = snapshotTree(queryClient, vaultId)
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev
          ? {
              folders: prev.folders.map((f) => rewritePathPrefix(f, path, newPath)),
              notes: prev.notes.map((n) => ({ ...n, path: rewritePathPrefix(n.path, path, newPath) })),
            }
          : prev,
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      restoreTree(queryClient, vaultId, context?.previous)
      toast.danger('Move failed', errorMessage(err, 'The folder keeps its previous location.'))
    },
    onSuccess: (_data, { path, newPath }) => {
      queryClient.invalidateQueries({ queryKey: treeQueryKey(vaultId) })
      // Keep any open tabs for notes that lived under the moved folder in sync.
      for (const tab of tabsForVault(vaultId).tabs) {
        const rewritten = rewritePathPrefix(tab.path, path, newPath)
        if (rewritten !== tab.path) useTabs.getState().renameOpenTab(vaultId, tab.noteId, rewritten)
      }
    },
  })
}

// ---- delete (optimistic, with rollback) ----------------------------------

export function useDeleteNote(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, unknown, { noteId: string }, TreeMutationContext>({
    mutationFn: ({ noteId }) => explorerApi.deleteNote(noteId),
    onMutate: async ({ noteId }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKey(vaultId) })
      const previous = snapshotTree(queryClient, vaultId)
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev,
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      restoreTree(queryClient, vaultId, context?.previous)
      toast.danger('Delete failed', errorMessage(err, 'The note was not deleted.'))
    },
    onSuccess: (_data, { noteId }) => {
      useTabs.getState().closeTab(vaultId, noteId)
    },
  })
}

export function useDeleteFolder(vaultId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, unknown, { path: string }, TreeMutationContext>({
    mutationFn: ({ path }) => explorerApi.deleteFolder(vaultId, path),
    onMutate: async ({ path }) => {
      await queryClient.cancelQueries({ queryKey: treeQueryKey(vaultId) })
      const previous = snapshotTree(queryClient, vaultId)
      queryClient.setQueryData<VaultTree>(treeQueryKey(vaultId), (prev) =>
        prev
          ? {
              folders: prev.folders.filter((f) => !isSameOrAncestor(path, f)),
              notes: prev.notes.filter((n) => !isSameOrAncestor(path, n.path)),
            }
          : prev,
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      restoreTree(queryClient, vaultId, context?.previous)
      toast.danger('Delete failed', errorMessage(err, 'The folder was not deleted.'))
    },
    onSuccess: (_data, { path }, context) => {
      const removed = context.previous?.notes.filter((n) => isSameOrAncestor(path, n.path)) ?? []
      for (const n of removed) useTabs.getState().closeTab(vaultId, n.id)
    },
  })
}
