import type { PutNoteContentResponse } from '../../lib/api/types'
import { ConflictError } from './notesSyncApi'
import { OfflineSaveQueue, type QueueSaveFn } from './offlineQueue'

/** Matches the brief's required indicator states: saved/saving/offline/conflict. */
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'conflict'

export interface ConflictInfo {
  headRevId: string
  conflictRevId: string
}

export interface AutosaveNoteState {
  status: SaveStatus
  conflict: ConflictInfo | null
}

const DEFAULT_NOTE_STATE: AutosaveNoteState = { status: 'saved', conflict: null }
const DEFAULT_DEBOUNCE_MS = 800

interface NoteEntry {
  baseRevId: string
  pendingContent: string | null
  debounceTimer: ReturnType<typeof setTimeout> | null
  state: AutosaveNoteState
  listeners: Set<(state: AutosaveNoteState) => void>
}

export interface AutosaveManagerOptions {
  deviceId: string
  /** The actual network call — injected so tests never touch `fetch`. */
  save: QueueSaveFn
  debounceMs?: number
}

/**
 * Owns the client save loop for every currently-open note:
 *
 *  saved --(edit)--> [800ms idle] --(commit)--> saving --(200)--> saved
 *                                                        --(409)--> conflict
 *                                                        --(other)--> offline (queued, retried with backoff)
 *
 * One instance lives for the app session; `useAutosave` (the React
 * binding) calls `open`/`notifyChange`/`close` per note. The offline
 * queue is shared across all open notes so a reconnect flushes every
 * note's pending save in the order those saves were attempted.
 */
export class AutosaveManager {
  private notes = new Map<string, NoteEntry>()
  private queue: OfflineSaveQueue
  private readonly opts: AutosaveManagerOptions

  constructor(opts: AutosaveManagerOptions) {
    this.opts = opts
    this.queue = new OfflineSaveQueue(this.opts.save, {
      onSuccess: (noteId, res) => this.handleQueueSuccess(noteId, res),
      onConflict: (noteId, info) => this.handleQueueConflict(noteId, info),
    })
  }

  /** Registers a note as open, so `notifyChange` has somewhere to track state. No-op if already open. */
  open(noteId: string, initialRevId: string): void {
    if (this.notes.has(noteId)) return
    this.notes.set(noteId, {
      baseRevId: initialRevId,
      pendingContent: null,
      debounceTimer: null,
      state: { ...DEFAULT_NOTE_STATE },
      listeners: new Set(),
    })
  }

  /** Unregisters a note (tab closed) — cancels its debounce and drops any queued save. */
  close(noteId: string): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    if (entry.debounceTimer !== null) clearTimeout(entry.debounceTimer)
    this.queue.remove(noteId)
    this.notes.delete(noteId)
  }

  getState(noteId: string): AutosaveNoteState {
    return this.notes.get(noteId)?.state ?? DEFAULT_NOTE_STATE
  }

  /**
   * Re-points a clean note's `baseRevId` after an out-of-band refetch
   * (e.g. a `revision` event invalidated + refreshed a note nobody was
   * editing). Only meaningful when there's no pending/queued edit for
   * it — callers are expected to check `dirty` first.
   */
  setBaseRevId(noteId: string, revId: string): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    entry.baseRevId = revId
  }

  subscribe(noteId: string, listener: (state: AutosaveNoteState) => void): () => void {
    const entry = this.notes.get(noteId)
    if (!entry) return () => {}
    entry.listeners.add(listener)
    return () => entry.listeners.delete(listener)
  }

  /** Call on every editor content change (the editor debounces nothing itself). */
  notifyChange(noteId: string, content: string): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    if (entry.state.status === 'conflict') return // frozen until resolved (W5)
    entry.pendingContent = content
    this.resetDebounce(noteId, entry)
  }

  /** Skips the debounce and commits immediately (Ctrl+S, tab close, etc). */
  flushNow(noteId: string): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    if (entry.debounceTimer !== null) {
      clearTimeout(entry.debounceTimer)
      entry.debounceTimer = null
    }
    void this.commit(noteId, entry)
  }

  /** Called once the sync client reconnects and catch-up finishes. */
  flushQueue(): Promise<void> {
    return this.queue.flush()
  }

  get queueSize(): number {
    return this.queue.size
  }

  dispose(): void {
    for (const noteId of this.notes.keys()) this.close(noteId)
    this.queue.dispose()
  }

  private resetDebounce(noteId: string, entry: NoteEntry): void {
    if (entry.debounceTimer !== null) clearTimeout(entry.debounceTimer)
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null
      void this.commit(noteId, entry)
    }, this.opts.debounceMs ?? DEFAULT_DEBOUNCE_MS)
  }

  private setState(entry: NoteEntry, patch: Partial<AutosaveNoteState>): void {
    entry.state = { ...entry.state, ...patch }
    for (const listener of entry.listeners) listener(entry.state)
  }

  private async commit(noteId: string, entry: NoteEntry): Promise<void> {
    if (entry.pendingContent === null) return
    const content = entry.pendingContent
    entry.pendingContent = null

    if (entry.state.status === 'offline') {
      // A save for this note is already queued and being retried with
      // backoff — just update the queued content instead of racing it
      // with a second direct attempt.
      this.queue.enqueue({ noteId, content, baseRevId: entry.baseRevId, deviceId: this.opts.deviceId })
      return
    }

    this.setState(entry, { status: 'saving' })
    try {
      const res = await this.opts.save({ noteId, content, baseRevId: entry.baseRevId, deviceId: this.opts.deviceId })
      if (!this.notes.has(noteId)) return // closed while the request was in flight
      entry.baseRevId = res.revId
      if (entry.pendingContent !== null) {
        // More edits landed mid-save — go again rather than firing a
        // second request back-to-back.
        this.resetDebounce(noteId, entry)
      } else {
        this.setState(entry, { status: 'saved', conflict: null })
      }
    } catch (err) {
      if (!this.notes.has(noteId)) return
      if (err instanceof ConflictError) {
        this.setState(entry, { status: 'conflict', conflict: { headRevId: err.headRevId, conflictRevId: err.conflictRevId } })
        return
      }
      this.setState(entry, { status: 'offline' })
      this.queue.enqueue({ noteId, content, baseRevId: entry.baseRevId, deviceId: this.opts.deviceId })
    }
  }

  private handleQueueSuccess(noteId: string, res: PutNoteContentResponse): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    entry.baseRevId = res.revId
    if (entry.pendingContent === null) this.setState(entry, { status: 'saved', conflict: null })
  }

  private handleQueueConflict(noteId: string, info: ConflictInfo): void {
    const entry = this.notes.get(noteId)
    if (!entry) return
    this.setState(entry, { status: 'conflict', conflict: info })
  }
}
