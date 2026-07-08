import { Facet } from '@codemirror/state'

/** One entry of the vault's note index — what wikilink resolution/autocomplete need. */
export interface NoteIndexEntry {
  noteId: string
  path: string
  title: string
}

/**
 * Everything the live-preview decorations/widgets/autocomplete need but
 * can't get from `EditorState` alone: vault-scoped data (the note
 * index, tag list), how to reach the files endpoint for embeds, and
 * callbacks back out to the app (opening a note).
 *
 * Provided as a CM6 `Facet` so any extension can read it via
 * `view.state.facet(editorContext)` without prop-drilling through every
 * decoration/widget constructor.
 */
export interface EditorContextValue {
  vaultId: string
  /** Resolves a wikilink target (path or title, case-insensitive) to a known note, or null. */
  resolveWikilink: (target: string) => NoteIndexEntry | null
  /** Current note index snapshot, for autocomplete. */
  getNoteIndex: () => NoteIndexEntry[]
  /** Current known tag names (no leading `#`), for autocomplete. */
  getTagIndex: () => string[]
  /** Builds a fetchable URL for a vault-relative attachment path (embeds). */
  resolveAttachmentSrc: (path: string) => string
  /** Open a note by id — `newTab` mirrors Obsidian's Ctrl/Cmd+click ("open in background"). */
  onOpenNote: (noteId: string, opts: { newTab: boolean }) => void
}

export const editorContext = Facet.define<EditorContextValue, EditorContextValue>({
  combine: (values) => values[values.length - 1],
})
