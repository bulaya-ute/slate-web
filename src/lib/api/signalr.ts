/**
 * Live sync connection to `/hubs/sync`. Authenticates with the current
 * access token (`accessTokenFactory`), joins/leaves vault groups, and
 * relays the server's `revision` broadcasts.
 *
 * `@microsoft/signalr`'s own `withAutomaticReconnect` handles the
 * reconnect *transport* loop; this module just translates connection
 * lifecycle into the three-state shape the rest of the app cares about
 * and exposes `onConnected` so callers (the sync feature's
 * `SyncProvider`) can re-join groups + run catch-up every time a
 * connection is (re-)established, including the very first one.
 */

import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr'
import type { RevisionKind } from './types'

export interface RevisionEvent {
  vaultId: string
  seq: number
  noteId: string
  kind: RevisionKind
  path: string
  oldPath?: string
  contentHash: string
  deviceId: string
  isConflict: boolean
}

export type SyncConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface SyncConnection {
  readonly state: SyncConnectionState
  joinVault: (vaultId: string) => Promise<void>
  leaveVault: (vaultId: string) => Promise<void>
  onRevision: (handler: (event: RevisionEvent) => void) => () => void
  /** Fires on first connect and every reconnect after a drop — re-join vault groups + catch-up here. */
  onConnected: (handler: () => void) => () => void
  onStateChange: (handler: (state: SyncConnectionState) => void) => () => void
  stop: () => Promise<void>
}

/**
 * Reconnect backoff schedule (ms), also reused by `SyncProvider` for its
 * own retry of the *initial* `joinVault` (the transport's own
 * `withAutomaticReconnect` only retries a connection that dropped after
 * connecting once — it never retries a first `.start()` that failed).
 */
export const RECONNECT_DELAYS_MS = [0, 1000, 2000, 5000, 10_000, 15_000, 30_000]

export function createSyncConnection(baseUrl: string, getAccessToken: () => string | null): SyncConnection {
  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(`${baseUrl}/hubs/sync`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect(RECONNECT_DELAYS_MS)
    .configureLogging(LogLevel.Warning)
    .build()

  let state: SyncConnectionState = 'disconnected'
  const stateListeners = new Set<(state: SyncConnectionState) => void>()
  const revisionListeners = new Set<(event: RevisionEvent) => void>()
  const connectedListeners = new Set<() => void>()
  let startPromise: Promise<void> | null = null

  function setState(next: SyncConnectionState): void {
    if (state === next) return
    state = next
    for (const listener of stateListeners) listener(next)
  }

  function notifyConnected(): void {
    for (const listener of connectedListeners) listener()
  }

  connection.on('revision', (event: RevisionEvent) => {
    for (const listener of revisionListeners) listener(event)
  })

  connection.onreconnecting(() => setState('connecting'))
  connection.onreconnected(() => {
    setState('connected')
    notifyConnected()
  })
  connection.onclose(() => setState('disconnected'))

  function ensureStarted(): Promise<void> {
    if (connection.state === HubConnectionState.Connected) return Promise.resolve()
    if (startPromise) return startPromise
    setState('connecting')
    startPromise = connection
      .start()
      .then(() => {
        setState('connected')
        notifyConnected()
      })
      .catch((err) => {
        setState('disconnected')
        throw err
      })
      .finally(() => {
        startPromise = null
      })
    return startPromise
  }

  return {
    get state() {
      return state
    },
    async joinVault(vaultId: string) {
      await ensureStarted()
      await connection.invoke('JoinVault', vaultId)
    },
    async leaveVault(vaultId: string) {
      if (connection.state !== HubConnectionState.Connected) return
      await connection.invoke('LeaveVault', vaultId)
    },
    onRevision(handler) {
      revisionListeners.add(handler)
      return () => revisionListeners.delete(handler)
    },
    onConnected(handler) {
      connectedListeners.add(handler)
      return () => connectedListeners.delete(handler)
    },
    onStateChange(handler) {
      stateListeners.add(handler)
      return () => stateListeners.delete(handler)
    },
    async stop() {
      startPromise = null
      await connection.stop()
      setState('disconnected')
    },
  }
}
