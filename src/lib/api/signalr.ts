/**
 * Stub for the live sync connection to `/hubs/sync`.
 *
 * Wiring this up for real (via `@microsoft/signalr`, `accessTokenFactory`
 * pointed at the auth store's access token, `JoinVault`/`LeaveVault`
 * calls, and a `revision` event listener) is scope for the sync-engine
 * task once the server hub exists. This file exists now so later tasks
 * have a stable import path and shape to build against, and so the
 * workspace shell can reference "connection status" without a runtime
 * dependency yet.
 */

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
}

export type SyncConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface SyncConnection {
  state: SyncConnectionState
  joinVault: (vaultId: string) => Promise<void>
  leaveVault: (vaultId: string) => Promise<void>
  onRevision: (handler: (event: RevisionEvent) => void) => () => void
  stop: () => Promise<void>
}

/**
 * Not implemented yet — throws so any accidental early use fails loudly
 * instead of silently no-op'ing. See module doc comment above.
 */
export function createSyncConnection(
  _baseUrl: string,
  _getAccessToken: () => string | null,
): SyncConnection {
  throw new Error(
    'createSyncConnection() is not implemented yet — the sync engine lands in a later task.',
  )
}
