import { useCallback, useMemo, type MouseEvent } from 'react'
import type { EditorContextValue } from '../editorContext'
import { createPreviewMarkdownIt } from './markdownIt'

export interface MarkdownPreviewProps {
  content: string
  context: EditorContextValue
}

/**
 * The toggleable split-preview pane: a plain rendering of the note
 * through markdown-it (+ wikilink/task/highlight plugins), independent
 * of the CM6 live-preview editor next to it. Read-only — task
 * checkboxes render disabled here; toggling one is done in the editor,
 * which is the actual source of truth for the note's content.
 */
export function MarkdownPreview({ content, context }: MarkdownPreviewProps) {
  const md = useMemo(() => createPreviewMarkdownIt(context), [context])
  const html = useMemo(() => md.render(content), [md, content])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const link = (event.target as HTMLElement).closest('a.wikilink')
      if (!link) return
      event.preventDefault()
      const target = link.getAttribute('data-wikilink-target')
      if (!target) return
      const resolved = context.resolveWikilink(target)
      if (!resolved) return
      context.onOpenNote(resolved.noteId, { newTab: event.ctrlKey || event.metaKey })
    },
    [context],
  )

  return (
    <div
      className="slate-markdown-preview h-full overflow-auto px-6 py-6"
      onClick={handleClick}
      // The HTML comes from our own markdown-it pipeline (`html: false`,
      // so raw HTML in the source is never passed through) rendering a
      // note the current user owns/has access to — not third-party input.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
