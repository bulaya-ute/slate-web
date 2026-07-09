import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChangesResponse } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { vaultConflictsQueryKey } from '../conflicts/useConflicts'
import { noteContentQueryKey } from '../notes/useNoteContent'
import { tabsForVault, useTabs } from '../tabs/tabs.store'
import type { RevisionEvent, SyncConnection } from '../../lib/api/signalr'
import { createSyncConnection } from '../../lib/api/signalr'
import { useLastSeq } from './lastSeq.store'
import { fetchChanges } from './notesSyncApi'
import { autosaveManager, deviceId } from './syncManager'
import { SyncProvider } from './SyncProvider'

vi.mock('../../lib/api/signalr', () => ({
  RECONNECT_DELAYS_MS: [0, 1000, 2000],
  createSyncConnection: vi.fn(),
}))

vi.mock('./notesSyncApi', () => ({
  fetchChanges: vi.fn(),
  fetchNoteContent: vi.fn(),
  putNoteContent: vi.fn(),
  ConflictError: class ConflictError extends Error {},
}))

vi.mock('./syncManager', () => ({
  autosaveManager: { flushQueue: vi.fn(async () => {}) },
  deviceId: 'device-mine',
}))

const VAULT_A = 'vault-a'
const VAULT_B = 'vault-b'

function revision(overrides: Partial<RevisionEvent> = {}): RevisionEvent {
  return {
    vaultId: VAULT_A,
    seq: 1,
    noteId: 'note-1',
    kind: 'edit',
    path: 'note-1.md',
    contentHash: 'hash-1',
    deviceId: 'device-other',
    isConflict: false,
    ...overrides,
  }
}

function changes(overrides: Partial<ChangesResponse> = {}): ChangesResponse {
  return { results: [], lastSeq: 0, ...overrides }
}

/** A controllable stand-in for `createSyncConnection`'s return value. */
function makeFakeConnection() {
  const revisionHandlers = new Set<(e: RevisionEvent) => void>()
  const connectedHandlers = new Set<() => void>()
  const joinVault = vi.fn(async () => {})
  const leaveVault = vi.fn(async () => {})
  const stop = vi.fn(async () => {})

  const connection: SyncConnection = {
    state: 'disconnected',
    joinVault,
    leaveVault,
    onRevision: (handler) => {
      revisionHandlers.add(handler)
      return () => revisionHandlers.delete(handler)
    },
    onConnected: (handler) => {
      connectedHandlers.add(handler)
      return () => connectedHandlers.delete(handler)
    },
    onStateChange: () => () => {},
    stop,
  }

  return {
    connection,
    joinVault,
    leaveVault,
    stop,
    emitRevision: (event: RevisionEvent) => revisionHandlers.forEach((h) => h(event)),
    emitConnected: () => connectedHandlers.forEach((h) => h()),
  }
}

function renderSync(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncProvider />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
  useActiveVault.setState({ activeVaultId: null })
  useTabs.setState({ byVault: {} })
  useLastSeq.setState({ byVault: {} })
  vi.mocked(fetchChanges).mockResolvedValue(changes())
  vi.mocked(autosaveManager.flushQueue).mockClear()
  vi.mocked(autosaveManager.flushQueue).mockResolvedValue(undefined)
  // `restoreAllMocks()` below doesn't clear call history for a plain
  // `vi.fn()` from a `vi.mock()` factory (it's not a spy on a real
  // implementation) — without this, `toHaveBeenCalledOnce()` assertions
  // see call counts left over from earlier tests in this file.
  vi.mocked(createSyncConnection).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mount / connection lifecycle (Finding 2 — nothing ever started the connection)', () => {
  it('fresh mount with a disconnected connection starts + joins the active vault, catches up from the persisted lastSeq, then flushes the offline queue', async () => {
    const fake = makeFakeConnection()
    vi.mocked(createSyncConnection).mockReturnValue(fake.connection)
    useLastSeq.setState({ byVault: { [VAULT_A]: 42 } })
    useActiveVault.setState({ activeVaultId: VAULT_A })

    const order: string[] = []
    vi.mocked(fetchChanges).mockImplementation(async () => {
      order.push('fetchChanges')
      return changes()
    })
    vi.mocked(autosaveManager.flushQueue).mockImplementation(async () => {
      order.push('flushQueue')
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fake.joinVault).toHaveBeenCalledWith(VAULT_A)
    expect(fetchChanges).toHaveBeenCalledWith(VAULT_A, 42)
    expect(order).toEqual(['fetchChanges', 'flushQueue']) // catch-up before queue flush
  })

  it('vault switch leaves the old vault and joins the new one on the same connection', async () => {
    const fake = makeFakeConnection()
    vi.mocked(createSyncConnection).mockReturnValue(fake.connection)
    useActiveVault.setState({ activeVaultId: VAULT_A })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fake.joinVault).toHaveBeenCalledWith(VAULT_A)
    expect(fake.leaveVault).not.toHaveBeenCalled()

    await act(async () => {
      useActiveVault.setState({ activeVaultId: VAULT_B })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fake.leaveVault).toHaveBeenCalledWith(VAULT_A)
    expect(fake.joinVault).toHaveBeenCalledWith(VAULT_B)
    // Still the one connection the whole time — `createSyncConnection` only
    // called once since `serverUrl` never changed.
    expect(createSyncConnection).toHaveBeenCalledOnce()
  })
})

