import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PutNoteContentResponse } from '../../lib/api/types'
import { ConflictError } from './notesSyncApi'
import { INITIAL_BACKOFF_MS, MAX_BACKOFF_MS, OfflineSaveQueue, type QueueSaveItem } from './offlineQueue'

function item(overrides: Partial<QueueSaveItem> = {}): QueueSaveItem {
  return { noteId: 'note-1', content: 'hello', baseRevId: 'rev-1', deviceId: 'device-1', ...overrides }
}

function response(revId: string): PutNoteContentResponse {
  return { revId, contentHash: `hash-${revId}` }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('flush order', () => {
  it('saves queued notes sequentially in the order they were enqueued (FIFO)', async () => {
    const order: string[] = []
    const save = vi.fn(async (i: QueueSaveItem) => {
      order.push(i.noteId)
      return response(`${i.noteId}-rev`)
    })
    const onSuccess = vi.fn()
    const queue = new OfflineSaveQueue(save, { onSuccess, onConflict: vi.fn() })

    queue.enqueue(item({ noteId: 'a' }))
    queue.enqueue(item({ noteId: 'b' }))
    queue.enqueue(item({ noteId: 'c' }))

    await queue.flush()

    expect(order).toEqual(['a', 'b', 'c'])
    expect(onSuccess).toHaveBeenCalledTimes(3)
    expect(queue.size).toBe(0)
  })

  it('awaits each save before starting the next (no parallel dispatch)', async () => {
    const started: string[] = []
    const finished: string[] = []
    let releaseA!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const save = vi.fn(async (i: QueueSaveItem) => {
      started.push(i.noteId)
      if (i.noteId === 'a') await gate
      finished.push(i.noteId)
      return response(`${i.noteId}-rev`)
    })
    const queue = new OfflineSaveQueue(save, { onSuccess: vi.fn(), onConflict: vi.fn() })
    queue.enqueue(item({ noteId: 'a' }))
    queue.enqueue(item({ noteId: 'b' }))

    const flushDone = queue.flush()
    // Let microtasks settle: only 'a' should have started, 'b' waits on it.
    await Promise.resolve()
    await Promise.resolve()
    expect(started).toEqual(['a'])

    releaseA()
    await flushDone
    expect(started).toEqual(['a', 'b'])
    expect(finished).toEqual(['a', 'b'])
  })

  it('coalesces repeated enqueues for the same note into the latest content only', async () => {
    const save = vi.fn(async (i: QueueSaveItem) => response(`${i.noteId}-${i.content}`))
    const queue = new OfflineSaveQueue(save, { onSuccess: vi.fn(), onConflict: vi.fn() })

    queue.enqueue(item({ noteId: 'a', content: 'first draft' }))
    queue.enqueue(item({ noteId: 'a', content: 'second draft' }))

    await queue.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ content: 'second draft' }))
  })
})

describe('conflict handling', () => {
  it('drops the item and reports the conflict, but keeps flushing the rest of the queue', async () => {
    const save = vi.fn(async (i: QueueSaveItem) => {
      if (i.noteId === 'a') throw new ConflictError({ headRevId: 'head-1', conflictRevId: 'conf-1' })
      return response(`${i.noteId}-rev`)
    })
    const onConflict = vi.fn()
    const onSuccess = vi.fn()
    const queue = new OfflineSaveQueue(save, { onSuccess, onConflict })

    queue.enqueue(item({ noteId: 'a' }))
    queue.enqueue(item({ noteId: 'b' }))

    await queue.flush()

    expect(onConflict).toHaveBeenCalledWith('a', { headRevId: 'head-1', conflictRevId: 'conf-1' })
    expect(onSuccess).toHaveBeenCalledWith('b', expect.anything())
    expect(queue.size).toBe(0)
  })
})

describe('offline retry with exponential backoff', () => {
  it('retries a failing save with increasing backoff, then succeeds and stops', async () => {
    let attempt = 0
    const save = vi.fn(async (i: QueueSaveItem) => {
      attempt += 1
      if (attempt < 3) throw new Error('network down')
      return response(`${i.noteId}-rev`)
    })
    const onSuccess = vi.fn()
    const queue = new OfflineSaveQueue(save, { onSuccess, onConflict: vi.fn() })

    queue.enqueue(item())
    // First attempt happens on the timer scheduled by enqueue().
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.size).toBe(1) // still queued — first retry failed too

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 2)
    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.size).toBe(1)

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 4)
    expect(save).toHaveBeenCalledTimes(3)
    expect(queue.size).toBe(0)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('caps backoff at MAX_BACKOFF_MS', async () => {
    const save = vi.fn(async () => {
      throw new Error('still down')
    })
    const queue = new OfflineSaveQueue(save, { onSuccess: vi.fn(), onConflict: vi.fn() })
    queue.enqueue(item())

    // Drive enough retries that, without a cap, backoff would exceed MAX_BACKOFF_MS.
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
    }
    const callsAtCap = save.mock.calls.length

    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
    expect(save.mock.calls.length).toBe(callsAtCap + 1)
  })

  it('an explicit flush() call (e.g. on reconnect) retries immediately without waiting for backoff', async () => {
    let attempt = 0
    const save = vi.fn(async (i: QueueSaveItem) => {
      attempt += 1
      if (attempt === 1) throw new Error('offline')
      return response(`${i.noteId}-rev`)
    })
    const onSuccess = vi.fn()
    const queue = new OfflineSaveQueue(save, { onSuccess, onConflict: vi.fn() })

    queue.enqueue(item())
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.size).toBe(1)

    // Reconnect happens well before the backoff timer would fire again.
    await queue.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.size).toBe(0)
    expect(onSuccess).toHaveBeenCalledOnce()
  })
})

describe('remove', () => {
  it('drops a note from the queue without saving it', async () => {
    const save = vi.fn(async (i: QueueSaveItem) => response(`${i.noteId}-rev`))
    const queue = new OfflineSaveQueue(save, { onSuccess: vi.fn(), onConflict: vi.fn() })
    queue.enqueue(item({ noteId: 'a' }))
    queue.remove('a')
    await queue.flush()
    expect(save).not.toHaveBeenCalled()
    expect(queue.size).toBe(0)
  })
})
