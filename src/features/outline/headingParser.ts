export interface HeadingEntry {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  /** 1-based line number within the source content — what `EditorHost`'s `scrollToLine` expects. */
  line: number
}

// ATX headings only (`# Heading` … `###### Heading`), optionally closed
// with trailing hashes (`## Heading ##`). Setext headings (`Heading` /
// `===`) aren't parsed — v1 scope, and CM6's markdown lang + the
// server's indexer both treat ATX as the primary heading form here too.
const ATX_HEADING = /^(#{1,6})(?:\s+(.*?))?\s*$/
const TRAILING_HASHES = /\s+#+\s*$/

// A fence opens/closes on a line whose (left-trimmed) content is a run
// of 3+ backticks or 3+ tildes; a closing fence must reuse the same
// character. Anything between an opener and its closer — including
// lines that look like ATX headings — is code, not structure.
const FENCE = /^(`{3,}|~{3,})/

export function parseHeadings(content: string): HeadingEntry[] {
  const lines = content.split(/\r\n|\r|\n/)
  const headings: HeadingEntry[] = []
  let fenceChar: string | null = null

  lines.forEach((rawLine, idx) => {
    const trimmedStart = rawLine.replace(/^ {0,3}/, '')
    const fenceMatch = trimmedStart.match(FENCE)

    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fenceChar === null) {
        fenceChar = marker
      } else if (marker === fenceChar) {
        fenceChar = null
      }
      // Fence delimiter lines are never headings either way.
      return
    }

    if (fenceChar !== null) return // inside a fenced code block — skip

    const match = trimmedStart.match(ATX_HEADING)
    if (!match) return
    const level = match[1].length as HeadingEntry['level']
    const text = (match[2] ?? '').replace(TRAILING_HASHES, '').trim()
    if (!text) return // bare `#` with no title isn't a real heading

    headings.push({ level, text, line: idx + 1 })
  })

  return headings
}
