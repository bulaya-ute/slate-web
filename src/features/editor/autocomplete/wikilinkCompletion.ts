import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { editorContext, type NoteIndexEntry } from '../editorContext'

// Matches an *unclosed* `[[query` immediately before the cursor. Deliberately
// excludes `]`/`|` from the query, same reasoning as the markdown-it plugin's
// wikilink regex — a stray earlier `[[` should never swallow the rest of the line.
const WIKILINK_QUERY_RE = /\[\[([^\]\n|]*)$/

function matchesQuery(entry: NoteIndexEntry, query: string): boolean {
  if (query.length === 0) return true
  const q = query.toLowerCase()
  return entry.title.toLowerCase().includes(q) || entry.path.toLowerCase().includes(q)
}

function toCompletion(entry: NoteIndexEntry): Completion {
  return {
    label: entry.title,
    detail: entry.path,
    type: 'text',
    apply: (view, _completion, from, to) => {
      // If `]]` already follows (e.g. the user typed the closing brackets
      // themselves), don't double them up. Either way, land the cursor
      // right after the path — before the closing brackets — so a `|alias`
      // can still be typed without arrow-keying past them.
      const closed = view.state.sliceDoc(to, to + 2) === ']]'
      const insert = closed ? entry.path : `${entry.path}]]`
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + entry.path.length },
      })
    },
  }
}

/** Wikilink autocomplete — triggers on `[[`, matches vault note titles + paths. */
export function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(WIKILINK_QUERY_RE)
  if (!match) return null
  const queryMatch = WIKILINK_QUERY_RE.exec(match.text)
  const query = queryMatch?.[1] ?? ''

  const ctx = context.state.facet(editorContext)
  const options = ctx
    .getNoteIndex()
    .filter((entry) => matchesQuery(entry, query))
    .slice(0, 50)
    .map(toCompletion)

  if (options.length === 0) return null

  return {
    from: match.from + 2, // past the literal `[[`
    options,
    filter: false, // already filtered above; the index can be large enough that re-filtering is wasted work
    validFor: /^[^\]\n|]*$/,
  }
}
