import { useMemo } from 'react'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveEditor } from '../editor/activeEditorController'
import { useNoteContentQuery } from '../notes/useNoteContent'
import { parseHeadings } from './headingParser'

export interface OutlinePanelProps {
  noteId: string | null
}

const INDENT_PER_LEVEL = 12

/**
 * Right-sidebar section: headings parsed from the currently open note's
 * content, click scrolls the editor there. Reads content via the same
 * `useNoteContentQuery` the editor seeds its CM6 doc from (see that
 * hook's doc comment for why it's given a `staleTime` — this panel is
 * exactly the second observer that comment describes), and reaches the
 * editor to scroll only through `activeEditorController`'s narrow
 * interface, never CM6 internals directly.
 */
export function OutlinePanel({ noteId }: OutlinePanelProps) {
  const { data, isLoading } = useNoteContentQuery(noteId)
  const controller = useActiveEditor((s) => s.controller)
  const headings = useMemo(() => parseHeadings(data?.content ?? ''), [data?.content])

  function handleSelect(line: number) {
    if (controller && controller.noteId === noteId) controller.scrollToLine(line)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Outline</span>
      </div>
      <div className="flex-1 overflow-auto">
        {!noteId ? (
          <p className="px-3 py-4 text-[12px] text-text-faint">Open a note to see its outline.</p>
        ) : isLoading ? (
          <div className="flex flex-col gap-2 px-3 py-3" role="status" aria-label="Loading outline">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        ) : headings.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-text-faint">This note has no headings.</p>
        ) : (
          <ul className="flex flex-col py-1">
            {headings.map((heading, index) => (
              <li key={`${heading.line}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(heading.line)}
                  style={{ paddingLeft: 12 + (heading.level - 1) * INDENT_PER_LEVEL }}
                  className="block w-full truncate py-1 pr-3 text-left text-[12.5px] text-text-muted transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
