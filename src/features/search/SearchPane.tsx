import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useTabs } from '../tabs/tabs.store'
import { SearchSnippet } from './safeSnippet'
import { useSearch } from './useSearch'

export interface SearchPaneProps {
  vaultId: string
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="6.1" cy="6.1" r="4.1" stroke="currentColor" strokeWidth="1.3" />
      <path d="m9.3 9.3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-3 py-3" role="status" aria-label="Searching">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Left-sidebar search view: debounced full-text search (`GET /search`),
 * results render the server's `<mark>`-highlighted snippet via the
 * mark-only safe renderer (never `dangerouslySetInnerHTML`), click
 * opens the note.
 */
export function SearchPane({ vaultId }: SearchPaneProps) {
  const [query, setQuery] = useState('')
  const { data, isDebouncing, isFetching, isError, refetch, trimmedQuery } = useSearch(vaultId, query)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus when the pane becomes visible (switching to the Search
  // sidebar view) so typing works immediately, Obsidian/VSCode-style.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const showLoading = trimmedQuery.length > 0 && (isDebouncing || isFetching)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 focus-within:border-border-strong">
          <span className="text-text-faint">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            className="h-8 w-full min-w-0 bg-transparent text-[13px] text-text placeholder:text-text-faint outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {trimmedQuery.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-text">Search this vault</p>
            <p className="text-[12px] text-text-faint">Find notes by title or content.</p>
          </div>
        ) : showLoading ? (
          <ResultsSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[13px] text-danger">Search failed.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-text">No results</p>
            <p className="mt-1 text-[12px] text-text-faint">No notes match &ldquo;{trimmedQuery}&rdquo;.</p>
          </div>
        ) : (
          <ul className="flex flex-col py-1">
            {data.map((result) => (
              <li key={result.noteId}>
                <button
                  type="button"
                  onClick={() =>
                    useTabs
                      .getState()
                      .openTab(vaultId, { noteId: result.noteId, path: result.path, title: result.title })
                  }
                  className="flex w-full min-w-0 flex-col items-start gap-1 px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  <span className="w-full truncate text-[13px] font-medium text-text">{result.title}</span>
                  <span className="w-full truncate text-[11px] text-text-faint">{result.path}</span>
                  <SearchSnippet
                    html={result.snippetHtml}
                    className="line-clamp-2 w-full text-[12px] leading-snug text-text-muted [&_mark]:rounded-sm [&_mark]:bg-[color-mix(in_srgb,var(--color-accent)_35%,transparent)] [&_mark]:text-text [&_mark]:not-italic"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
