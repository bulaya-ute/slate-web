import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PutNoteContentResponse } from '../../lib/api/types'
import { AutosaveManager, type AutosaveNoteState } from './autosave'
import { ConflictError } from './notesSyncApi'
import { INITIAL_BACKOFF_MS } from './offlineQueue'

const NOTE_ID = 'note-1'
const DEBOUNCE_MS = 800

function response(revId = 'rev-2'): PutNoteContentResponse {
  return { revId, contentHash: 'hash-2' }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dirty -> saving -> saved', () => {
  it('debounces 800ms after a change, then saves and adopts the new revId', async () => {
    const save = vi.fn(async () => response('rev-2'))
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    const states: AutosaveNoteState['status'][] = []
    manager.subscribe(NOTE_ID, (s) => states.push(s.status))

    manager.notifyChange(NOTE_ID, 'new content')
    expect(save).not.toHaveBeenCalled() // still debouncing
    expect(manager.getState(NOTE_ID).status).toBe('saved') // hasn't started yet

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(save).toHaveBeenCalledExactlyOnceWith({
      noteId: NOTE_ID,
      content: 'new content',
      baseRevId: 'rev-1',
      deviceId: 'device-1',
    })
    expect(states).toEqual(['saving', 'saved'])
    expect(manager.getState(NOTE_ID)).toEqual({ status: 'saved', conflict: null })
  })

  it('coalesces rapid keystrokes into a single save after the idle period', async () => {
    const save = vi.fn(async () => response())
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'a')
    await vi.advanceTimersByTimeAsync(400)
    manager.notifyChange(NOTE_ID, 'ab')
    await vi.advanceTimersByTimeAsync(400)
    manager.notifyChange(NOTE_ID, 'abc')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ content: 'abc' }))
  })

  it('adopts the new baseRevId so the next save uses it', async () => {
    const save = vi.fn(async () => response('rev-2'))
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'first')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ baseRevId: 'rev-1' }))

    manager.notifyChange(NOTE_ID, 'second')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ baseRevId: 'rev-2' }))
  })

  it('re-saves automatically if edits land while a save is in flight', async () => {
    let resolveFirst!: (res: PutNoteContentResponse) => void
    const firstCall = new Promise<PutNoteContentResponse>((resolve) => {
      resolveFirst = resolve
    })
    const save = vi.fn().mockReturnValueOnce(firstCall).mockResolvedValueOnce(response('rev-3'))
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'first')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(save).toHaveBeenCalledTimes(1)
    expect(manager.getState(NOTE_ID).status).toBe('saving')

    // A second edit arrives while the first save is still in flight.
    manager.notifyChange(NOTE_ID, 'second')

    resolveFirst(response('rev-2'))
    await vi.advanceTimersByTimeAsync(0)
    // Debounced again rather than firing back-to-back.
    expect(save).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'second', baseRevId: 'rev-2' }))
    expect(manager.getState(NOTE_ID).status).toBe('saved')
  })
})

describe('409 -> conflict', () => {
  it('surfaces a conflict state with the head/conflict rev ids, and stops autosaving', async () => {
    const save = vi.fn(async () => {
      throw new ConflictError({ headRevId: 'head-9', conflictRevId: 'conf-9' })
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    const states: AutosaveNoteState[] = []
    manager.subscribe(NOTE_ID, (s) => states.push(s))

    manager.notifyChange(NOTE_ID, 'edit')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(manager.getState(NOTE_ID)).toEqual({
      status: 'conflict',
      conflict: { headRevId: 'head-9', conflictRevId: 'conf-9' },
    })
    expect(states.map((s) => s.status)).toEqual(['saving', 'conflict'])
  })

  it('ignores further edits once in conflict (frozen until resolved)', async () => {
    const save = vi.fn(async () => {
      throw new ConflictError({ headRevId: 'head-9', conflictRevId: 'conf-9' })
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'edit')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(manager.getState(NOTE_ID).status).toBe('conflict')

    manager.notifyChange(NOTE_ID, 'more edits after conflict')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2)

    expect(save).toHaveBeenCalledOnce() // no further save attempts
    expect(manager.getState(NOTE_ID).status).toBe('conflict')
  })
})

describe('offline -> queued -> flush', () => {
  it('enters offline state and queues the save when the request fails for a non-conflict reason', async () => {
    const save = vi.fn(async () => {
      throw new Error('network down')
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'edit')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(manager.getState(NOTE_ID).status).toBe('offline')
    expect(manager.queueSize).toBe(1)
  })

  it('flushQueue() (called after reconnect + catch-up) saves the queued edit and returns to saved', async () => {
    let attempt = 0
    const save = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('offline')
      return response('rev-2')
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'edit while offline')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(manager.getState(NOTE_ID).status).toBe('offline')

    await manager.flushQueue()

    expect(manager.getState(NOTE_ID)).toEqual({ status: 'saved', conflict: null })
    expect(manager.queueSize).toBe(0)
  })

  it('flushes multiple offline notes in the order their saves were first attempted', async () => {
    const attempts = new Map<string, number>()
    const flushOrder: string[] = []
    const save = vi.fn(async (item: { noteId: string; content: string }) => {
      const attempt = (attempts.get(item.noteId) ?? 0) + 1
      attempts.set(item.noteId, attempt)
      if (attempt === 1) throw new Error('offline') // first attempt (direct, pre-queue) always fails
      flushOrder.push(item.noteId) // only record attempts made during the queue flush
      return response(`${item.noteId}-rev-2`)
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open('a', 'rev-1')
    manager.open('b', 'rev-1')
    manager.open('c', 'rev-1')

    // Fire all three debounces at (roughly) the same simulated tick, so
    // the cumulative elapsed time stays well under the offline queue's
    // own backoff (1s) — otherwise its internal retry could fire before
    // all three notes have even finished their first failed attempt.
    manager.notifyChange('a', 'edit a')
    manager.notifyChange('b', 'edit b')
    manager.notifyChange('c', 'edit c')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(['a', 'b', 'c'].every((id) => manager.getState(id).status === 'offline')).toBe(true)

    await manager.flushQueue()

    expect(flushOrder).toEqual(['a', 'b', 'c'])
    expect(manager.getState('a').status).toBe('saved')
    expect(manager.getState('b').status).toBe('saved')
    expect(manager.getState('c').status).toBe('saved')
  })

  it('the internal backoff retry also eventually flushes without an explicit flushQueue() call', async () => {
    let attempt = 0
    const save = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('offline')
      return response('rev-2')
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')

    manager.notifyChange(NOTE_ID, 'edit')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(manager.getState(NOTE_ID).status).toBe('offline')

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS)

    expect(manager.getState(NOTE_ID).status).toBe('saved')
  })
})

describe('close', () => {
  it('cancels a pending debounce and drops any queued save for the note', async () => {
    const save = vi.fn(async () => {
      throw new Error('offline')
    })
    const manager = new AutosaveManager({ deviceId: 'device-1', save })
    manager.open(NOTE_ID, 'rev-1')
    manager.notifyChange(NOTE_ID, 'edit')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    expect(manager.queueSize).toBe(1)

    manager.close(NOTE_ID)

    expect(manager.queueSize).toBe(0)
    expect(manager.getState(NOTE_ID)).toEqual({ status: 'saved', conflict: null }) // default for an unopened note
  })
})
