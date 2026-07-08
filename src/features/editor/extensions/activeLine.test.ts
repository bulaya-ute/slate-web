import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { activeLineNumbers, isRangeActive } from './activeLine'

function stateWithCursor(doc: string, anchor: number, head = anchor): EditorState {
  return EditorState.create({ doc, selection: { anchor, head } })
}

describe('activeLineNumbers', () => {
  it('returns just the one line number a collapsed cursor sits on', () => {
    const state = stateWithCursor('one\ntwo\nthree', 5) // "two", line 2
    expect(activeLineNumbers(state)).toEqual(new Set([2]))
  })

  it('returns every line spanned by a multi-line selection', () => {
    const state = EditorState.create({ doc: 'one\ntwo\nthree', selection: { anchor: 1, head: 10 } })
    expect(activeLineNumbers(state)).toEqual(new Set([1, 2, 3]))
  })

  it('unions the lines of multiple selection ranges', () => {
    const state = EditorState.create({
      doc: 'one\ntwo\nthree\nfour',
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(9)]),
      // Multiple selection ranges are otherwise silently collapsed to the primary one.
      extensions: [EditorState.allowMultipleSelections.of(true)],
    })
    expect(activeLineNumbers(state)).toEqual(new Set([1, 3]))
  })
})

describe('isRangeActive', () => {
  it('is true when the range is on the (only) active line', () => {
    const state = stateWithCursor('hello world', 2)
    const active = activeLineNumbers(state)
    expect(isRangeActive(state, 6, 11, active)) // "world" is on line 1, same as the cursor
      .toBe(true)
  })

  it('is false when the range is on a different line than the cursor', () => {
    const state = stateWithCursor('one\ntwo\nthree', 1) // line 1
    const active = activeLineNumbers(state)
    expect(isRangeActive(state, 4, 7, active)).toBe(false) // "two" is line 2
  })
})
