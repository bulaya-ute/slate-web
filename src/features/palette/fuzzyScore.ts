/**
 * A small, dependency-free fuzzy matcher for the command palette (quick
 * switcher over note titles/paths, and the command list). No library —
 * the brief asks for "own fuzzy scorer (subsequence match +
 * word-boundary bonus)", which is all either use case needs.
 *
 * Matching rule: every character of `query` must appear in `target`,
 * in order, but not necessarily contiguously (a "subsequence" match —
 * `"dn"` matches `"Daily Notes"` via the D and the N). Non-matches
 * (query has a character that never appears in the right order) return
 * `matched: false`.
 *
 * Scoring, highest to lowest priority:
 *  1. An exact (case-insensitive) full-string match always wins.
 *  2. Otherwise, characters matched right at a "word boundary" — the
 *     very start of the string, or right after a separator
 *     (space/-/_/./ etc.), or a lower→upper camelCase transition —
 *     score a bonus, so `"pn"` ranks `"Project Notes"` above
 *     `"Open Fund"` even though both are 2-character subsequence
 *     matches of the same length.
 *  3. Runs of *consecutive* matched characters score an increasing
 *     bonus, so a contiguous match like `"note"` in `"note.md"` beats
 *     a scattered one like `"note"` in `"n-o-t-e.md"`.
 *  4. A small penalty scales with target length, so among otherwise
 *     equal matches the shorter/more-specific target ranks first.
 */

export interface FuzzyMatchResult {
  matched: boolean
  score: number
}

const NO_MATCH: FuzzyMatchResult = { matched: false, score: -Infinity }

const EXACT_MATCH_SCORE = 1_000_000
const BASE_CHAR_SCORE = 10
const BOUNDARY_BONUS = 15
const CONSECUTIVE_BONUS_STEP = 5
const CONSECUTIVE_BONUS_CAP = 25
const LENGTH_PENALTY_PER_CHAR = 0.1

function isWordSeparator(char: string): boolean {
  return /[\s\-_./\\:]/.test(char)
}

/** True when `target[index]` starts a "word" — string start, after a separator, or a camelCase hump. */
function isBoundary(target: string, index: number): boolean {
  if (index === 0) return true
  const prev = target[index - 1]
  if (isWordSeparator(prev)) return true
  const curr = target[index]
  return prev === prev.toLowerCase() && curr === curr.toUpperCase() && curr !== curr.toLowerCase()
}

/**
 * Scores `query` as a fuzzy subsequence match against `target`.
 * Case-insensitive throughout. Returns `{ matched: false, score:
 * -Infinity }` when `query` isn't a subsequence of `target` at all.
 */
export function fuzzyScore(query: string, target: string): FuzzyMatchResult {
  if (query.length === 0) return { matched: true, score: 0 }
  if (target.length === 0) return NO_MATCH

  const q = query.toLowerCase()
  const t = target.toLowerCase()

  if (q === t) return { matched: true, score: EXACT_MATCH_SCORE }

  let qi = 0
  let score = 0
  let consecutiveRun = 0
  let matchedLastChar = false

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      matchedLastChar = false
      continue
    }

    let charScore = BASE_CHAR_SCORE
    if (isBoundary(target, ti)) charScore += BOUNDARY_BONUS
    if (matchedLastChar) {
      consecutiveRun += 1
      charScore += Math.min(consecutiveRun * CONSECUTIVE_BONUS_STEP, CONSECUTIVE_BONUS_CAP)
    } else {
      consecutiveRun = 0
    }

    score += charScore
    matchedLastChar = true
    qi += 1
  }

  if (qi < q.length) return NO_MATCH // ran out of target before matching every query char — order matters

  score -= target.length * LENGTH_PENALTY_PER_CHAR
  return { matched: true, score }
}

export interface RankedEntry<T> {
  item: T
  score: number
}

/**
 * Scores every item in `items` against `query` (via `getText`) and
 * returns only the matches, sorted best-first. An empty `query`
 * matches everything with score 0, preserving `items`' own order — the
 * command palette's "show everything, ranked, until you type" state.
 */
export function rankEntries<T>(
  query: string,
  items: readonly T[],
  getText: (item: T) => string,
  limit?: number,
): RankedEntry<T>[] {
  const trimmed = query.trim()
  if (!trimmed) {
    const all = items.map((item) => ({ item, score: 0 }))
    return limit ? all.slice(0, limit) : all
  }

  const results: RankedEntry<T>[] = []
  for (const item of items) {
    const { matched, score } = fuzzyScore(trimmed, getText(item))
    if (matched) results.push({ item, score })
  }
  results.sort((a, b) => b.score - a.score)
  return limit ? results.slice(0, limit) : results
}

export interface QuickSwitchEntry {
  noteId: string
  title: string
  path: string
}

/** A path-only match ranks below an equivalent title match by this much. */
const PATH_MATCH_PENALTY = 20

/**
 * Ranks notes for the `Ctrl/Cmd+P` quick switcher: matches against
 * title and path both (so `folder/note` prefixes are searchable), title
 * matches win ties, best match per note wins, sorted best-first.
 */
export function rankNotes(query: string, notes: readonly QuickSwitchEntry[], limit = 50): RankedEntry<QuickSwitchEntry>[] {
  const trimmed = query.trim()
  if (!trimmed) return notes.slice(0, limit).map((item) => ({ item, score: 0 }))

  const results: RankedEntry<QuickSwitchEntry>[] = []
  for (const note of notes) {
    const titleMatch = fuzzyScore(trimmed, note.title)
    const pathMatch = fuzzyScore(trimmed, note.path)

    let best = -Infinity
    let matched = false
    if (titleMatch.matched) {
      best = titleMatch.score
      matched = true
    }
    if (pathMatch.matched) {
      const pathScore = pathMatch.score - PATH_MATCH_PENALTY
      if (pathScore > best) best = pathScore
      matched = true
    }

    if (matched) results.push({ item: note, score: best })
  }
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}
