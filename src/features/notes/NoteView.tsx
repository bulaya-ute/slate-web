import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useNoteContentQuery } from './useNoteContent'

export interface NoteViewProps {
  noteId: string
  path: string
  title: string
}

/**
 * Placeholder center-pane note view: fetches and displays raw markdown
 * content read-only. Task W3 replaces the content area below the header
 * with the CodeMirror 6 editor; the header/loading/error/query
 * plumbing here is meant to carry over largely unchanged.
 */
export function NoteView({ noteId, path, title }: NoteViewProps) {
  const { data, isLoading, isError, refetch } = useNoteContentQuery(noteId)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold text-text">{title}</h1>
          <p className="truncate text-[12px] text-text-faint">{path}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading note">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-[13px] text-danger">Couldn&apos;t load this note.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
            {data}
          </pre>
        )}
      </div>
    </div>
  )
}
