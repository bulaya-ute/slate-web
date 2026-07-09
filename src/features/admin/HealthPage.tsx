import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatBytes } from './StorageBar'
import { useHealthPolling } from './useHealthPolling'

const POLL_INTERVAL_MS = 15000

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-text">{value}</p>
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] text-success',
  degraded: 'bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-warning',
  down: 'bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-danger',
}

/**
 * Health dashboard, auto-refreshing via `useHealthPolling` (Page
 * Visibility-aware — see that hook / `HealthPoller`'s tests). Every
 * field is optional in `SystemHealth` (S6 hasn't landed yet — see that
 * type's doc comment), so each tile falls back to a dash rather than
 * assuming the shape.
 */
export function HealthPage() {
  const { health, error, isLoading, refresh } = useHealthPolling(POLL_INTERVAL_MS)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (health) setLastUpdated(new Date())
  }, [health])

  const diskPct =
    health?.diskFreeBytes !== undefined && health.diskTotalBytes
      ? Math.max(0, Math.min(100, 100 - (health.diskFreeBytes / health.diskTotalBytes) * 100))
      : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-text">Health</h1>
          <p className="text-[12px] text-text-faint">
            Auto-refreshes every {POLL_INTERVAL_MS / 1000}s while this tab is visible.
            {lastUpdated && ` Last updated ${lastUpdated.toLocaleTimeString()}.`}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={refresh}>
          Refresh now
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-label="Loading health">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error && !health ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] text-danger">Couldn&apos;t load server health.</p>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {health?.status && (
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_STYLE[health.status] ?? 'text-text-muted'}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {health.status}
            </span>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Disk"
              value={
                health?.diskFreeBytes !== undefined && health.diskTotalBytes !== undefined
                  ? `${formatBytes(health.diskTotalBytes - health.diskFreeBytes)} / ${formatBytes(health.diskTotalBytes)}`
                  : '—'
              }
            />
            <StatTile label="Database size" value={health?.databaseSizeBytes !== undefined ? formatBytes(health.databaseSizeBytes) : '—'} />
            <StatTile label="Active connections" value={health?.activeConnections !== undefined ? String(health.activeConnections) : '—'} />
            <StatTile label="Uptime" value={health?.uptimeSeconds !== undefined ? formatDuration(health.uptimeSeconds) : '—'} />
            <StatTile label="Version" value={health?.version ?? '—'} />
          </div>

          {diskPct !== null && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                <span className="text-text-faint">Disk used</span>
                <span className="tabular-nums text-text-faint">{diskPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-active">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ease-out ${diskPct > 90 ? 'bg-danger' : 'bg-[var(--color-accent)]'}`}
                  style={{ width: `${diskPct}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
