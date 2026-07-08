import { EditorHost } from '../editor/EditorHost'

export interface NoteViewProps {
  noteId: string
  path: string
  title: string
}

/**
 * Center-pane note view: the CodeMirror 6 live-preview editor (Task
 * W3). `key={noteId}` forces a full remount on tab switch — see
 * `EditorHost`'s doc comment for why that's simpler than teaching it to
 * handle a changing `noteId` mid-lifetime.
 */
export function NoteView({ noteId, path, title }: NoteViewProps) {
  return <EditorHost key={noteId} noteId={noteId} path={path} title={title} />
}
