import type MarkdownIt from 'markdown-it'

// `- [ ] …` / `- [x] …` — the literal leading marker markdown-it's own
// list parsing leaves untouched (task lists aren't part of CommonMark;
// GFM treats it as plain list-item text, same as markdown-it here).
const TASK_MARKER_RE = /^\[([ xX])\]\s+/

/**
 * Turns a list item whose text starts with `[ ]`/`[x]` into a disabled,
 * checked-state-reflecting checkbox in the split preview. Deliberately
 * *not* interactive here (unlike the CM6 live-preview editor) — the
 * markdown source is the single source of truth, and this pane is a
 * read-only rendering of it; toggling happens in the editor.
 */
export function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.push('task_list', (state) => {
    const { tokens } = state
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'list_item_open') continue

      // Tight lists (the common case) skip straight to `inline`; loose
      // lists wrap it in `paragraph_open` — either way, this is the
      // token whose text we need to peek at.
      let j = i + 1
      if (tokens[j]?.type === 'paragraph_open') j += 1
      const inline = tokens[j]
      if (!inline || inline.type !== 'inline' || !inline.children || inline.children.length === 0) continue

      const first = inline.children[0]
      if (first.type !== 'text') continue
      const match = TASK_MARKER_RE.exec(first.content)
      if (!match) continue

      const checked = match[1].toLowerCase() === 'x'
      first.content = first.content.slice(match[0].length)

      const checkbox = new state.Token('html_inline', '', 0)
      checkbox.content = `<input type="checkbox" class="task-list-checkbox" disabled${checked ? ' checked' : ''} />`
      inline.children.unshift(checkbox)

      tokens[i].attrJoin('class', checked ? 'task-list-item task-list-item-done' : 'task-list-item')
    }
  })
}
