import { diffLines } from 'diff'

export type DiffRowType = 'unchanged' | 'added' | 'removed' | 'modified'

export interface DiffRow {
  type: DiffRowType
  /** Head-side (left column) line text, or null when this row has nothing on that side. */
  left: string | null
  /** Other-side (right column) line text, or null when this row has nothing on that side. */
  right: string | null
}

/** Splits a diff `Change.value` into its constituent lines, dropping the trailing empty string a trailing "\n" produces. */
function toLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Maps the `diff` package's line-level `Change[]` output (`diffLines`)
 * into side-by-side rows for the conflict resolve view: `left` is the
 * head content (this vault's current server copy), `right` is the
 * conflicting blob from another device.
 *
 * A removed block immediately followed by an added block reads as
 * "these lines became those lines" — paired row-by-row as `modified`
 * (both columns filled) instead of rendering as an unrelated stack of
 * removals then additions, which is what a naive block-by-block walk
 * would produce. A block-length mismatch spills over as plain
 * `removed`/`added` rows past the shorter side.
 */
export function buildDiffRows(headContent: string, otherContent: string): DiffRow[] {
  const changes = diffLines(headContent, otherContent)
  const rows: DiffRow[] = []

  let i = 0
  while (i < changes.length) {
    const change = changes[i]

    if (!change.added && !change.removed) {
      for (const line of toLines(change.value)) rows.push({ type: 'unchanged', left: line, right: line })
      i += 1
      continue
    }

    if (change.removed) {
      const removedLines = toLines(change.value)
      const next = changes[i + 1]
      const addedLines = next?.added ? toLines(next.value) : []
      const pairCount = Math.min(removedLines.length, addedLines.length)

      for (let j = 0; j < pairCount; j++) {
        rows.push({ type: 'modified', left: removedLines[j], right: addedLines[j] })
      }
      for (let j = pairCount; j < removedLines.length; j++) {
        rows.push({ type: 'removed', left: removedLines[j], right: null })
      }
      for (let j = pairCount; j < addedLines.length; j++) {
        rows.push({ type: 'added', left: null, right: addedLines[j] })
      }

      i += next?.added ? 2 : 1
      continue
    }

    // A bare `added` block with no preceding `removed` block.
    for (const line of toLines(change.value)) rows.push({ type: 'added', left: null, right: line })
    i += 1
  }

  return rows
}

/** True if any row differs — a "these are identical" empty-diff state uses this to skip the diff UI. */
export function hasDiff(rows: DiffRow[]): boolean {
  return rows.some((r) => r.type !== 'unchanged')
}
