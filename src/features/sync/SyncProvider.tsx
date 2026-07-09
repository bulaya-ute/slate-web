import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { createSyncConnection, RECONNECT_DELAYS_MS, type RevisionEvent, type SyncConnection } from '../../lib/api/signalr'
import { normalizeServerUrl } from '../../lib/url'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { vaultConflictsQueryKey } from '../conflicts/useConflicts'
import { treeQueryKey } from '../explorer/useTree'
import { noteContentQueryKey } from '../notes/useNoteContent'
import { tabsForVault } from '../tabs/tabs.store'
import { lastSeqForVault, useLastSeq } from './lastSeq.store'
import { fetchChanges } from './notesSyncApi'
import { autosaveManager, deviceId } from './syncManager'

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

    let cancelled = false
    let joining = false
    let retryStep = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

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

    // Explicitly starts the connection (if it isn't already) and joins
    // this vault's group — without this, nothing ever calls `.start()`
    // and the whole live-sync path (JoinVault, /changes catch-up,
    // revision events) never turns on. `connection.joinVault` itself
    // calls `ensureStarted()`, so this covers both "never started" and
    // "started, just joining a different/same vault".
    //
    // Guarded re-entrancy: this is also registered as the `onConnected`
    // listener below, and a *successful* first start calls that
    // listener synchronously as part of resolving this same call's own
    // `joinVault` promise — without the `joining` guard that would fire
    // `JoinVault` (and catch-up) twice for the very first connect.
    const attemptJoin = () => {
      if (joining) return
      joining = true
      clearRetryTimer()
      connection
        .joinVault(vaultId)
        .then(() => {
          retryStep = 0
          if (cancelled) return
          return catchUp()
        })
        .catch(() => {
          // Best-effort: a failed join/catch-up (server unreachable, hub
          // not deployed yet, …) shouldn't crash the workspace. Retry
          // with the same backoff schedule the transport's own
          // reconnect uses — `withAutomaticReconnect` only retries a
          // connection that dropped *after* connecting once, never a
          // first `.start()` that failed, so without this an
          // unreachable server at first load would never be retried.
          if (cancelled) return
          const delay = RECONNECT_DELAYS_MS[Math.min(retryStep, RECONNECT_DELAYS_MS.length - 1)]
          retryStep += 1
          retryTimer = setTimeout(attemptJoin, delay)
        })
        .finally(() => {
          joining = false
        })
    }

    const handleRevision = (event: RevisionEvent) => {
      if (event.vaultId !== vaultId) return
      // Always advance the cursor — even our own echo is a real revision
      // that's now been observed.
      useLastSeq.getState().setLastSeq(vaultId, event.seq)
      queryClient.invalidateQueries({ queryKey: treeQueryKey(vaultId) })
      if (event.isConflict) {
        // A conflict revision has to reach the vault-wide conflicts list
        // (and any open ConflictResolveView) live — regardless of which
        // device wrote it or whether the note's tab is open/dirty.
        // Otherwise a second conflict landing on a note the user is
        // already mid-resolve on is invisible until the query's 10s
        // staleTime happens to lapse, and can get silently dropped from
        // resolvedRevIds.
        queryClient.invalidateQueries({ queryKey: vaultConflictsQueryKey(vaultId) })
      }
      if (event.deviceId === deviceId) return // our own autosave echoing back — the editor already has this content; invalidating it would tear down CM6 (losing cursor/undo history) on every single save
      const tab = tabsForVault(vaultId).tabs.find((t) => t.noteId === event.noteId)
      if (tab?.dirty) return // open + dirty: leave alone, next save takes the conflict path
      queryClient.invalidateQueries({ queryKey: noteContentQueryKey(event.noteId) })
    }

    const offRevision = connection.onRevision(handleRevision)
    // Fires on every reconnect from here on (a drop *after* a successful
    // join) — re-join + catch-up so a note that changed while we were
    // disconnected is caught up before revision events resume.
    const offConnected = connection.onConnected(attemptJoin)
    attemptJoin()

    return () => {
      cancelled = true
      clearRetryTimer()
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
