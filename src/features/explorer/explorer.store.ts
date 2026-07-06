import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ExplorerState {
  /** Expanded folder paths, keyed by vault id (arrays persist as plain JSON; a Set wouldn't). */
  expandedByVault: Record<string, string[]>
  toggleFolder: (vaultId: string, path: string) => void
  isExpanded: (vaultId: string, path: string) => boolean
}

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      expandedByVault: {},
      toggleFolder: (vaultId, path) =>
        set((state) => {
          const current = state.expandedByVault[vaultId] ?? []
          const next = current.includes(path) ? current.filter((p) => p !== path) : [...current, path]
          return { expandedByVault: { ...state.expandedByVault, [vaultId]: next } }
        }),
      isExpanded: (vaultId, path) => (get().expandedByVault[vaultId] ?? []).includes(path),
    }),
    { name: 'slate.explorer' },
  ),
)