describe('handleRevision own-device echo filter (Finding 3)', () => {
  function setup() {
    const fake = makeFakeConnection()
    vi.mocked(createSyncConnection).mockReturnValue(fake.connection)
    useActiveVault.setState({ activeVaultId: VAULT_A })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(noteContentQueryKey('note-1'), { content: 'x', revId: 'rev-1', contentHash: 'h' })
    return { fake, queryClient }
  }

  it('does not invalidate the note-content query for an echo of this device\'s own save, but still advances lastSeq', async () => {
    const { fake, queryClient } = setup()
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 7, noteId: 'note-1', deviceId }))
    })

    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: noteContentQueryKey('note-1') }))
    expect(useLastSeq.getState().byVault[VAULT_A]).toBe(7)
  })

  it('invalidates the note-content query for a foreign device\'s revision event', async () => {
    const { fake, queryClient } = setup()
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 8, noteId: 'note-1', deviceId: 'device-other' }))
    })

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: noteContentQueryKey('note-1') }))
    expect(useLastSeq.getState().byVault[VAULT_A]).toBe(8)
  })

  it('leaves an open-and-dirty note alone even for a foreign device event', async () => {
    const { fake, queryClient } = setup()
    useTabs.getState().openTab(VAULT_A, { noteId: 'note-1', path: 'note-1.md', title: 'Note 1' })
    useTabs.getState().setDirty(VAULT_A, 'note-1', true)
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 9, noteId: 'note-1', deviceId: 'device-other' }))
    })

    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: noteContentQueryKey('note-1') }))
    expect(tabsForVault(VAULT_A).tabs[0].dirty).toBe(true)
  })
})

describe('handleRevision conflicts invalidation (Finding: conflict banner staleness)', () => {
  function setup() {
    const fake = makeFakeConnection()
    vi.mocked(createSyncConnection).mockReturnValue(fake.connection)
    useActiveVault.setState({ activeVaultId: VAULT_A })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return { fake, queryClient }
  }

  it('invalidates the vault conflicts query when a revision event carries isConflict: true', async () => {
    const { fake, queryClient } = setup()
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 10, noteId: 'note-1', deviceId: 'device-other', isConflict: true }))
    })

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: vaultConflictsQueryKey(VAULT_A) }))
  })

  it('does not invalidate the vault conflicts query for a normal, non-conflict revision', async () => {
    const { fake, queryClient } = setup()
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 11, noteId: 'note-1', deviceId: 'device-other', isConflict: false }))
    })

    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: vaultConflictsQueryKey(VAULT_A) }))
  })

  it('invalidates conflicts even for the device\'s own echo and an open-dirty tab, unlike note-content', async () => {
    const { fake, queryClient } = setup()
    useTabs.getState().openTab(VAULT_A, { noteId: 'note-1', path: 'note-1.md', title: 'Note 1' })
    useTabs.getState().setDirty(VAULT_A, 'note-1', true)
    await act(async () => {
      renderSync(queryClient)
      await Promise.resolve()
      await Promise.resolve()
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      fake.emitRevision(revision({ seq: 12, noteId: 'note-1', deviceId, isConflict: true }))
    })

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: vaultConflictsQueryKey(VAULT_A) }))
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: noteContentQueryKey('note-1') }))
  })
})
