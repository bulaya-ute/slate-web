import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthPoller } from './healthPolling'

const INTERVAL_MS = 1000

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HealthPoller', () => {
  it('fetches immediately on start, then again every intervalMs', async () => {
    const fetchFn = vi.fn(async () => ({ status: 'ok' }))
    const poller = new HealthPoller({ fetch: fetchFn, onUpdate: () => {}, intervalMs: INTERVAL_MS })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1) // immediate first tick

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2)
    expect(fetchFn).toHaveBeenCalledTimes(4)
  })

  it('calls onUpdate with each successful fetch result', async () => {
    const onUpdate = vi.fn()
    let call = 0
    const fetchFn = vi.fn(async () => ({ status: 'ok', tick: ++call }))
    const poller = new HealthPoller({ fetch: fetchFn, onUpdate, intervalMs: INTERVAL_MS })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onUpdate).toHaveBeenLastCalledWith({ status: 'ok', tick: 1 })

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(onUpdate).toHaveBeenLastCalledWith({ status: 'ok', tick: 2 })
  })

  it('routes a rejected fetch to onError instead of throwing', async () => {
    const onError = vi.fn()
    const fetchFn = vi.fn(async () => {
      throw new Error('network down')
    })
    const poller = new HealthPoller({ fetch: fetchFn, onUpdate: () => {}, onError, intervalMs: INTERVAL_MS })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
  })

  it('start() is idempotent — calling it again while running does not double the interval', async () => {
    const fetchFn = vi.fn(async () => ({ status: 'ok' }))
    const poller = new HealthPoller({ fetch: fetchFn, onUpdate: () => {}, intervalMs: INTERVAL_MS })

    poller.start()
    poller.start()
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    fetchFn.mockClear()

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(fetchFn).toHaveBeenCalledTimes(1) // not 3
  })

  it('stop() clears the interval — no further fetches after stopping (no leaked timer)', async () => {
    const fetchFn = vi.fn(async () => ({ status: 'ok' }))
    const poller = new HealthPoller({ fetch: fetchFn, onUpdate: () => {}, intervalMs: INTERVAL_MS })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(poller.isRunning).toBe(true)

    poller.stop()
    expect(poller.isRunning).toBe(false)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 5)
    expect(fetchFn).toHaveBeenCalledTimes(1) // still 1 — the interval is gone, not just paused
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop() is idempotent and safe to call before start()', () => {
    const poller = new HealthPoller({ fetch: vi.fn(), onUpdate: () => {} })
    expect(() => poller.stop()).not.toThrow()
    poller.start()
    expect(() => {
      poller.stop()
      poller.stop()
    }).not.toThrow()
    expect(poller.isRunning).toBe(false)
  })

  it('skips a scheduled tick when isVisible() is false, but keeps the interval alive', async () => {
    let visible = true
    const fetchFn = vi.fn(async () => ({ status: 'ok' }))
    const poller = new HealthPoller({
      fetch: fetchFn,
      onUpdate: () => {},
      intervalMs: INTERVAL_MS,
      isVisible: () => visible,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    visible = false
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(fetchFn).toHaveBeenCalledTimes(1) // tab hidden — scheduled tick skipped

    visible = true
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(fetchFn).toHaveBeenCalledTimes(2) // visible again — resumes on the same interval
  })

  it('refreshNow() fetches immediately even while hidden, ignoring isVisible', async () => {
    const fetchFn = vi.fn(async () => ({ status: 'ok' }))
    const poller = new HealthPoller({
      fetch: fetchFn,
      onUpdate: () => {},
      intervalMs: INTERVAL_MS,
      isVisible: () => false,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    fetchFn.mockClear()

    await poller.refreshNow()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
