import { create } from 'zustand'

/**
 * What the rest of the app (outline panel, command palette) is allowed
 * to ask the currently-mounted CM6 editor to do — a narrow, explicit
 * surface instead of reaching into `EditorView` internals from outside
 * the editor feature. `WorkspaceMain` only ever mounts one `EditorHost`
 * at a time (one active tab), so "the" active editor is unambiguous;
 * `EditorHost` registers itself on mount and clears itself on unmount
 * (see its own effect for the `noteId` guard against a stale
 * clear-after-reopen race, mirroring `AutosaveManager`'s identity
 * checks).
 */
export interface ActiveEditorController {
  noteId: string
  /** Moves the cursor to (and scrolls to) the given 1-based source line — what `headingParser` produces. */
  scrollToLine: (line: number) => void
  /** Shows/hides the split markdown preview pane. */
  togglePreview: () => void
}

interface ActiveEditorState {
  controller: ActiveEditorController | null
  setActiveEditor: (controller: ActiveEditorController) => void
  /** No-ops unless `noteId` still matches the currently-registered controller (stale-unmount guard). */
  clearActiveEditor: (noteId: string) => void
}

export const useActiveEditor = create<ActiveEditorState>((set, get) => ({
  controller: null,
  setActiveEditor: (controller) => set({ controller }),
  clearActiveEditor: (noteId) => {
    if (get().controller?.noteId === noteId) set({ controller: null })
  },
}))
