import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { createSyncConnection, type RevisionEvent, type SyncConnection } from '../../lib/api/signalr'
import { normalizeServerUrl } from '../../lib/url'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { treeQueryKey } from '../explorer/useTree'
import { noteContentQueryKey } from '../notes/useNoteContent'
import { tabsForVault } from '../tabs/tabs.store'
import { lastSeqForVault, useLastSeq } from './lastSeq.store'
import { fetchChanges } from './notesSyncApi'
import { autosaveManager } from './syncManager'

/**
 * Mounts the live sync connection for the whole workspace: one SignalR
 * connection per server session, joined to whichever vault is active.
 * Renders nothing — it's pure wiring between the hub, the query cache,
 * the tabs store, and the autosave queue.
 *
 * Per the design spec's sync protocol: on every "revision" event (and
 * on catch-up after connect/reconnect), a note that isn't open or is
 * open-but-clean gets its cached content/tree invalidated so it
 * refetches; a note that's open-and-dirty is left alone entirely — its
 * next save will 409 and the autosave loop surfaces the conflict
 * itself.
 */
export function SyncProvider() {
  const queryClient = useQueryClient()
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const serverUrl = useServer((s) => s.current)
  const connectionRef = useRef<SyncConnection | null>(null)

  // One connection per server session — independent of which vault is active.
  useEffect(() => {
    if (!serverUrl) return
    const connection = createSyncConnection(normalizeServerUrl(serverUrl), () => useAuth.getState().accessToken)
    connectionRef.current = connection
    return () => {
      connectionRef.current = null
      connection.stop().catch(() => {})
    }
  }, [serverUrl])

  // Join the active vault's group, catch up, and stream revisions into the query cache.
  useEffect(() => {
    const connection = connectionRef.current
    if (!connection || !activeVaultId) return
    const vaultId = activeVaultId

    // Arrow functions (not `function` declarations) so TS's control-flow
    // narrowing of `connection` to non-null carries into these closures —
    // a hoisted function declaration can't be proven to run only after
    // the early-return check above, so it would widen back to nullable.
    const applyRevisedNotes = (noteIds: Iterable<string>) => {
      queryClient.invalidateQueries({ queryKey: treeQueryKey(vaultId) })
      const openTabs = tabsForVault(vaultId).tabs
      for (const noteId of noteIds) {
        const tab = openTabs.find((t) => t.noteId === noteId)
        if (tab?.dirty) continue // open + dirty: leave alone, next save takes the conflict path
        queryClient.invalidateQueries({ queryKey: noteContentQueryKey(noteId) })
      }
    }

    const catchUp = async () => {
      const since = lastSeqForVault(vaultId)
      try {
        const res = await fetchChanges(vaultId, since)
        if (res.results.length > 0) applyRevisedNotes(res.results.map((r) => r.noteId))
        useLastSeq.getState().setLastSeq(vaultId, res.lastSeq)
      } catch {
        // Best-effort — the next connect/reconnect catch-up will retry
        // from the same `since`, so nothing is lost.
      }
      // Reconnect always runs catch-up before flushing queued saves, so
      // a note that changed on the server while we were away is
      // reflected before we potentially conflict against it.
      await autosaveManager.flushQueue()
    }

    const joinAndCatchUp = () => {
      // Best-effort: a failed join/catch-up (server unreachable, hub not
      // deployed yet, …) shouldn't crash the workspace — the connection
      // will retry on its own reconnect schedule, or the next vault
      // switch tries again.
      connection.joinVault(vaultId).then(catchUp).catch(() => {})
    }

    const handleRevision = (event: RevisionEvent) => {
      if (event.vaultId !== vaultId) return
      applyRevisedNotes([event.noteId])
      useLastSeq.getState().setLastSeq(vaultId, event.seq)
    }

    const offRevision = connection.onRevision(handleRevision)
    // `onConnected` fires for every (re)connect from here on; if the
    // connection is already up (e.g. it was opened for a previous
    // active vault and never dropped), it won't fire again on its own,
    // so also join immediately in that case.
    const offConnected = connection.onConnected(joinAndCatchUp)
    if (connection.state === 'connected') joinAndCatchUp()

    return () => {
      offRevision()
      offConnected()
      connection.leaveVault(vaultId).catch(() => {})
    }
  }, [activeVaultId, queryClient])

  // Browser-level connectivity regained — try flushing right away rather
  // than waiting out the offline queue's own backoff.
  useEffect(() => {
    function handleOnline() {
      void autosaveManager.flushQueue()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
