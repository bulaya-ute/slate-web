import { describe, expect, it } from 'vitest'
import type { NoteMeta, VaultTree } from '../../lib/api/types'
import {
  buildTree,
  computeMoveDestination,
  isSameOrAncestor,
  rewritePathPrefix,
  type FolderNode,
  type NoteNode,
} from './tree'

function note(path: string, overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id: `id:${path}`,
    path,
    title: overrides.title ?? path,
    hasConflict: false,
    sizeBytes: 100,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildTree', () => {
  it('returns an empty array for an empty vault', () => {
    const tree: VaultTree = { folders: [], notes: [] }
    expect(buildTree(tree)).toEqual([])
  })

  it('builds flat top-level notes with no folders', () => {
    const tree: VaultTree = { folders: [], notes: [note('Alpha.md'), note('beta.md')] }
    const result = buildTree(tree)
    expect(result).toHaveLength(2)
    expect(result.map((n) => n.name)).toEqual(['Alpha', 'beta'])
    expect(result.every((n) => n.type === 'note')).toBe(true)
  })

  it('includes empty folders that appear only in the folders[] array', () => {
    const tree: VaultTree = { folders: ['Empty Folder'], notes: [] }
    const result = buildTree(tree)
    expect(result).toHaveLength(1)
    const [folder] = result as [FolderNode]
    expect(folder.type).toBe('folder')
    expect(folder.path).toBe('Empty Folder')
    expect(folder.name).toBe('Empty Folder')
    expect(folder.children).toEqual([])
  })

  it('nests folders arbitrarily deep and attaches notes to their containing folder', () => {
    const tree: VaultTree = {
      folders: ['A', 'A/B', 'A/B/C'],
      notes: [note('A/B/C/note.md')],
    }
    const result = buildTree(tree)
    expect(result).toHaveLength(1)
    const a = result[0] as FolderNode
    expect(a.path).toBe('A')
    expect(a.children).toHaveLength(1)
    const b = a.children[0] as FolderNode
    expect(b.path).toBe('A/B')
    expect(b.children).toHaveLength(1)
    const c = b.children[0] as FolderNode
    expect(c.path).toBe('A/B/C')
    expect(c.children).toHaveLength(1)
    const leaf = c.children[0] as NoteNode
    expect(leaf.type).toBe('note')
    expect(leaf.path).toBe('A/B/C/note.md')
    expect(leaf.name).toBe('note')
  })

  it('infers intermediate folders from a note path even if folders[] only lists the leaf', () => {
    // Defensive: the contract says folders[] carries the folder list, but a
    // client shouldn't fall over if a containing dir was only implied by a note.
    const tree: VaultTree = { folders: [], notes: [note('Projects/Q1/plan.md')] }
    const result = buildTree(tree)
    expect(result).toHaveLength(1)
    const projects = result[0] as FolderNode
    expect(projects.path).toBe('Projects')
    const q1 = projects.children[0] as FolderNode
    expect(q1.path).toBe('Projects/Q1')
    expect(q1.children).toHaveLength(1)
    expect((q1.children[0] as NoteNode).path).toBe('Projects/Q1/plan.md')
  })

  it('sorts folders before notes at the same level regardless of alphabetical order', () => {
    const tree: VaultTree = {
      folders: ['Zeta'],
      notes: [note('Alpha.md')],
    }
    const result = buildTree(tree)
    expect(result.map((n) => n.type)).toEqual(['folder', 'note'])
    expect(result.map((n) => n.name)).toEqual(['Zeta', 'Alpha'])
  })

  it('sorts alphabetically (case-insensitive) within each group, at every depth', () => {
    const tree: VaultTree = {
      folders: ['banana', 'Apple', 'Apple/sub'],
      notes: [note('banana/z.md'), note('banana/a.md')],
    }
    const result = buildTree(tree)
    expect(result.map((n) => n.name)).toEqual(['Apple', 'banana'])
    const banana = result[1] as FolderNode
    expect(banana.children.map((n) => n.name)).toEqual(['a', 'z'])
  })

  it('strips a trailing .md extension from note display names but not folder names', () => {
    const tree: VaultTree = { folders: ['notes.md-ish'], notes: [note('README.md')] }
    const result = buildTree(tree)
    const folder = result.find((n) => n.type === 'folder') as FolderNode
    const noteNode = result.find((n) => n.type === 'note') as NoteNode
    expect(folder.name).toBe('notes.md-ish')
    expect(noteNode.name).toBe('README')
  })

  it('carries the full NoteMeta (incl. hasConflict) on note nodes', () => {
    const conflicted = note('conflict.md', { hasConflict: true })
    const tree: VaultTree = { folders: [], notes: [conflicted] }
    const result = buildTree(tree)
    const noteNode = result[0] as NoteNode
    expect(noteNode.note).toEqual(conflicted)
    expect(noteNode.note.hasConflict).toBe(true)
  })

  it('tolerates folders[] entries with leading/trailing slashes', () => {
    const tree: VaultTree = { folders: ['/Sloppy/', '/Sloppy/Child/'], notes: [] }
    const result = buildTree(tree)
    expect(result).toHaveLength(1)
    const sloppy = result[0] as FolderNode
    expect(sloppy.path).toBe('Sloppy')
    expect(sloppy.children[0].path).toBe('Sloppy/Child')
  })

  it('does not duplicate a folder that is listed both explicitly and implied by a note', () => {
    const tree: VaultTree = { folders: ['Docs'], notes: [note('Docs/index.md')] }
    const result = buildTree(tree)
    expect(result).toHaveLength(1)
    const docs = result[0] as FolderNode
    expect(docs.children).toHaveLength(1)
  })
})

