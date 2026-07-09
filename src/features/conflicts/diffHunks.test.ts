import { describe, expect, it } from 'vitest'
import { buildDiffRows, hasDiff } from './diffHunks'

describe('buildDiffRows', () => {
  it('classifies identical content as entirely unchanged', () => {
    const rows = buildDiffRows('a\nb\nc\n', 'a\nb\nc\n')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'unchanged', left: 'b', right: 'b' },
      { type: 'unchanged', left: 'c', right: 'c' },
    ])
    expect(hasDiff(rows)).toBe(false)
  })

  it('classifies a pure addition as an added-only row, preserving surrounding unchanged lines', () => {
    const rows = buildDiffRows('a\nc\n', 'a\nb\nc\n')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'added', left: null, right: 'b' },
      { type: 'unchanged', left: 'c', right: 'c' },
    ])
    expect(hasDiff(rows)).toBe(true)
  })

  it('classifies a pure removal as a removed-only row', () => {
    const rows = buildDiffRows('a\nb\nc\n', 'a\nc\n')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'removed', left: 'b', right: null },
      { type: 'unchanged', left: 'c', right: 'c' },
    ])
  })

  it('pairs a same-position line change (removed immediately followed by added) as modified', () => {
    const rows = buildDiffRows('title: A\nbody\n', 'title: B\nbody\n')
    expect(rows).toEqual([
      { type: 'modified', left: 'title: A', right: 'title: B' },
      { type: 'unchanged', left: 'body', right: 'body' },
    ])
  })

  it('pairs the overlapping lines of a mismatched-length block as modified, spilling the rest as removed', () => {
    // head has 3 lines replaced by 1 line in the other content
    const rows = buildDiffRows('a\nx\ny\nz\nb\n', 'a\nreplacement\nb\n')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'modified', left: 'x', right: 'replacement' },
      { type: 'removed', left: 'y', right: null },
      { type: 'removed', left: 'z', right: null },
      { type: 'unchanged', left: 'b', right: 'b' },
    ])
  })

  it('pairs the overlapping lines of a mismatched-length block as modified, spilling the rest as added', () => {
    // head has 1 line replaced by 3 lines in the other content
    const rows = buildDiffRows('a\nx\nb\n', 'a\np\nq\nr\nb\n')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'modified', left: 'x', right: 'p' },
      { type: 'added', left: null, right: 'q' },
      { type: 'added', left: null, right: 'r' },
      { type: 'unchanged', left: 'b', right: 'b' },
    ])
  })

  it('handles content with no trailing newline without an empty trailing line', () => {
    const rows = buildDiffRows('a\nb', 'a\nb')
    expect(rows).toEqual([
      { type: 'unchanged', left: 'a', right: 'a' },
      { type: 'unchanged', left: 'b', right: 'b' },
    ])
  })

  it('handles fully empty input', () => {
    expect(buildDiffRows('', '')).toEqual([])
  })

  it('handles one side empty (brand-new content on the other side)', () => {
    const rows = buildDiffRows('', 'a\nb\n')
    expect(rows).toEqual([
      { type: 'added', left: null, right: 'a' },
      { type: 'added', left: null, right: 'b' },
    ])
  })

  it('preserves document order across multiple separate change blocks', () => {
    const rows = buildDiffRows('1\n2\n3\n4\n5\n', '1\nTWO\n3\nFOUR\n5\n')
    expect(rows.map((r) => [r.type, r.left, r.right])).toEqual([
      ['unchanged', '1', '1'],
      ['modified', '2', 'TWO'],
      ['unchanged', '3', '3'],
      ['modified', '4', 'FOUR'],
      ['unchanged', '5', '5'],
    ])
  })
})

describe('hasDiff', () => {
  it('is false only when every row is unchanged', () => {
    expect(hasDiff([{ type: 'unchanged', left: 'a', right: 'a' }])).toBe(false)
    expect(hasDiff([{ type: 'unchanged', left: 'a', right: 'a' }, { type: 'added', left: null, right: 'b' }])).toBe(
      true,
    )
  })
})
