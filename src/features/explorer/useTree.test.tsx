import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '../../components/ui/Toast'
import type { NoteMeta, VaultTree } from '../../lib/api/types'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { treeQueryKey, useDeleteFolder, useDeleteNote, useRenameFolder, useRenameNote } from './useTree'

const VAULT_ID = 'vault-1'

function note(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id: 'note-1',
    path: 'Folder/Note.md',
    title: 'Note',
    hasConflict: false,
    sizeBytes: 10,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** A `Response`-shaped error mock matching the API's `{ error: { code, message } }` envelope, as in client.test.ts. */
function errorResponse(status: number, code: string, message: string): Response {
  const body = { error: { code, message } }
  const response = {
    ok: false,
    status,
    statusText: `Status ${status}`,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone(): Response {
      return errorResponse(status, code, message)
    },
  }
  return response as unknown as Response
}

/** A fetch call we can resolve/reject on our own schedule, so we can assert the optimistic patch mid-flight. */
function deferredFetch(): { promise: Promise<Response>; resolve: (res: Response) => void } {
  let resolve!: (res: Response) => void
  const promise = new Promise<Response>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useRenameNote (optimistic rename + rollback)', () => {
  it('patches the tree cache optimistically, then rolls back and toasts on failure', async () => {
    const initial: VaultTree = { folders: ['Folder'], notes: [note()] }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(treeQueryKey(VAULT_ID), initial)

    const deferred = deferredFetch()
    const fetchMock = vi.fn().mockReturnValueOnce(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useRenameNote(VAULT_ID), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ noteId: 'note-1', newPath: 'Folder/Renamed.md' })
    })

    // (a) optimistic patch: the cache reflects the new path before the mutation settles.
    await waitFor(() => {
      const cache = queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))
      expect(cache?.notes[0].path).toBe('Folder/Renamed.md')
    })

    act(() => {
      deferred.resolve(errorResponse(404, 'not_found', 'Note not found'))
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // (b) rollback: cache is restored to the pre-mutation snapshot.
    expect(queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))).toEqual(initial)

    // (c) danger toast fires.
    expect(dangerSpy).toHaveBeenCalledWith('Rename failed', 'Note not found')
  })
})

describe('useRenameFolder (optimistic move + rollback)', () => {
  it('rewrites descendant paths optimistically, then rolls back and toasts on failure', async () => {
    const initial: VaultTree = {
      folders: ['Folder', 'Folder/Sub'],
      notes: [note({ id: 'note-1', path: 'Folder/Sub/Note.md' })],
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(treeQueryKey(VAULT_ID), initial)

    const deferred = deferredFetch()
    const fetchMock = vi.fn().mockReturnValueOnce(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useRenameFolder(VAULT_ID), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ path: 'Folder', newPath: 'Moved' })
    })

    await waitFor(() => {
      const cache = queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))
      expect(cache?.folders).toEqual(expect.arrayContaining(['Moved', 'Moved/Sub']))
      expect(cache?.notes[0].path).toBe('Moved/Sub/Note.md')
    })

    act(() => {
      deferred.resolve(errorResponse(409, 'conflict', 'Destination already exists'))
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))).toEqual(initial)
    expect(dangerSpy).toHaveBeenCalledWith('Move failed', 'Destination already exists')
  })
})

describe('useDeleteNote (optimistic delete + rollback)', () => {
  it('removes the note optimistically, then rolls back and toasts on failure', async () => {
    const initial: VaultTree = { folders: ['Folder'], notes: [note()] }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(treeQueryKey(VAULT_ID), initial)

    const deferred = deferredFetch()
    const fetchMock = vi.fn().mockReturnValueOnce(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useDeleteNote(VAULT_ID), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ noteId: 'note-1' })
    })

    await waitFor(() => {
      const cache = queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))
      expect(cache?.notes).toHaveLength(0)
    })

    act(() => {
      deferred.resolve(errorResponse(500, 'server_error', 'Something went wrong'))
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))).toEqual(initial)
    expect(dangerSpy).toHaveBeenCalledWith('Delete failed', 'Something went wrong')
  })
})

describe('useDeleteFolder (optimistic delete + rollback)', () => {
  it('removes the folder and its descendant notes optimistically, then rolls back and toasts on failure', async () => {
    const initial: VaultTree = {
      folders: ['Folder', 'Folder/Sub', 'Other'],
      notes: [note({ id: 'note-1', path: 'Folder/Sub/Note.md' }), note({ id: 'note-2', path: 'Other/Note2.md' })],
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(treeQueryKey(VAULT_ID), initial)

    const deferred = deferredFetch()
    const fetchMock = vi.fn().mockReturnValueOnce(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useDeleteFolder(VAULT_ID), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ path: 'Folder' })
    })

    await waitFor(() => {
      const cache = queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))
      expect(cache?.folders).toEqual(['Other'])
      expect(cache?.notes.map((n) => n.id)).toEqual(['note-2'])
    })

    act(() => {
      deferred.resolve(errorResponse(500, 'server_error', 'Something went wrong'))
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(queryClient.getQueryData<VaultTree>(treeQueryKey(VAULT_ID))).toEqual(initial)
    expect(dangerSpy).toHaveBeenCalledWith('Delete failed', 'Something went wrong')
  })
})
