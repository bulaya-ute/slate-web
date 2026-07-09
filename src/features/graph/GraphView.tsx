import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useFocusTrap } from '../../components/ui/useFocusTrap'
import type { GraphNode } from '../../lib/api/types'
import { useTabs } from '../tabs/tabs.store'
import { GraphCanvas } from './GraphCanvas'
import { useGraphQuery } from './useGraph'

export interface GraphViewProps {
  vaultId: string
  onClose: () => void
}

/**
 * Full-screen graph overlay (portaled, like `CommandPalette`/`Modal`) —
 * wide open canvas space is the point, so unlike those two this isn't a
 * centered dialog over a dim backdrop; it's opaque and fills the
 * viewport. Escape and the header's Close button both exit; clicking a
 * node opens it as a tab and closes the overlay (mirrors the quick
 * switcher's "select a result → back to the workspace" flow).
 */
export function GraphView({ vaultId, onClose }: GraphViewProps) {
  const { data, isLoading, isError, refetch } = useGraphQuery(vaultId)
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, true)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleOpenNote(node: GraphNode) {
    useTabs.getState().openTab(vaultId, { noteId: node.id, path: node.path, title: node.title })
    onClose()
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Graph view"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-bg outline-none animate-[fadeIn_150ms_ease-out]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-[14px] font-semibold text-text">Graph</h2>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-[12px] text-text-faint">
              {data.nodes.length} notes · {data.edges.length} links
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center" role="status" aria-label="Loading graph">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
        ) : isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-[13px] text-danger">Couldn&apos;t load the graph.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : data && data.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-[13px] font-medium text-text">No notes yet</p>
            <p className="max-w-xs text-[12px] text-text-faint">
              Create notes and link them with [[wikilinks]] to see them appear here.
            </p>
          </div>
        ) : data ? (
          <GraphCanvas nodes={data.nodes} edges={data.edges} onOpenNote={handleOpenNote} />
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
