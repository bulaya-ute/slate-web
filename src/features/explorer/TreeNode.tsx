import { type KeyboardEvent, useRef, useState } from 'react'
import type { NoteMeta } from '../../lib/api/types'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { type DragPayload, readDragPayload, setDragPayload } from './dnd'
import { isSameOrAncestor, type TreeNode as TreeNodeData } from './tree'

export interface ExplorerActions {
  isExpanded: (path: string) => boolean
  toggleExpand: (path: string) => void
  activeNoteId: string | null
  renamingPath: string | null
  startRename: (path: string) => void
  commitRename: (node: TreeNodeData, newName: string) => void
  cancelRename: () => void
  onOpenNote: (note: NoteMeta) => void
  onNewNote: (folderPath: string) => void
  onNewFolder: (folderPath: string) => void
  onDelete: (node: TreeNodeData) => void
  /** `source` is the dragged item (from its drag payload); `destinationFolder` is the drop target's path (`""` = vault root). */
  onMove: (source: DragPayload, destinationFolder: string) => void
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="shrink-0">
      {open ? (
        <path
          d="M1.5 4.2c0-.6.5-1.1 1.1-1.1h2.9l1 1.3h5.9c.6 0 1.1.5 1.1 1.1v.2H2.7c-.5 0-1 .3-1.1.8L.8 11V4.2Z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M1.5 4.1c0-.6.5-1.1 1.1-1.1h2.9l1 1.3h5.9c.6 0 1.1.5 1.1 1.1v5.5c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1V4.1Z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3.5 1.5h5L11 4v8a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8.5 1.5v2.2a.8.8 0 0 0 .8.8H11" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-text-faint transition-transform duration-150 ease-out ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M3 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface TreeNodeProps {
  node: TreeNodeData
  depth: number
  actions: ExplorerActions
}

/** A single explorer row — folder (with children) or note leaf — and its context menu / drag-drop / inline-rename behavior. */
export function TreeNodeView({ node, depth, actions }: TreeNodeProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const isFolder = node.type === 'folder'
  const isRenaming = actions.renamingPath === node.path
  const isActive = node.type === 'note' && node.note.id === actions.activeNoteId
  const expanded = isFolder && actions.isExpanded(node.path)

  function openMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  function handleActivate() {
    if (isFolder) actions.toggleExpand(node.path)
    else actions.onOpenNote(node.note)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isRenaming) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleActivate()
    } else if (e.key === 'F2') {
      e.preventDefault()
      setRenameValue(node.name)
      actions.startRename(node.path)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      actions.onDelete(node)
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      setMenu({ x: rect.left + 16, y: rect.bottom })
    }
  }

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) actions.commitRename(node, trimmed)
    else actions.cancelRename()
  }

  function handleDragStart(e: React.DragEvent) {
    setDragPayload(e, { path: node.path, kind: node.type })
  }

  function isValidDropHere(payload: DragPayload | null): boolean {
    if (!payload || !isFolder) return false
    if (payload.path === node.path) return false
    if (payload.kind === 'folder' && isSameOrAncestor(payload.path, node.path)) return false
    return true
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFolder) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOver) setDragOver(true)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const payload = readDragPayload(e)
    if (!isValidDropHere(payload)) return
    actions.onMove(payload!, node.path)
  }

  const menuItems: ContextMenuItem[] = isFolder
    ? [
        { label: 'New note', onSelect: () => actions.onNewNote(node.path) },
        { label: 'New folder', onSelect: () => actions.onNewFolder(node.path) },
        {
          label: 'Rename',
          onSelect: () => {
            setRenameValue(node.name)
            actions.startRename(node.path)
          },
        },
        { label: 'Delete', onSelect: () => actions.onDelete(node), danger: true },
      ]
    : [
        {
          label: 'Rename',
          onSelect: () => {
            setRenameValue(node.name)
            actions.startRename(node.path)
          },
        },
        { label: 'Delete', onSelect: () => actions.onDelete(node), danger: true },
      ]

  return (
    <div role={isFolder ? 'group' : undefined}>
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? expanded : undefined}
        aria-selected={isActive || undefined}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isRenaming && handleActivate()}
        onContextMenu={openMenu}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={
          'flex cursor-pointer items-center gap-1.5 rounded-sm py-1 pr-2 text-[13px] transition-colors duration-150 ease-out ' +
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ' +
          (isActive ? 'bg-surface-active text-text' : 'text-text-muted hover:bg-surface-hover hover:text-text') +
          (dragOver ? ' outline outline-2 outline-[var(--color-accent)]' : '')
        }
      >
        {isFolder ? <ChevronIcon expanded={expanded} /> : <span className="w-2.5 shrink-0" />}
        {isFolder ? <FolderIcon open={expanded} /> : <NoteIcon />}
        {isRenaming ? (
          <input
            ref={inputRef}
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                actions.cancelRename()
              }
            }}
            className="min-w-0 flex-1 rounded-sm border border-accent bg-bg px-1 py-0 text-[13px] text-text outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}
        {node.type === 'note' && node.note.hasConflict && (
          <span
            role="img"
            aria-label="This note has a sync conflict"
            title="Sync conflict"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
          />
        )}
      </div>

      {isFolder && expanded && (
        <div>
          {node.children.length === 0 ? (
            <p
              style={{ paddingLeft: 8 + (depth + 1) * 16 + 20 }}
              className="py-1 text-[12px] text-text-faint"
            >
              Empty folder
            </p>
          ) : (
            node.children.map((child) => (
              <TreeNodeView key={child.path} node={child} depth={depth + 1} actions={actions} />
            ))
          )}
        </div>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
