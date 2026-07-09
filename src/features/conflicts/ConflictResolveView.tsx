import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { DiffTable } from './DiffTable'
import { buildDiffRows } from './diffHunks'
import { useConflictBlobsQuery, useFreshHeadContent, useNoteConflicts, useResolveNoteMutation } from './useConflicts'

export interface ConflictResolveViewProps {
  vaultId: string
  noteId: string
  path: string
  onCancel: () => void
  /** Called once the resolve request succeeds — caller re-opens the note as a normal (unfrozen) editor. */
  onResolved: () => void
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * The conflict resolve UI: fetches every pending conflict blob for this
 * note plus a fresh read of the current server head, renders a
 * side-by-side line diff against whichever conflicting version is
 * selected, and lets the user either quick-fill the merge box from one
 * side or hand-edit it before submitting `POST /notes/{id}/resolve`.
 *
 * Rendered in place of the editor body (`EditorHost` swaps to this when
 * its "Resolve conflict" banner button is clicked) rather than as a
 * portaled overlay — there's no background page to shield focus from,
 * so this doesn't need `useFocusTrap` the way `GraphView`/`SettingsPanel`
 * do.
 */
export function ConflictResolveView({ vaultId, noteId, path, onCancel, onResolved }: ConflictResolveViewProps) {
  const conflicts = useNoteConflicts(vaultId, noteId)
  const head = useFreshHeadContent(noteId)
  const blobQueries = useConflictBlobsQuery(conflicts ?? [])
  const resolveMutation = useResolveNoteMutation(vaultId)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mergedContent, setMergedContent] = useState<string | null>(null)

  // Seed the merge box with the current head once it's loaded — a safe
  // default (resolving without touching it just keeps head content and
  // clears the conflict flag).
  useEffect(() => {
    if (mergedContent === null && head.data) setMergedContent(head.data.content)
  }, [mergedContent, head.data])

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max((conflicts?.length ?? 1) - 1, 0)))
  }, [conflicts?.length])

  const selectedConflict = conflicts?.[selectedIndex] ?? null
  const selectedBlob = blobQueries[selectedIndex]

  const rows = useMemo(() => {
    if (!head.data || selectedBlob?.data === undefined) return []
    return buildDiffRows(head.data.content, selectedBlob.data)
  }, [head.data, selectedBlob?.data])

  const isLoading = conflicts === undefined || head.isLoading || (selectedBlob?.isLoading ?? false)

  function handleResolve() {
    if (!conflicts || conflicts.length === 0 || mergedContent === null) return
    resolveMutation.mutate(
      { noteId, body: { content: mergedContent, resolvedRevIds: conflicts.map((c) => c.revId) } },
      { onSuccess: onResolved },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold text-text">Resolve conflict</h2>
          <p className="truncate text-[12px] text-text-faint">{path}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back to editor
        </Button>
      </div>

      {conflicts && conflicts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-[13px] font-medium text-text">No pending conflicts</p>
          <p className="text-[12px] text-text-faint">
            This note&apos;s conflicts were already resolved — probably by another device.
          </p>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Back to editor
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 flex-col gap-2 px-4 py-3" role="status" aria-label="Loading conflict">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {conflicts && conflicts.length > 1 && (
            <div role="tablist" aria-label="Conflicting versions" className="flex gap-1 border-b border-border px-3 py-1.5">
              {conflicts.map((c, i) => (
                <button
                  key={c.revId}
                  type="button"
                  role="tab"
                  aria-selected={i === selectedIndex}
                  onClick={() => setSelectedIndex(i)}
                  className={
                    'rounded-sm px-2 py-1 text-[12px] transition duration-150 ease-out ' +
                    (i === selectedIndex
                      ? 'bg-surface-active text-text'
                      : 'text-text-faint hover:bg-surface-hover hover:text-text')
                  }
                >
                  Version {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-[12px] text-text-muted">
            <span>
              From device <span className="font-medium text-text">{selectedConflict?.deviceId}</span>
            </span>
            {selectedConflict && <span>{formatTimestamp(selectedConflict.createdAt)}</span>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => head.data && setMergedContent(head.data.content)}>
                Use current version
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => selectedBlob?.data !== undefined && setMergedContent(selectedBlob.data)}
              >
                Use their version
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <DiffTable rows={rows} leftLabel="Current (this device)" rightLabel="Conflicting version" />
          </div>

          <div className="border-t border-border px-4 py-3">
            <label htmlFor="conflict-merged-content" className="mb-1 block text-[12px] font-medium text-text-muted">
              Merged result
            </label>
            <textarea
              id="conflict-merged-content"
              value={mergedContent ?? ''}
              onChange={(e) => setMergedContent(e.target.value)}
              spellCheck={false}
              className="h-36 w-full resize-y rounded-md border border-border bg-bg-inset p-2 font-mono text-[12px] text-text outline-none transition duration-150 ease-out focus-visible:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button loading={resolveMutation.isPending} onClick={handleResolve}>
              Resolve conflict
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
