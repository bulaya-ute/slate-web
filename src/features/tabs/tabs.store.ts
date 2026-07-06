import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TabItem {
  noteId: string
  /** Vault-relative path — kept in sync by rename/move mutations. */
  path: string
  /** Display title (defaults to the note's tree display name). */
  title: string
  /** Unsaved-changes indicator; the editor (Task W3) owns setting this. */
  dirty: boolean
}

interface VaultTabs {
  tabs: TabItem[]
  activeNoteId: string | null
}

/**
 * Stable "no tabs" shape — reused (never recreated) so component
 * selectors like `s.byVault[vaultId]?.tabs ?? EMPTY_VAULT_TABS.tabs` keep
 * returning the *same* array reference across renders. A fresh `?? []`
 * literal there would produce a new array every render, and since
 * zustand's `useStore` compares selector output by reference, that
 * causes an infinite re-render loop for any vault with no open tabs yet.
 */
export const EMPTY_VAULT_TABS: VaultTabs = { tabs: [], activeNoteId: null }

interface TabsState {
  /** Open tabs, keyed by vault id — each vault remembers its own tab set. */
  byVault: Record<string, VaultTabs>
  /** Opens a note as a tab (or just activates it if already open). */
  openTab: (vaultId: string, note: { noteId: string; path: string; title: string }) => void
  /** Closes a tab, promoting a sensible neighbor to active. */
  closeTab: (vaultId: string, noteId: string) => void
  setActive: (vaultId: string, noteId: string) => void
  /** Moves the tab at `fromIndex` to `toIndex` (drag-to-reorder). */
  reorder: (vaultId: string, fromIndex: number, toIndex: number) => void
  setDirty: (vaultId: string, noteId: string, dirty: boolean) => void
  /** Keeps an open tab's path/title in sync after an explorer rename/move. */
  renameOpenTab: (vaultId: string, noteId: string, newPath: string, newTitle?: string) => void
}

function updateVault(
  state: TabsState,
  vaultId: string,
  updater: (vault: VaultTabs) => VaultTabs,
): Pick<TabsState, 'byVault'> {
  const current = state.byVault[vaultId] ?? EMPTY_VAULT_TABS
  return { byVault: { ...state.byVault, [vaultId]: updater(current) } }
}

/**
 * Open-tab state, persisted per vault. Deliberately holds nothing the
 * editor (Task W3) doesn't already need at this layer — `dirty` is a
 * plain boolean the editor flips; the editor's own content/revision
 * state lives elsewhere so this store never has to be reshaped to plug
 * an editor component in.
 */
export const useTabs = create<TabsState>()(
  persist(
    (set) => ({
      byVault: {},

      openTab: (vaultId, note) =>
        set((state) =>
          updateVault(state, vaultId, (vault) => {
            const exists = vault.tabs.some((t) => t.noteId === note.noteId)
            const tabs = exists
              ? vault.tabs
              : [...vault.tabs, { noteId: note.noteId, path: note.path, title: note.title, dirty: false }]
            return { tabs, activeNoteId: note.noteId }
          }),
        ),

      closeTab: (vaultId, noteId) =>
        set((state) =>
          updateVault(state, vaultId, (vault) => {
            const index = vault.tabs.findIndex((t) => t.noteId === noteId)
            if (index === -1) return vault
            const tabs = vault.tabs.filter((t) => t.noteId !== noteId)
            let activeNoteId = vault.activeNoteId
            if (activeNoteId === noteId) {
              if (tabs.length === 0) {
                activeNoteId = null
              } else {
                const neighborIndex = Math.min(index, tabs.length - 1)
                activeNoteId = tabs[neighborIndex].noteId
              }
            }
            return { tabs, activeNoteId }
          }),
        ),

      setActive: (vaultId, noteId) =>
        set((state) => updateVault(state, vaultId, (vault) => ({ ...vault, activeNoteId: noteId }))),

      reorder: (vaultId, fromIndex, toIndex) =>
        set((state) =>
          updateVault(state, vaultId, (vault) => {
            if (
              fromIndex < 0 ||
              fromIndex >= vault.tabs.length ||
              toIndex < 0 ||
              toIndex >= vault.tabs.length ||
              fromIndex === toIndex
            ) {
              return vault
            }
            const tabs = [...vault.tabs]
            const [moved] = tabs.splice(fromIndex, 1)
            tabs.splice(toIndex, 0, moved)
            return { ...vault, tabs }
          }),
        ),

      setDirty: (vaultId, noteId, dirty) =>
        set((state) =>
          updateVault(state, vaultId, (vault) => ({
            ...vault,
            tabs: vault.tabs.map((t) => (t.noteId === noteId ? { ...t, dirty } : t)),
          })),
        ),

      renameOpenTab: (vaultId, noteId, newPath, newTitle) =>
        set((state) =>
          updateVault(state, vaultId, (vault) => ({
            ...vault,
            tabs: vault.tabs.map((t) =>
              t.noteId === noteId ? { ...t, path: newPath, title: newTitle ?? t.title } : t,
            ),
          })),
        ),
    }),
    { name: 'slate.tabs' },
  ),
)

/** Tabs for a single vault, defaulting to an empty set for vaults never opened. */
export function tabsForVault(vaultId: string | null): VaultTabs {
  if (!vaultId) return EMPTY_VAULT_TABS
  return useTabs.getState().byVault[vaultId] ?? EMPTY_VAULT_TABS
}
