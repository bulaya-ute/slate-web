import { BacklinksPanel } from '../backlinks/BacklinksPanel'
import { OutlinePanel } from '../outline/OutlinePanel'
import { useActiveVault } from '../../stores/activeVault'
import { EMPTY_VAULT_TABS, useTabs } from '../tabs/tabs.store'

/** Right sidebar: outline above backlinks for the currently active tab, per the design spec. */
export function RightSidebar() {
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const activeNoteId = useTabs((s) =>
    activeVaultId ? (s.byVault[activeVaultId]?.activeNoteId ?? EMPTY_VAULT_TABS.activeNoteId) : null,
  )

  return (
    <div className="flex h-full flex-col">
      <OutlinePanel noteId={activeNoteId} />
      <BacklinksPanel noteId={activeNoteId} />
    </div>
  )
}
