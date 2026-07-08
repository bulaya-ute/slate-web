import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LastSeqState {
  /** Highest `revisions.seq` this browser has caught up to, per vault. */
  byVault: Record<string, number>
  setLastSeq: (vaultId: string, seq: number) => void
}

/**
 * Persisted so a page reload doesn't have to replay the whole change
 * log — `GET /vaults/{v}/changes?since=` resumes from here. Never goes
 * backwards (a stale/out-of-order event can't rewind the cursor).
 */
export const useLastSeq = create<LastSeqState>()(
  persist(
    (set) => ({
      byVault: {},
      setLastSeq: (vaultId, seq) =>
        set((state) => ({
          byVault: { ...state.byVault, [vaultId]: Math.max(seq, state.byVault[vaultId] ?? 0) },
        })),
    }),
    { name: 'slate.sync.last-seq' },
  ),
)

export function lastSeqForVault(vaultId: string): number {
  return useLastSeq.getState().byVault[vaultId] ?? 0
}
