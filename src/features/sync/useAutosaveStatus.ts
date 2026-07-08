import { useSyncExternalStore } from 'react'
import type { AutosaveNoteState } from './autosave'
import { autosaveManager } from './syncManager'

const DEFAULT_STATE: AutosaveNoteState = { status: 'saved', conflict: null }

/** Live save status for one note — drives the header indicator + conflict banner. */
export function useAutosaveStatus(noteId: string | null): AutosaveNoteState {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!noteId) return () => {}
      return autosaveManager.subscribe(noteId, onStoreChange)
    },
    () => (noteId ? autosaveManager.getState(noteId) : DEFAULT_STATE),
  )
}
