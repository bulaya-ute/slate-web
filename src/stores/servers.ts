import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeServerUrl } from '../lib/url'

export interface RememberedServer {
  url: string
  name: string | null
  lastUsedAt: string
}

interface ServersState {
  /** The active server for this session (null until chosen/resolved). */
  current: string | null
  /** Servers the user has successfully connected to before, most-recent first. */
  remembered: RememberedServer[]
  setCurrent: (url: string, name?: string | null) => void
  clearCurrent: () => void
  forget: (url: string) => void
}

/**
 * Remembered/active server list, persisted to localStorage. `useServer()`
 * is the brief's required hook name — this store *is* that hook.
 */
export const useServer = create<ServersState>()(
  persist(
    (set, get) => ({
      current: null,
      remembered: [],
      setCurrent: (url, name = null) => {
        const normalized = normalizeServerUrl(url)
        const rest = get().remembered.filter((s) => s.url !== normalized)
        set({
          current: normalized,
          remembered: [
            { url: normalized, name, lastUsedAt: new Date().toISOString() },
            ...rest,
          ],
        })
      },
      clearCurrent: () => set({ current: null }),
      forget: (url) => {
        const normalized = normalizeServerUrl(url)
        set((state) => ({
          remembered: state.remembered.filter((s) => s.url !== normalized),
          current: state.current === normalized ? null : state.current,
        }))
      },
    }),
    { name: 'slate.servers' },
  ),
)
