import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useTabs } from '../tabs/tabs.store'
import { useTagNotes, useVaultTags } from './useVaultTags'

export interface TagsPaneProps {
  vaultId: string
}

function TagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M1.5 6.6V2.7c0-.7.5-1.2 1.2-1.2h3.9c.3 0 .6.1.8.3l4.5 4.5c.4.4.4 1 0 1.4L8.2 11.4c-.4.4-1 .4-1.4 0L2.3 6.9c-.2-.2-.3-.5-.3-.8Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="4.2" r="0.8" fill="currentColor" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M7.5 2.5 3 6l4.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 py-3" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}

/**
 * Left-sidebar tags view: flat alphabetical tag list with counts, click
 * drills into the notes carrying that tag (`GET /tags/{tag}/notes`).
 * Mirrors the explorer's row styling so switching sidebar views doesn't
 * feel like a different app.
 */
export function TagsPane({ vaultId }: TagsPaneProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const { data: tags, isLoading, isError, refetch } = useVaultTags(vaultId)
  const notesQuery = useTagNotes(vaultId, selectedTag)

  if (selectedTag) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            aria-label="Back to tags"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-faint transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <BackIcon />
          </button>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">#{selectedTag}</span>
        </div>
        <div className="flex-1 overflow-auto">
          {notesQuery.isLoading ? (
            <ListSkeleton />
          ) : notesQuery.isError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <p className="text-[13px] text-danger">Couldn&apos;t load notes for this tag.</p>
              <Button size="sm" variant="secondary" onClick={() => void notesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : !notesQuery.data || notesQuery.data.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[12px] text-text-faint">No notes tagged #{selectedTag}.</p>
            </div>
          ) : (
            <ul className="flex flex-col py-1">
              {notesQuery.data.map((note) => (
                <li key={note.noteId}>
                  <button
                    type="button"
                    onClick={() =>
                      useTabs.getState().openTab(vaultId, { noteId: note.noteId, path: note.path, title: note.title })
                    }
                    className="flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    <span className="w-full truncate text-[13px] text-text">{note.title}</span>
                    <span className="w-full truncate text-[11px] text-text-faint">{note.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Tags</span>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[13px] text-danger">Couldn&apos;t load tags.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : !tags || tags.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-text">No tags yet</p>
            <p className="text-[12px] text-text-faint">Tag notes with #inline-tags or frontmatter to see them here.</p>
          </div>
        ) : (
          <ul className="flex flex-col py-1">
            {[...tags]
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
              .map((tag) => (
                <li key={tag.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedTag(tag.name)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[13px] text-text-muted transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    <TagIcon />
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    <span className="shrink-0 rounded-full bg-surface-active px-1.5 py-0.5 text-[11px] text-text-faint">
                      {tag.count}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
