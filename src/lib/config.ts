import { normalizeServerUrl } from './url'

/** Shape of `public/config.json`, fetched once on boot. */
export interface AppConfig {
  serverUrl: string | null
  allowServerSelection: boolean
  serverName: string | null
}

export const DEFAULT_CONFIG: AppConfig = {
  serverUrl: null,
  allowServerSelection: true,
  serverName: null,
}

/**
 * Fetches `/config.json`. Any failure (404, network error, malformed
 * JSON) falls back to `DEFAULT_CONFIG` — deployments that don't ship a
 * config file still get a working, fully-selectable Connect screen.
 */
export async function fetchConfig(
  fetchImpl: typeof fetch = fetch,
): Promise<AppConfig> {
  try {
    const res = await fetchImpl('/config.json', { cache: 'no-store' })
    if (!res.ok) return DEFAULT_CONFIG
    const data = (await res.json()) as Partial<AppConfig>
    return {
      serverUrl:
        typeof data.serverUrl === 'string' && data.serverUrl.trim() !== ''
          ? normalizeServerUrl(data.serverUrl)
          : null,
      allowServerSelection:
        typeof data.allowServerSelection === 'boolean'
          ? data.allowServerSelection
          : DEFAULT_CONFIG.allowServerSelection,
      serverName:
        typeof data.serverName === 'string' ? data.serverName : null,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

/**
 * The three shapes deployment config can take, per the design spec's
 * "Connection model":
 *  - `pinned-locked`:      serverUrl set, selection disabled  → skip
 *                          Connect entirely, go straight to login.
 *  - `pinned-selectable`:  serverUrl set, selection allowed   → default
 *                          to the pinned server, but "change server"
 *                          stays available.
 *  - `unpinned`:           no serverUrl                       → user
 *                          must pick/enter a server on Connect.
 */
export type ConnectionMode = 'pinned-locked' | 'pinned-selectable' | 'unpinned'

export function resolveConnectionMode(config: AppConfig): ConnectionMode {
  if (config.serverUrl && !config.allowServerSelection) return 'pinned-locked'
  if (config.serverUrl && config.allowServerSelection) return 'pinned-selectable'
  return 'unpinned'
}

/**
 * Given config + the currently-remembered active server (from the
 * servers store), decide the effective server URL to use and whether
 * the Connect screen must be shown.
 */
export function resolveActiveServer(
  config: AppConfig,
  storedCurrent: string | null,
): { serverUrl: string | null; requiresConnect: boolean } {
  const mode = resolveConnectionMode(config)

  if (mode === 'pinned-locked') {
    return { serverUrl: config.serverUrl, requiresConnect: false }
  }
  if (mode === 'pinned-selectable') {
    return { serverUrl: storedCurrent ?? config.serverUrl, requiresConnect: false }
  }
  // unpinned
  return { serverUrl: storedCurrent, requiresConnect: storedCurrent === null }
}
