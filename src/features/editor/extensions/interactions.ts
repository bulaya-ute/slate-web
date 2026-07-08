import { EditorView } from '@codemirror/view'
import { editorContext } from '../editorContext'

/**
 * Click handling for the two interactive live-preview widgets (wikilinks,
 * task checkboxes). Deliberately kept out of the widgets' own `toDOM` —
 * `EditorView.domEventHandlers` is CM6's documented pattern for widget
 * interactivity, since widget DOM stays inert (`ignoreEvent() => true`)
 * and every click is resolved fresh here against the *current* document,
 * so a stale closure over a since-shifted position is never possible.
 */
export function livePreviewInteractions() {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const target = event.target as HTMLElement | null
      if (!target) return false

      const wikilinkEl = target.closest<HTMLElement>('.cm-wikilink')
      if (wikilinkEl) {
        const linkTarget = wikilinkEl.dataset.wikilinkTarget
        if (!linkTarget) return false
        event.preventDefault()
        const ctx = view.state.facet(editorContext)
        const resolved = ctx.resolveWikilink(linkTarget)
        if (resolved) {
          ctx.onOpenNote(resolved.noteId, { newTab: event.ctrlKey || event.metaKey })
        }
        return true
      }

      const checkboxEl = target.closest<HTMLInputElement>('.cm-task-checkbox')
      if (checkboxEl) {
        const pos = Number(checkboxEl.dataset.pos)
        if (!Number.isFinite(pos)) return false
        event.preventDefault()
        const current = view.state.doc.sliceString(pos, pos + 1)
        const insert = current.toLowerCase() === 'x' ? ' ' : 'x'
        view.dispatch({ changes: { from: pos, to: pos + 1, insert } })
        return true
      }

      return false
    },
  })
}
