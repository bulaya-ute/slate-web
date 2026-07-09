import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tooltip } from '../../components/ui/Tooltip'
import type { NoteMeta } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useTabs } from '../tabs/tabs.store'
import type { DragPayload } from './dnd'
import { useExplorerStore } from './explorer.store'
import type { ExplorerActions } from './TreeNode'
import { TreeView } from './TreeView'
import {
  buildTree,
  baseOf,
  nextAvailableName,
  parentOf,
  stripMdExtension,
  type TreeNode,
  isSameOrAncestor,
  computeMoveDestination,
} from './tree'
import {
  useCreateFolder,
  useCreateNote,
  useDeleteFolder,
  useDeleteNote,
  useRenameFolder,
  useRenameNote,
  useTreeQuery,
} from './useTree'

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FolderPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.2 3.9c0-.5.4-1 1-1h2.6l.9 1.1h5.2c.5 0 1 .4 1 1v4.9c0 .5-.4 1-1 1H2.2c-.5 0-1-.4-1-1V3.9Z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path d="M7 6.3v3M5.5 7.8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

interface PendingDelete {
  node: TreeNode
}

/**
 * File explorer tree: root-level toolbar plus the tree view. The vault
 * switcher used to live at the top of this component; it's now hoisted
 * to `LeftSidebar` (pinned above all three sidebar sub-views — files,
 * search, tags — rather than only above this one).
 */
export function Explorer() {
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const vaultId = activeVaultId ?? ''

  const { data, isLoading, isError, refetch } = useTreeQuery(activeVaultId)
  const isExpanded = useExplorerStore((s) => s.isExpanded)
  const toggleFolder = useExplorerStore((s) => s.toggleFolder)
  const activeNoteId = useTabs((s) => (activeVaultId ? (s.byVault[activeVaultId]?.activeNoteId ?? null) : null))

  const createNote = useCreateNote(vaultId)
  const createFolder = useCreateFolder(vaultId)
  const renameNote = useRenameNote(vaultId)
  const renameFolder = useRenameFolder(vaultId)
  const deleteNote = useDeleteNote(vaultId)
  const deleteFolder = useDeleteFolder(vaultId)

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  if (!activeVaultId) return null

  function siblingNames(kind: 'folder' | 'note', folder: string): Set<string> {
    if (!data) return new Set()
    if (kind === 'folder') {
      return new Set(data.folders.filter((f) => parentOf(f) === folder).map((f) => baseOf(f)))
    }
    return new Set(data.notes.filter((n) => parentOf(n.path) === folder).map((n) => stripMdExtension(baseOf(n.path))))
  }

  function handleNewNote(folderPath: string) {
    const name = nextAvailableName(siblingNames('note', folderPath), 'Untitled')
    const path = folderPath ? `${folderPath}/${name}.md` : `${name}.md`
    createNote.mutate(
      { path, content: '' },
      {
        onSuccess: (created: NoteMeta) => {
          if (folderPath && !isExpanded(vaultId, folderPath)) toggleFolder(vaultId, folderPath)
          useTabs.getState().openTab(vaultId, { noteId: created.id, path: created.path, title: created.title })
        },
      },
    )
  }

  function handleNewFolder(folderPath: string) {
    const name = nextAvailableName(siblingNames('folder', folderPath), 'New Folder')
    const path = folderPath ? `${folderPath}/${name}` : name
    createFolder.mutate(path, {
      onSuccess: () => {
        if (folderPath && !isExpanded(vaultId, folderPath)) toggleFolder(vaultId, folderPath)
      },
    })
  }

  function handleCommitRename(node: TreeNode, newName: string) {
    setRenamingPath(null)
    const dir = parentOf(node.path)
    if (node.type === 'note') {
      const finalName = /\.md$/i.test(newName) ? newName : `${newName}.md`
      const newPath = dir ? `${dir}/${finalName}` : finalName
      if (newPath === node.path) return
      renameNote.mutate({ noteId: node.note.id, newPath })
    } else {
      const newPath = dir ? `${dir}/${newName}` : newName
      if (newPath === node.path) return
      renameFolder.mutate({ path: node.path, newPath })
    }
  }

  function handleDelete(node: TreeNode) {
    setPendingDelete({ node })
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const { node } = pendingDelete
    if (node.type === 'note') deleteNote.mutate({ noteId: node.note.id })
    else deleteFolder.mutate({ path: node.path })
    setPendingDelete(null)
  }

  function handleMove(source: DragPayload, destinationFolder: string) {
    if (source.kind === 'folder' && isSameOrAncestor(source.path, destinationFolder)) return
    const newPath = computeMoveDestination(source.path, destinationFolder)
    if (newPath === source.path) return
    if (source.kind === 'note') {
      const note = data?.notes.find((n) => n.path === source.path)
      if (note) renameNote.mutate({ noteId: note.id, newPath })
    } else {
      renameFolder.mutate({ path: source.path, newPath })
    }
  }

  const actions: ExplorerActions = {
    isExpanded: (path) => isExpanded(vaultId, path),
    toggleExpand: (path) => toggleFolder(vaultId, path),
    activeNoteId,
    renamingPath,
    startRename: (path) => setRenamingPath(path),
    commitRename: handleCommitRename,
    cancelRename: () => setRenamingPath(null),
    onOpenNote: (note) => useTabs.getState().openTab(vaultId, { noteId: note.id, path: note.path, title: note.title }),
    onNewNote: handleNewNote,
    onNewFolder: handleNewFolder,
    onDelete: handleDelete,
    onMove: handleMove,
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Files</span>
        <div className="flex gap-0.5">
          <Tooltip content="New note">
            <button
              type="button"
              aria-label="New note"
              onClick={() => handleNewNote('')}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-text-faint transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <PlusIcon />
            </button>
          </Tooltip>
          <Tooltip content="New folder">
            <button
              type="button"
              aria-label="New folder"
              onClick={() => handleNewFolder('')}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-text-faint transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <FolderPlusIcon />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 px-3 py-3" role="status" aria-label="Loading files">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[13px] text-danger">Couldn&apos;t load this vault&apos;s files.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : data && data.folders.length === 0 && data.notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-text">This vault is empty</p>
            <p className="text-[12px] text-text-faint">Create your first note or folder to get started.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleNewNote('')}>
                New note
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleNewFolder('')}>
                New folder
              </Button>
            </div>
          </div>
        ) : (
          <TreeView
            nodes={buildTree(data!)}
            actions={actions}
            onDropToRoot={(source) => handleMove(source, '')}
          />
        )}
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.node.type === 'folder' ? 'Delete folder?' : 'Delete note?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-text-muted">
          {pendingDelete?.node.type === 'folder'
            ? `"${pendingDelete.node.name}" and everything inside it will be deleted. This can't be undone.`
            : `"${pendingDelete?.node.name}" will be deleted. This can't be undone.`}
        </p>
      </Modal>
    </div>
  )
}
