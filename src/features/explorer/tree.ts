import type { NoteMeta, VaultTree } from '../../lib/api/types'

/**
 * Client-built tree from the server's flat `GET /vaults/{v}/tree` response
 * (`{ folders: string[], notes: NoteMeta[] }`). Paths are vault-relative,
 * forward-slash, no leading slash (e.g. `folder/note.md`) per the API
 * contract.
 */

export interface FolderNode {
  type: 'folder'
  /** Vault-relative path, no leading/trailing slash. */
  path: string
  /** Display name — the final path segment. */
  name: string
  children: TreeNode[]
}

export interface NoteNode {
  type: 'note'
  path: string
  /** Display name — filename with a trailing `.md` stripped. */
  name: string
  note: NoteMeta
}

export type TreeNode = FolderNode | NoteNode

/** Strips a leading/trailing slash so callers can't accidentally create `""`-segment paths. */
function normalizeFolderPath(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('/')) s = s.slice(1)
  while (s.endsWith('/')) s = s.slice(0, -1)
  return s
}

/** Parent directory of a vault-relative path; `""` means "vault root". */
export function parentOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

/** Final path segment. */
export function baseOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

export function stripMdExtension(name: string): string {
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name
}

/** Folders sort before notes; within a group, names compare case-insensitively (numeric-aware). */
function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

function sortTree(nodes: TreeNode[]): void {
  nodes.sort(compareNodes)
  for (const node of nodes) {
    if (node.type === 'folder') sortTree(node.children)
  }
}

/**
 * Builds a nested tree from the flat `{ folders, notes }` response.
 *
 * Folder nodes come from the union of:
 *  - every path in `folders[]` (this is the *only* source for folders
 *    that contain no notes — an empty folder has no note whose parent
 *    dir would otherwise imply it), and
 *  - every ancestor directory of every note path, defensively, in case
 *    a note's containing folder is ever omitted from `folders[]`.
 *
 * Folders sort before notes at every level; both groups sort
 * alphabetically (case-insensitive, numeric-aware).
 */
export function buildTree(tree: VaultTree): TreeNode[] {
  const folderPaths = new Set<string>()

  function addFolderAndAncestors(path: string): void {
    let cur = normalizeFolderPath(path)
    while (cur) {
      folderPaths.add(cur)
      cur = parentOf(cur)
    }
  }

  for (const f of tree.folders) addFolderAndAncestors(f)
  for (const n of tree.notes) {
    const dir = parentOf(n.path)
    if (dir) addFolderAndAncestors(dir)
  }

  const folderNodes = new Map<string, FolderNode>()
  for (const path of folderPaths) {
    folderNodes.set(path, { type: 'folder', path, name: baseOf(path), children: [] })
  }

  const roots: TreeNode[] = []

  for (const node of folderNodes.values()) {
    const parent = parentOf(node.path)
    if (parent && folderNodes.has(parent)) {
      folderNodes.get(parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  for (const n of tree.notes) {
    const node: NoteNode = { type: 'note', path: n.path, name: stripMdExtension(baseOf(n.path)), note: n }
    const dir = parentOf(n.path)
    const parentFolder = dir ? folderNodes.get(dir) : undefined
    if (parentFolder) {
      parentFolder.children.push(node)
    } else {
      roots.push(node)
    }
  }

  sortTree(roots)
  return roots
}

/** True if `maybeAncestor` is `path` itself or a directory that contains it. */
export function isSameOrAncestor(maybeAncestor: string, path: string): boolean {
  const a = normalizeFolderPath(maybeAncestor)
  const p = normalizeFolderPath(path)
  return a === p || p.startsWith(`${a}/`)
}

/** Vault-relative destination path for moving `sourcePath` into `destinationFolder` (`""` = vault root). */
export function computeMoveDestination(sourcePath: string, destinationFolder: string): string {
  const base = baseOf(normalizeFolderPath(sourcePath) || sourcePath)
  const dir = normalizeFolderPath(destinationFolder)
  return dir ? `${dir}/${base}` : base
}

/** Renames `oldPath` (or any descendant of it, when it's a folder) to live under `newPath` instead. */
export function rewritePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) return newPrefix
  if (path.startsWith(`${oldPrefix}/`)) return `${newPrefix}${path.slice(oldPrefix.length)}`
  return path
}
