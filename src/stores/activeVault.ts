import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ActiveVaultState {
  activeVaultId: string | null
  setActiveVaultId: (vaultId: string | null) => void
}

/**
 * Which vault the workspace currently shows, persisted so a reload lands
 * back on the same vault. Explorer/tabs/note-view all read this rather
 * than each keeping their own notion of "current vault".
 */
export const useActiveVault = create<ActiveVaultState>()(
  persist(
    (set) => ({
      activeVaultId: null,
      setActiveVaultId: (vaultId) => set({ activeVaultId: vaultId }),
    }),
    { name: 'slate.active-vault' },
  ),
)
