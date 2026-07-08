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
 * the real app — this is what lets a stale blur-after-unmount reach
 * TreeNode's onBlur handler.
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
    // renamingPath is what unmounts the <input> and is what triggers the
    // native blur-after-unmount this suite guards against.
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

describe('TreeNodeView inline rename', () => {
  it('commits exactly once on Enter, and a stale blur firing after the input unmounts does not re-commit', () => {
    const commitRename = vi.fn((_node, _newName) => {
      // Mirror Explorer.handleCommitRename: committing clears renamingPath,
      // which unmounts the <input> and is what triggers the native
      // blur-after-unmount this test guards against.
    })
    render(<Harness onCommitRename={commitRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(commitRename).toHaveBeenCalledTimes(1)
    expect(commitRename).toHaveBeenCalledWith(NODE, 'Renamed')

    // The input is gone from the DOM now (rename mode ended) — this is the
    // detached node a real browser would still fire a blur on.
    expect(screen.queryByDisplayValue('Renamed')).not.toBeInTheDocument()

    fireEvent.blur(input)

    expect(commitRename).toHaveBeenCalledTimes(1)
  })

  it('does not commit when the value is unchanged or blank, and blur after Enter still does not re-fire cancel', () => {
    const commitRename = vi.fn()
    const cancelRename = vi.fn()
    render(<Harness onCommitRename={commitRename} onCancelRename={cancelRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(commitRename).not.toHaveBeenCalled()
    expect(cancelRename).toHaveBeenCalledTimes(1)

    fireEvent.blur(input)

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(commitRename).not.toHaveBeenCalled()
  })

  it('cancels exactly once on Escape, and a stale blur after unmount does not re-fire commit or cancel', () => {
    const commitRename = vi.fn()
    const cancelRename = vi.fn()
    render(<Harness onCommitRename={commitRename} onCancelRename={cancelRename} />)

    const input = screen.getByDisplayValue('Note') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(commitRename).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('Renamed')).not.toBeInTheDocument()

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
