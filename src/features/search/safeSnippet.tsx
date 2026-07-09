import type { ReactElement } from 'react'

const MARK_TOKEN = /<mark>|<\/mark>/g

/**
 * The search endpoint's `snippetHtml` is the one place the server sends
 * this client raw HTML — a plain-text snippet with `<mark>…</mark>`
 * wrapped around matched terms. Everywhere else in the app, content
 * from the server is markdown/plain text rendered through React (which
 * escapes it) or through CodeMirror/markdown-it, which own their own
 * sanitization.
 *
 * Rather than trust that invariant and `dangerouslySetInnerHTML` it,
 * this parses the string itself: text is split only on the literal
 * tokens `<mark>` / `</mark>`, alternating between plain and
 * highlighted runs. Anything else that looks like a tag (an errant
 * `<script>`, a stray `<b>`, …) is never treated as markup — it's
 * just characters inside a run, which React renders as an escaped text
 * node like any other string. So even a compromised or buggy server
 * response can't inject markup or scripts through this path; the
 * output is provably limited to `<mark>` (or nothing at all).
 */
export function renderSnippet(snippetHtml: string): ReactElement[] {
  const nodes: ReactElement[] = []
  let marking = false
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  MARK_TOKEN.lastIndex = 0
  while ((match = MARK_TOKEN.exec(snippetHtml)) !== null) {
    const text = snippetHtml.slice(lastIndex, match.index)
    if (text) {
      nodes.push(marking ? <mark key={key++}>{text}</mark> : <span key={key++}>{text}</span>)
    }
    marking = match[0] === '<mark>'
    lastIndex = MARK_TOKEN.lastIndex
  }

  const rest = snippetHtml.slice(lastIndex)
  if (rest) {
    nodes.push(marking ? <mark key={key++}>{rest}</mark> : <span key={key++}>{rest}</span>)
  }

  return nodes
}

export interface SearchSnippetProps {
  html: string
  className?: string
}

/** Renders a search result's `snippetHtml` through `renderSnippet` — never `dangerouslySetInnerHTML`. */
export function SearchSnippet({ html, className }: SearchSnippetProps) {
  return <span className={className}>{renderSnippet(html)}</span>
}
