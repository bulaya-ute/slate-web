import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveVault } from '../../stores/activeVault'
import { useNoteContentQuery } from '../notes/useNoteContent'
import { autosaveManager } from '../sync/syncManager'
import { useAutosaveStatus } from '../sync/useAutosaveStatus'
import { useTabs } from '../tabs/tabs.store'
import { editorContext, type EditorContextValue } from './editorContext'
import { MarkdownPreview } from './markdownPreview/MarkdownPreview'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import { buildEditorExtensions } from './setup'
import { useEditorContextValue } from './useEditorContextValue'

export interface EditorHostProps {
  noteId: string
  path: string
  title: string
}

/**
 * The CM6 live-preview editor for one open note. Fetches its content
 * once — the `X-Rev-Id` that comes back becomes the autosave loop's
 * initial `baseRevId` — mounts a CM6 `EditorView` imperatively (CM6 owns
 * its own DOM; there's no useful React re-render path for editor
 * content), and wires every edit into `autosaveManager`.
 *
 * Callers remount this on note switch (`<EditorHost key={noteId} .../>`
 * in `NoteView`) rather than have it handle a changing `noteId`
 * mid-lifetime — simpler, and switching notes recreating the view is
 * indistinguishable from opening it fresh anyway.
 */
export function EditorHost({ noteId, path, title }: EditorHostProps) {
  const vaultId = useActiveVault((s) => s.activeVaultId)
  const { data, isLoading, isError, refetch } = useNoteContentQuery(noteId)
  const context = useEditorContextValue(vaultId ?? '')
  const saveState = useAutosaveStatus(noteId)
  const [showPreview, setShowPreview] = useState(false)
  const [liveContent, setLiveContent] = useState('')

  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contextCompartment = useRef(new Compartment()).current
  const readOnlyCompartment = useRef(new Compartment()).current

  // Read via refs inside the mount effect below so it only needs to
  // fire once content is available, not on every render these values
  // change (context updates as the tree/tags queries resolve; the
  // conflict flag flips independently) — both are kept live via the
  // reconfigure effects further down instead.
  const contextRef = useRef<EditorContextValue>(context)
  contextRef.current = context
  const showPreviewRef = useRef(showPreview)
  showPreviewRef.current = showPreview

  useEffect(() => {
    if (!data || !hostRef.current) return

    autosaveManager.open(noteId, data.revId)
    setLiveContent(data.content)

    const onChange = (content: string) => {
      if (showPreviewRef.current) setLiveContent(content)
      autosaveManager.notifyChange(noteId, content)
      if (vaultId) useTabs.getState().setDirty(vaultId, noteId, true)
    }

    const state = EditorState.create({
      doc: data.content,
      extensions: buildEditorExtensions({
        contextExtension: contextCompartment.of(editorContext.of(contextRef.current)),
        readOnlyExtension: readOnlyCompartment.of([]),
        onChange,
      }),
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
      autosaveManager.close(noteId)
    }
    // `data` (the initial fetch) and `noteId` are the only things that
    // should tear down/recreate the view — see the component doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, noteId])

  // Keep the live-preview facet's data current as the vault tree/tags
  // queries resolve or change, without rebuilding the view.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: contextCompartment.reconfigure(editorContext.of(context)) })
  }, [context, contextCompartment])

  // A conflicted note is frozen until W5's resolve UI lands — further
  // local edits would otherwise be silently unsaved.
  useEffect(() => {
    const readOnly = saveState.status === 'conflict'
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnly ? [EditorView.editable.of(false), EditorState.readOnly.of(true)] : []),
    })
  }, [saveState.status, readOnlyCompartment])

  // Tab dirty dot: set the instant an edit lands, cleared once the save
  // loop confirms it landed on the server.
  useEffect(() => {
    if (vaultId && saveState.status === 'saved') useTabs.getState().setDirty(vaultId, noteId, false)
  }, [saveState.status, vaultId, noteId])

  // Syncs the preview pane to whatever's currently in the editor the
  // moment it's revealed (edits made while it was hidden weren't pushed
  // to `liveContent`, to avoid a re-render of this whole tree per keystroke).
  useEffect(() => {
    if (showPreview && viewRef.current) setLiveContent(viewRef.current.state.doc.toString())
  }, [showPreview])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold text-text">{title}</h1>
          <p className="truncate text-[12px] text-text-faint">{path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatusIndicator status={saveState.status} />
          <Button size="sm" variant={showPreview ? 'secondary' : 'ghost'} onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Hide preview' : 'Preview'}
          </Button>
        </div>
      </div>

      {saveState.status === 'conflict' && (
        <div className="border-b border-border bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-2 text-[13px] text-danger">
          This note changed elsewhere since your last save. It's read-only for now — conflict resolution is
          coming in a later update.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex w-full flex-col gap-2 px-4 py-3" role="status" aria-label="Loading note">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isError ? (
          <div className="flex w-full flex-col items-center gap-2 py-10 text-center">
            <p className="text-[13px] text-danger">Couldn&apos;t load this note.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={hostRef}
              className={showPreview ? 'h-full w-1/2 overflow-hidden border-r border-border' : 'h-full w-full overflow-hidden'}
            />
            {showPreview && (
              <div className="h-full w-1/2 overflow-auto">
                <MarkdownPreview content={liveContent} context={context} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
