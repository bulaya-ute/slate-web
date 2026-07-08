import type { PutNoteContentResponse } from '../../lib/api/types'
import { ConflictError } from './notesSyncApi'

export interface QueueSaveItem {
  noteId: string
  content: string
  baseRevId: string
  deviceId: string
}

export interface QueueHandlers {
  onSuccess: (noteId: string, res: PutNoteContentResponse) => void
  onConflict: (noteId: string, info: { headRevId: string; conflictRevId: string }) => void
}

export type QueueSaveFn = (item: QueueSaveItem) => Promise<PutNoteContentResponse>

export const INITIAL_BACKOFF_MS = 1000
export const MAX_BACKOFF_MS = 30_000
const BACKOFF_FACTOR = 2

/**
 * Holds note saves that failed because the client is (or seems to be)
 * offline, and retries them with exponential backoff. Saves are flushed
 * **sequentially, in the order they were enqueued** — never in
 * parallel — so a note's history of saves reaches the server in the
 * same order they happened, and so "flush order" is deterministic
 * (tested directly below).
 *
 * Only the *latest* pending content per note is kept — an offline user
 * who keeps typing doesn't need every intermediate revision replayed,
 * just the final one.
 */
export class OfflineSaveQueue {
  private items: QueueSaveItem[] = []
  private backoffMs = INITIAL_BACKOFF_MS
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  private readonly save: QueueSaveFn
  private readonly handlers: QueueHandlers

  constructor(save: QueueSaveFn, handlers: QueueHandlers) {
    this.save = save
    this.handlers = handlers
  }

  get size(): number {
    return this.items.length
  }

  get pendingNoteIds(): string[] {
    return this.items.map((i) => i.noteId)
  }

  enqueue(item: QueueSaveItem): void {
    const idx = this.items.findIndex((i) => i.noteId === item.noteId)
    if (idx !== -1) this.items[idx] = item
    else this.items.push(item)
    this.scheduleRetry()
  }

  /** Drops any pending save for a note (e.g. its tab closed before reconnecting). */
  remove(noteId: string): void {
    this.items = this.items.filter((i) => i.noteId !== noteId)
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.flush()
    }, this.backoffMs)
  }

  /**
   * Attempts every queued save, oldest-first, awaiting each in turn. On
   * the first failure that isn't a conflict, stops (the remaining items
   * stay queued) and schedules a backoff retry of the whole queue.
   */
  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    this.clearRetryTimer()
    try {
      // Snapshot the order so an item enqueued *during* this flush (a
      // fresh edit arriving mid-flush) joins the *next* flush rather
      // than being skipped or processed out of turn.
      const order = this.items.map((i) => i.noteId)
      for (const noteId of order) {
        const current = this.items.find((i) => i.noteId === noteId)
        if (!current) continue // already resolved (success/conflict) earlier in this same flush
        try {
          const res = await this.save(current)
          this.items = this.items.filter((i) => i.noteId !== noteId)
          this.backoffMs = INITIAL_BACKOFF_MS
          this.handlers.onSuccess(noteId, res)
        } catch (err) {
          if (err instanceof ConflictError) {
            this.items = this.items.filter((i) => i.noteId !== noteId)
            this.handlers.onConflict(noteId, { headRevId: err.headRevId, conflictRevId: err.conflictRevId })
            continue
          }
          // Still offline (or a transient failure) — leave it and
          // everything after it queued, back off, try the whole queue
          // again later.
          this.backoffMs = Math.min(this.backoffMs * BACKOFF_FACTOR, MAX_BACKOFF_MS)
          this.scheduleRetry()
          return
        }
      }
    } finally {
      this.flushing = false
    }
  }

  dispose(): void {
    this.clearRetryTimer()
    this.items = []
  }
}
