import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveVault } from '../../stores/activeVault'
import { useTabs } from '../tabs/tabs.store'
import { useBacklinks } from './useBacklinks'

export interface BacklinksPanelProps {
  noteId: string | null
}

/** Right-sidebar section: notes that link to the currently open note, with a plain-text context snippet. */
export function BacklinksPanel({ noteId }: BacklinksPanelProps) {
  const vaultId = useActiveVault((s) => s.activeVaultId)
  const { data, isLoading, isError, refetch } = useBacklinks(noteId)

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border">
      <div className="shrink-0 border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Backlinks</span>
      </div>
      <div className="flex-1 overflow-auto">
        {!noteId ? (
          <p className="px-3 py-4 text-[12px] text-text-faint">Open a note to see what links here.</p>
        ) : isLoading ? (
          <div className="flex flex-col gap-2 px-3 py-3" role="status" aria-label="Loading backlinks">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-2 px-3 py-3">
            <p className="text-[12px] text-danger">Couldn&apos;t load backlinks.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-text-faint">No notes link here yet.</p>
        ) : (
          <ul className="flex flex-col py-1">
            {data.map((link) => (
              <li key={link.noteId}>
                <button
                  type="button"
                  onClick={() =>
                    vaultId &&
                    useTabs.getState().openTab(vaultId, { noteId: link.noteId, path: link.path, title: link.title })
                  }
                  className="flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <span className="w-full truncate text-[12.5px] font-medium text-text">{link.title}</span>
                  {link.contextSnippet && (
                    <span className="line-clamp-2 w-full text-[11.5px] leading-snug text-text-faint">
                      {link.contextSnippet}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
