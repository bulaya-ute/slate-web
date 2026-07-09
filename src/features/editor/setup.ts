import { autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tagCompletionSource } from './autocomplete/tagCompletion'
import { wikilinkCompletionSource } from './autocomplete/wikilinkCompletion'
import { livePreviewInteractions } from './extensions/interactions'
import { livePreviewTree } from './extensions/livePreviewTree'
import { wikilinksAndTags } from './extensions/wikilinksAndTags'
import { slateEditorTheme, slateHighlightStyle } from './theme'

export interface BuildEditorExtensionsOptions {
  /**
   * The `editorContext` facet extension and the read-only toggle, each
   * pre-wrapped in a `Compartment` by the caller (`EditorHost`) so it can
   * `dispatch` a reconfigure later — e.g. once the vault tree/tags
   * finish loading, or a save 409s into a conflict — without tearing
   * down and rebuilding the whole view (which would lose cursor/undo
   * history).
   */
  contextExtension: Extension
  readOnlyExtension: Extension
  /** Fired on every content-changing transaction — the caller debounces/saves. */
  onChange: (content: string) => void
  /** Ctrl+S / Cmd+S — skips the debounce and saves immediately. */
  onSave: () => void
}

/**
 * The full CM6 extension set for Slate's live-preview markdown editor.
 * Assembled in one place so `EditorHost` (the React wrapper) and any
 * future consumer (e.g. the conflict resolve view) build an identical
 * editor.
 */
export function buildEditorExtensions(options: BuildEditorExtensionsOptions): Extension[] {
  const { contextExtension, readOnlyExtension, onChange, onSave } = options

  return [
    contextExtension,
    readOnlyExtension,
    history(),
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
    syntaxHighlighting(slateHighlightStyle),
    slateEditorTheme,
    EditorView.lineWrapping,
    highlightSelectionMatches(),
    livePreviewTree,
    wikilinksAndTags,
    livePreviewInteractions(),
    autocompletion({
      override: [wikilinkCompletionSource, tagCompletionSource],
      icons: false,
    }),
    keymap.of([
      // Ahead of the rest so it wins over any other `Mod-s` binding, and
      // `preventDefault` so the browser's own "Save Page As" doesn't fire.
      { key: 'Mod-s', preventDefault: true, run: () => { onSave(); return true } },
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...markdownKeymap,
      ...historyKeymap,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString())
    }),
  ]
}