describe('isSameOrAncestor', () => {
  it('is true for the identical path', () => {
    expect(isSameOrAncestor('A/B', 'A/B')).toBe(true)
  })

  it('is true for a real ancestor', () => {
    expect(isSameOrAncestor('A', 'A/B/C')).toBe(true)
  })

  it('is false for an unrelated path, including a same-prefix sibling', () => {
    expect(isSameOrAncestor('A/B', 'A/Bee')).toBe(false)
    expect(isSameOrAncestor('A/B', 'A/C')).toBe(false)
  })

  it('is false when checked in the wrong direction', () => {
    expect(isSameOrAncestor('A/B/C', 'A')).toBe(false)
  })
})

describe('computeMoveDestination', () => {
  it('moves a top-level note into a folder', () => {
    expect(computeMoveDestination('note.md', 'Archive')).toBe('Archive/note.md')
  })

  it('moves a nested note to the vault root', () => {
    expect(computeMoveDestination('Projects/note.md', '')).toBe('note.md')
  })

  it('moves a nested note into a different nested folder', () => {
    expect(computeMoveDestination('Projects/Q1/note.md', 'Projects/Q2')).toBe('Projects/Q2/note.md')
  })

  it('moves a folder (by its own path) into another folder', () => {
    expect(computeMoveDestination('Old/Sub', 'New')).toBe('New/Sub')
  })
})

describe('rewritePathPrefix', () => {
  it('rewrites the exact matching path', () => {
    expect(rewritePathPrefix('A/B', 'A/B', 'A/C')).toBe('A/C')
  })

  it('rewrites descendants of a renamed folder', () => {
    expect(rewritePathPrefix('A/B/note.md', 'A/B', 'A/Renamed')).toBe('A/Renamed/note.md')
  })

  it('leaves unrelated paths untouched', () => {
    expect(rewritePathPrefix('A/Other/note.md', 'A/B', 'A/Renamed')).toBe('A/Other/note.md')
  })

  it('does not rewrite a sibling that merely shares a prefix string', () => {
    expect(rewritePathPrefix('A/Bee/note.md', 'A/B', 'A/Renamed')).toBe('A/Bee/note.md')
  })
})
