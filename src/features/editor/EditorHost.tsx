import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useActiveVault } from '../../stores/activeVault'
import { useEditorPrefs } from '../../stores/editorPrefs'
import { ConflictResolveView } from '../conflicts/ConflictResolveView'
import { useNoteConflicts } from '../conflicts/useConflicts'
import { useNoteContentQuery } from '../notes/useNoteContent'
import { autosaveManager } from '../sync/syncManager'
import { useAutosaveStatus } from '../sync/useAutosaveStatus'
import { useTabs } from '../tabs/tabs.store'
import { useActiveEditor } from './activeEditorController'
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
  // Seeded once from the Settings-configurable default (Task W5); the
  // per-note toggle button and Ctrl+Shift+P "Toggle preview pane" both
  // still just flip local state from there — this only affects a note's
  // *initial* preview visibility on open.
  const [showPreview, setShowPreview] = useState(() => useEditorPrefs.getState().defaultSplitPreview)
  const [liveContent, setLiveContent] = useState('')
  const [showResolve, setShowResolve] = useState(false)

  // Two independent conflict signals: (a) *this device's* own save just
  // 409'd (`saveState.status`, from the autosave loop) — head moved out
  // from under an edit in flight here, so it's frozen read-only until
  // resolved; (b) the note already carries pending conflict blob(s) per
  // the vault-wide `GET /conflicts` (Task W5) — e.g. two *other* devices
  // raced before this one ever opened the note. Head didn't move for
  // (b), so editing/saving still works normally; the banner just nudges
  // toward resolving so the note stops carrying stale conflict blobs.
  const serverConflicts = useNoteConflicts(vaultId, noteId)
  const isLocalConflict = saveState.status === 'conflict'
  const hasPendingConflicts = isLocalConflict || (serverConflicts?.length ?? 0) > 0

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

    const onSave = () => autosaveManager.flushNow(noteId)

    const state = EditorState.create({
      doc: data.content,
      extensions: buildEditorExtensions({
        contextExtension: contextCompartment.of(editorContext.of(contextRef.current)),
        readOnlyExtension: readOnlyCompartment.of([]),
        onChange,
        onSave,
      }),
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    view.focus()

    // Registers this note as "the" active editor so the outline panel
    // (scroll-to-heading) and command palette (toggle preview) can reach
    // it through a narrow interface instead of CM6 internals — see
    // `activeEditorController`'s doc comment.
    useActiveEditor.getState().setActiveEditor({
      noteId,
      scrollToLine: (line) => {
        const clamped = Math.min(Math.max(line, 1), view.state.doc.lines)
        const linePos = view.state.doc.line(clamped)
        view.dispatch({
          selection: { anchor: linePos.from },
          effects: EditorView.scrollIntoView(linePos.from, { y: 'center' }),
        })
        view.focus()
      },
      togglePreview: () => setShowPreview((v) => !v),
    })

    return () => {
      view.destroy()
      viewRef.current = null
      useActiveEditor.getState().clearActiveEditor(noteId)
      // Flushes (rather than drops) any edit still sitting in the 800ms
      // debounce window when the tab switches/closes — see
      // `AutosaveManager.flushAndClose`'s doc comment for why this used
      // to lose up to 800ms of typing here.
      autosaveManager.flushAndClose(noteId)
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

  // Frozen read-only only for *this device's own* save conflict — see
  // `isLocalConflict`'s doc comment above. A pending conflict this
  // device merely inherited from another device doesn't block editing;
  // head hasn't moved for that case, so the next save still succeeds.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(
        isLocalConflict ? [EditorView.editable.of(false), EditorState.readOnly.of(true)] : [],
      ),
    })
  }, [isLocalConflict, readOnlyCompartment])

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

  if (showResolve && vaultId) {
    return (
      <ConflictResolveView
        vaultId={vaultId}
        noteId={noteId}
        path={path}
        onCancel={() => setShowResolve(false)}
        onResolved={() => setShowResolve(false)}
      />
    )
  }

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

      {hasPendingConflicts && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-2 text-[13px] text-danger">
          <span>
            {isLocalConflict
              ? "This note changed elsewhere since your last save. It's read-only until the conflict is resolved."
              : 'This note has unresolved sync conflicts from another device.'}
          </span>
          <Button size="sm" variant="danger" onClick={() => setShowResolve(true)}>
            Resolve conflict
          </Button>
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
