/**
 * Polling loop for the admin health dashboard. A plain class (not a
 * hook) so its start/stop/interval semantics are directly unit-testable
 * with fake timers, the same way `AutosaveManager` (sync/autosave.ts)
 * keeps its debounce/retry logic out of a component — `useHealthPolling`
 * is the thin React binding around it.
 */
export interface HealthPollerOptions<T> {
  /** The actual network call — injected so tests never touch `fetch`. */
  fetch: () => Promise<T>
  onUpdate: (data: T) => void
  onError?: (err: unknown) => void
  /** Default 15s — inside the brief's "every 10-30s" range. */
  intervalMs?: number
  /** Skips a tick when false (tab hidden). Defaults to always-visible. */
  isVisible?: () => boolean
}

const DEFAULT_INTERVAL_MS = 15000

export class HealthPoller<T> {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly opts: HealthPollerOptions<T>

  constructor(opts: HealthPollerOptions<T>) {
    this.opts = opts
  }

  /** No-op if already running — safe to call from an effect that may re-run. */
  start(): void {
    if (this.timer !== null) return
    void this.tick(true)
    this.timer = setInterval(() => void this.tick(false), this.opts.intervalMs ?? DEFAULT_INTERVAL_MS)
  }

  /** Clears the interval. Idempotent — safe to call on an already-stopped poller. */
  stop(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }

  get isRunning(): boolean {
    return this.timer !== null
  }

  /** Manual refresh (a "Refresh now" button, or the tab regaining visibility) — always runs regardless of `isVisible`. */
  refreshNow(): Promise<void> {
    return this.tick(true)
  }

  private async tick(force: boolean): Promise<void> {
    if (!force && this.opts.isVisible && !this.opts.isVisible()) return
    try {
      const data = await this.opts.fetch()
      this.opts.onUpdate(data)
    } catch (err) {
      this.opts.onError?.(err)
    }
  }
}
