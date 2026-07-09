import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface EditorPrefsState {
  /** Whether newly-opened notes start with the split markdown preview already showing. */
  defaultSplitPreview: boolean
  setDefaultSplitPreview: (value: boolean) => void
}

/**
 * Small, deliberately narrow editor preferences store — the brief asks
 * for "whatever's cheap to add", not a full settings schema. Read once
 * by `EditorHost` to seed `showPreview`'s initial value; per-note preview
 * toggling still works exactly as before and doesn't write back here.
 */
export const useEditorPrefs = create<EditorPrefsState>()(
  persist(
    (set) => ({
      defaultSplitPreview: false,
      setDefaultSplitPreview: (value) => set({ defaultSplitPreview: value }),
    }),
    { name: 'slate.editor-prefs' },
  ),
)
