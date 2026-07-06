import type { ServerCheckResult } from '../lib/api/client'
import type { SystemInfo } from '../lib/api/types'

/**
 * Derives the pieces of `useServerCheckQuery`'s result that Login (and
 * Setup) need to decide what to render. Pulled out so the three-way
 * branch — ok / incompatible / unreachable — can't quietly collapse back
 * into a two-way one, and so it's unit-testable without mounting the
 * route (see loginServerState.test.ts).
 */
export interface LoginServerState {
  /** Populated only when the server is reachable and API-compatible. */
  info: SystemInfo | null
  /** Populated only when the server is reachable but speaks a different apiVersion. */
  incompatibleInfo: SystemInfo | null
  /** True when the server couldn't be reached at all (or hasn't been checked yet). */
  unreachable: boolean
}

export function resolveLoginServerState(data: ServerCheckResult | undefined): LoginServerState {
  if (data?.status === 'ok') {
    return { info: data.info, incompatibleInfo: null, unreachable: false }
  }
  if (data?.status === 'incompatible') {
    return { info: null, incompatibleInfo: data.info, unreachable: false }
  }
  // status === 'unreachable', or the query hasn't resolved data yet (e.g. disabled).
  return { info: null, incompatibleInfo: null, unreachable: true }
}
