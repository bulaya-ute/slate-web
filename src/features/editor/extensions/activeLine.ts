import type { EditorState } from '@codemirror/state'

/**
 * The Obsidian live-preview rule this whole editor is built around:
 * inline markdown syntax (bold/italic/strike marks, wikilink brackets,
 * heading `#`s, …) renders live *except* on whichever line(s) the
 * cursor/selection currently touches — there, the raw source shows so
 * you can edit it. This computes that set once per relevant state
 * change; every decoration builder below consults it instead of
 * re-deriving it per node.
 */
export function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number
    const toLine = state.doc.lineAt(range.to).number
    for (let n = fromLine; n <= toLine; n++) lines.add(n)
  }
  return lines
}

/** Whether any line touched by `[from, to)` is an active (cursor) line. */
export function isRangeActive(state: EditorState, from: number, to: number, active: Set<number>): boolean {
  const fromLine = state.doc.lineAt(from).number
  const toLine = state.doc.lineAt(Math.max(from, to - 1)).number
  for (let n = fromLine; n <= toLine; n++) {
    if (active.has(n)) return true
  }
  return false
}
