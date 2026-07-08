import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteMeta } from '../../lib/api/types'
import { TreeNodeView, type ExplorerActions } from './TreeNode'
import type { NoteNode } from './tree'

function note(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id: 'note-1',
    path: 'Note.md',
    title: 'Note',
    hasConflict: false,
    sizeBytes: 10,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const NODE: NoteNode = { type: 'note', path: 'Note.md', name: 'Note', note: note() }

/**
 * Minimal stand-in for Explorer's rename wiring: real `renamingPath` state so
 * that committing/cancelling actually unmounts the `<input>`, the same as in
 * the real app.
 */
function Harness({
  onCommitRename,
  onCancelRename,
}: {
  onCommitRename?: ExplorerActions['commitRename']
  onCancelRename?: ExplorerActions['cancelRename']
}) {
  const [renamingPath, setRenamingPath] = useState<string | null>(NODE.path)

  const actions: ExplorerActions = {
    isExpanded: () => false,
    toggleExpand: () => {},
    activeNoteId: null,
    renamingPath,
    startRename: (path) => setRenamingPath(path),
    // Mirrors Explorer.handleCommitRename/cancelRename: clearing
    // renamingPath is what unmounts the <input>.
    commitRename: (node, newName) => {
      setRenamingPath(null)
      onCommitRename?.(node, newName)
    },
    cancelRename: () => {
      setRenamingPath(null)
      onCancelRename?.()
    },
    onOpenNote: () => {},
    onNewNote: () => {},
    onNewFolder: () => {},
    onDelete: () => {},
    onMove: () => {},
  }

  return <TreeNodeView node={NODE} depth={0} actions={actions} />
}

/**
 * Stand-in for a *slow* parent: `renamingPath` is never cleared, so the
 * `<input>` stays mounted across commit/cancel — mimicking a parent whose
 * state update lags a tick behind (e.g. an optimistic update that hasn't
 * flushed yet). This matters because `fireEvent.blur()` only reaches React's
 * delegated `onBlur` when the target is still attached to the document; a
 * blur fired on an already-detached node never reaches it (its event path is
 * just `[target]`, and jsdom doesn't auto-fire blur on removal either). Using
 * this harness for the Enter/Escape-then-blur cases below means the
 * follow-up blur is a *real*, delegated blur on a still-mounted input — the
 * same shape of event `renameHandledRef` (TreeNode.tsx) exists to guard
 * against — so removing that guard makes these tests fail.
 */
function PersistentHarness({
  onCommitRename,
  onCancelRename,
}: {
  onCommitRename?: ExplorerActions['commitRename']
  onCancelRename?: ExplorerActions['cancelRename']
}) {
  const actions: ExplorerActions = {
    isExpanded: () => false,
    toggleExpand: () => {},
    activeNoteId: null,
    renamingPath: NODE.path,
    startRename: () => {},
    commitRename: (node, newName) => {
      onCommitRename?.(node, newName)
    },
    cancelRename: () => {
      onCancelRename?.()
    },
    onOpenNote: () => {},
    onNewNote: () => {},
    onNewFolder: () => {},
    onDelete: () => {},
    onMove: () => {},
  }

  return <TreeNodeView node={NODE} depth={0} actions={actions} />
}

describe('TreeNodeView inline rename', () => {
  it('commits exactly once on Enter, and a genuine blur right after (input still mounted) does not re-commit', () => {
    const commitRename = vi.fn()
    render(<PersistentHarness onCommitRename={commitRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(commitRename).toHaveBeenCalledTimes(1)
    expect(commitRename).toHaveBeenCalledWith(NODE, 'Renamed')

    // Unlike the real app, this harness deliberately keeps `renamingPath`
    // set, so the <input> is still attached to the document here.
    expect(input).toBeInTheDocument()

    // A real, delegated blur on the still-mounted input — not a no-op fired
    // on a detached node.
    fireEvent.blur(input)

    expect(commitRename).toHaveBeenCalledTimes(1)
  })

  it('does not commit when the value is unchanged or blank, and a genuine blur after Enter still does not re-fire cancel', () => {
    const commitRename = vi.fn()
    const cancelRename = vi.fn()
    render(<PersistentHarness onCommitRename={commitRename} onCancelRename={cancelRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(commitRename).not.toHaveBeenCalled()
    expect(cancelRename).toHaveBeenCalledTimes(1)

    fireEvent.blur(input)

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(commitRename).not.toHaveBeenCalled()
  })

  it('cancels exactly once on Escape, and a genuine blur after Escape does not re-fire commit or cancel', () => {
    const commitRename = vi.fn()
    const cancelRename = vi.fn()
    render(<PersistentHarness onCommitRename={commitRename} onCancelRename={cancelRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(commitRename).not.toHaveBeenCalled()

    fireEvent.blur(input)

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(commitRename).not.toHaveBeenCalled()
  })

  it('still commits via a genuine blur (no prior Enter/Escape) — clicking away commits the rename', () => {
    const commitRename = vi.fn()
    render(<Harness onCommitRename={commitRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.blur(input)

    expect(commitRename).toHaveBeenCalledTimes(1)
    expect(commitRename).toHaveBeenCalledWith(NODE, 'Renamed')
  })
})
