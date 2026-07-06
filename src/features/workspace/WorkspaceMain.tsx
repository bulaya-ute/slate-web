import { NoNoteOpen } from '../notes/NoNoteOpen'
import { NoteView } from '../notes/NoteView'
import { useActiveVault } from '../../stores/activeVault'
import { TabBar } from '../tabs/TabBar'
import { EMPTY_VAULT_TABS, useTabs } from '../tabs/tabs.store'

/** Main pane: tab strip + whatever the active tab resolves to (or an empty state). */
export function WorkspaceMain() {
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const tabs = useTabs((s) =>
    activeVaultId ? (s.byVault[activeVaultId]?.tabs ?? EMPTY_VAULT_TABS.tabs) : EMPTY_VAULT_TABS.tabs,
  )
  const activeNoteId = useTabs((s) =>
    activeVaultId ? (s.byVault[activeVaultId]?.activeNoteId ?? null) : null,
  )

  if (!activeVaultId) return <NoNoteOpen />

  const activeTab = tabs.find((t) => t.noteId === activeNoteId) ?? null

  return (
    <div className="flex h-full flex-col">
      <TabBar vaultId={activeVaultId} />
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <NoteView noteId={activeTab.noteId} path={activeTab.path} title={activeTab.title} />
        ) : (
          <NoNoteOpen />
        )}
      </div>
    </div>
  )
}
