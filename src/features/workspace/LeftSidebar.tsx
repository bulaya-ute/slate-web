import type { ReactElement } from 'react'
import { Tooltip } from '../../components/ui/Tooltip'
import { useActiveVault } from '../../stores/activeVault'
import { Explorer } from '../explorer/Explorer'
import { SearchPane } from '../search/SearchPane'
import { TagsPane } from '../tags/TagsPane'
import { VaultSwitcher } from '../vaults/VaultSwitcher'
import { useSidebarView, type SidebarView } from './sidebarView.store'

function FilesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M1.8 4.2c0-.6.5-1.1 1.1-1.1h2.9l1 1.3h5.9c.6 0 1.1.5 1.1 1.1v5.5c0 .6-.5 1.1-1.1 1.1H2.9c-.6 0-1.1-.5-1.1-1.1V4.2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchNavIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.6" cy="6.6" r="4.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="m10.1 10.1 3.1 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function TagsNavIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M1.8 7.6V3.2c0-.8.6-1.4 1.4-1.4h4.4c.4 0 .7.1.9.4l5 5c.5.5.5 1.2 0 1.6l-4.5 4.5c-.5.5-1.2.5-1.6 0l-5-5c-.3-.2-.4-.5-.6-.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="4.6" cy="4.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

const VIEWS: { id: SidebarView; label: string; Icon: () => ReactElement }[] = [
  { id: 'files', label: 'Files', Icon: FilesIcon },
  { id: 'search', label: 'Search', Icon: SearchNavIcon },
  { id: 'tags', label: 'Tags', Icon: TagsNavIcon },
]

/**
 * The left sidebar's full contents: the vault switcher (pinned above
 * every sub-view, not just the file tree, so switching to Search/Tags
 * never hides which vault you're in), a view switcher, and whichever
 * sub-view is active. Explorer/Search/Tags are siblings here rather
 * than nested routes — sidebar state (scroll position, expanded
 * folders, in-progress tag drill-down) is cheap enough to just keep
 * mounted-or-not per `SidebarView`, no need for real routing.
 */
export function LeftSidebar() {
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const view = useSidebarView((s) => s.view)
  const setView = useSidebarView((s) => s.setView)

  return (
    <div className="flex h-full flex-col">
      <VaultSwitcher />

      {activeVaultId && (
        <>
          <div role="tablist" aria-label="Sidebar view" className="flex gap-0.5 border-t border-b border-border px-2 py-1">
            {VIEWS.map(({ id, label, Icon }) => (
              <Tooltip key={id} content={label}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  aria-label={label}
                  onClick={() => setView(id)}
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-sm transition duration-150 ease-out ' +
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] ' +
                    (view === id
                      ? 'bg-surface-active text-text'
                      : 'text-text-faint hover:bg-surface-hover hover:text-text')
                  }
                >
                  <Icon />
                </button>
              </Tooltip>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {view === 'files' && <Explorer />}
            {view === 'search' && <SearchPane vaultId={activeVaultId} />}
            {view === 'tags' && <TagsPane vaultId={activeVaultId} />}
          </div>
        </>
      )}
    </div>
  )
}
