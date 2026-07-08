import MarkdownIt from 'markdown-it'
import type { EditorContextValue } from '../editorContext'
import { highlightPlugin } from './plugins/highlightPlugin'
import { taskListPlugin } from './plugins/taskListPlugin'
import { wikilinkPlugin } from './plugins/wikilinkPlugin'

/**
 * Builds a markdown-it instance for the split preview pane, wired to the
 * same vault-scoped resolution (`resolveWikilink`/`resolveAttachmentSrc`)
 * the CM6 live-preview widgets use — one source of truth for "does this
 * link resolve", shared by both renderings of the note.
 */
export function createPreviewMarkdownIt(context: EditorContextValue): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

  md.use(wikilinkPlugin, {
    resolve: (target) => {
      const hit = context.resolveWikilink(target)
      return hit ? { path: hit.path, title: hit.title } : null
    },
    embedSrc: (target) => context.resolveAttachmentSrc(target),
  })
  md.use(taskListPlugin)
  md.use(highlightPlugin)

  return md
}
