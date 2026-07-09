import { describe, expect, it } from 'vitest'
import { fuzzyScore, rankEntries, rankNotes } from './fuzzyScore'

describe('fuzzyScore', () => {
  it('matches an exact (case-insensitive) string with the highest possible score', () => {
    const exact = fuzzyScore('daily notes', 'Daily Notes')
    const prefix = fuzzyScore('daily notes', 'Daily Notes Archive')
    const subsequence = fuzzyScore('dn', 'Daily Notes')
    expect(exact.matched).toBe(true)
    expect(exact.score).toBeGreaterThan(prefix.score)
    expect(exact.score).toBeGreaterThan(subsequence.score)
  })

  it('matches non-contiguous subsequences in order', () => {
    const result = fuzzyScore('dn', 'Daily Notes')
    expect(result.matched).toBe(true)
    expect(result.score).toBeGreaterThan(-Infinity)
  })

  it('rejects a query whose characters appear out of order', () => {
    // "foobar" contains f, o, o, b, a, r — but no f appears *after* the
    // only b, so "bf" is not a subsequence even though both letters exist.
    expect(fuzzyScore('bf', 'foobar').matched).toBe(false)
    expect(fuzzyScore('fb', 'foobar').matched).toBe(true)
  })

  it('rejects a query with a character missing from the target entirely', () => {
    expect(fuzzyScore('xyz', 'Daily Notes').matched).toBe(false)
  })

  it('matches (and ranks) an empty query as matching everything with score 0', () => {
    expect(fuzzyScore('', 'anything')).toEqual({ matched: true, score: 0 })
  })

  it('scores a word-boundary match above an equivalent mid-word match — before/after', () => {
    // Both are 2-character subsequence matches of similar-length targets;
    // only difference is whether the matched letters sit at word starts.
    const boundaryMatch = fuzzyScore('pn', 'Project Notes') // P (start), N (after space)
    const midWordMatch = fuzzyScore('pn', 'Open Fund') // p and n both mid-word
    expect(boundaryMatch.matched).toBe(true)
    expect(midWordMatch.matched).toBe(true)
    expect(boundaryMatch.score).toBeGreaterThan(midWordMatch.score)
  })

  it('scores a camelCase hump as a word boundary', () => {
    const boundary = fuzzyScore('gh', 'GetHeadings') // G start, H at the camelCase hump
    const noBoundary = fuzzyScore('gh', 'longhand') // g and h both mid-word, no hump
    expect(boundary.score).toBeGreaterThan(noBoundary.score)
  })

  it('scores a contiguous run above a scattered match — before/after, boundary status held equal', () => {
    // Both matched runs start mid-word (preceded by a non-separator
    // lowercase letter, so neither gets a word-boundary bonus) — the
    // only variable is whether the four matched characters are
    // consecutive ("xnotex") or each separated by a filler letter
    // ("xnzoztzezx"), isolating the consecutive-run bonus specifically.
    const contiguous = fuzzyScore('note', 'xnotex')
    const scattered = fuzzyScore('note', 'xnzoztzezx')
    expect(contiguous.matched).toBe(true)
    expect(scattered.matched).toBe(true)
    expect(contiguous.score).toBeGreaterThan(scattered.score)
  })

  it('prefers a shorter target over a longer one for an otherwise-equal match', () => {
    const short = fuzzyScore('note', 'note')
    const withExtra = fuzzyScore('note', 'noted')
    // "note" vs "note" is an exact match (dominant tier) — compare two
    // *non-exact* matches instead so only the length penalty is in play.
    const shortPrefix = fuzzyScore('not', 'note')
    const longerPrefix = fuzzyScore('not', 'notebook')
    expect(short.score).toBe(1_000_000)
    expect(withExtra.matched).toBe(true)
    expect(shortPrefix.score).toBeGreaterThan(longerPrefix.score)
  })
})

describe('rankEntries', () => {
  it('orders a realistic candidate list with the best subsequence/boundary matches first', () => {
    const items = ['Notepad.md', 'notes/Daily Notes.md', 'Meeting Notes.md', 'zzz-unrelated.md']
    const ranked = rankEntries('notes', items, (s) => s)
    expect(ranked.map((r) => r.item)).not.toContain('zzz-unrelated.md')
    // "Daily Notes.md" and "Meeting Notes.md" both contain "notes" as a
    // contiguous, word-boundary-started run ("Notes"); "Notepad.md" only
    // shares a shorter contiguous prefix ("Note") before diverging into a
    // scattered match for the trailing "s". Both exact substring hits
    // should rank above the scattered one.
    const top2 = ranked.slice(0, 2).map((r) => r.item)
    expect(top2).toContain('notes/Daily Notes.md')
    expect(top2).toContain('Meeting Notes.md')
  })

  it('returns everything unranked (score 0), in original order, for an empty query', () => {
    const items = ['b', 'a', 'c']
    expect(rankEntries('', items, (s) => s)).toEqual([
      { item: 'b', score: 0 },
      { item: 'a', score: 0 },
      { item: 'c', score: 0 },
    ])
  })

  it('excludes non-matching items entirely', () => {
    const items = ['alpha', 'beta', 'gamma']
    const ranked = rankEntries('xyz', items, (s) => s)
    expect(ranked).toEqual([])
  })
})

describe('rankNotes', () => {
  it('ranks a title match above a path-only match for the same query', () => {
    const notes = [
      // No "r" anywhere in the title, so this can only match via its path.
      { noteId: '1', title: 'Old Notes', path: 'archive/old/roadmap-notes.md' },
      { noteId: '2', title: 'Project Roadmap', path: 'planning/Project Roadmap.md' },
    ]
    const ranked = rankNotes('roadmap', notes)
    expect(ranked.map((r) => r.item.noteId)).toEqual(['2', '1'])
  })

  it('still surfaces a note that only matches by path', () => {
    const notes = [{ noteId: '1', title: 'Untitled', path: 'projects/roadmap.md' }]
    const ranked = rankNotes('roadmap', notes)
    expect(ranked.map((r) => r.item.noteId)).toEqual(['1'])
  })

  it('drops notes that match neither title nor path', () => {
    const notes = [{ noteId: '1', title: 'Grocery List', path: 'home/grocery-list.md' }]
    expect(rankNotes('roadmap', notes)).toEqual([])
  })
})
