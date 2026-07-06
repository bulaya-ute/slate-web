import { useState } from 'react'
import { readDragPayload } from './dnd'
import { TreeNodeView, type ExplorerActions } from './TreeNode'
import type { TreeNode } from './tree'

export interface TreeViewProps {
  nodes: TreeNode[]
  actions: ExplorerActions
  /** Dropping onto the empty space below the list moves an item back to the vault root. */
  onDropToRoot: (source: { path: string; kind: 'folder' | 'note' }) => void
}

/** Renders the (already-nested) tree plus a root-level drop target for "move back to top level". */
export function TreeView({ nodes, actions, onDropToRoot }: TreeViewProps) {
  const [rootDragOver, setRootDragOver] = useState(false)

  return (
    <div
      role="tree"
      aria-label="Vault files"
      className="flex min-h-full flex-col py-1"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!rootDragOver) setRootDragOver(true)
      }}
      onDragLeave={() => setRootDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setRootDragOver(false)
        const payload = readDragPayload(e)
        if (payload) onDropToRoot(payload)
      }}
    >
      {nodes.map((node) => (
        <TreeNodeView key={node.path} node={node} depth={0} actions={actions} />
      ))}
      {/* Flex-grow spacer: dropping here (below the last row) moves an item to the vault root. */}
      <div className={`min-h-8 flex-1 ${rootDragOver ? 'outline outline-2 -outline-offset-2 outline-[var(--color-accent)]' : ''}`} />
    </div>
  )
}
