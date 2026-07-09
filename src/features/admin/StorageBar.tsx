export interface StorageBarProps {
  label: string
  sizeBytes: number
  maxBytes: number
  secondary?: string
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

/**
 * A single magnitude bar (per-user / per-vault storage). Single-hue
 * (accent) fill on a track — this is one series of one kind of
 * quantity, so per the dataviz guidance a categorical palette would be
 * noise here; the row's own text label already carries identity, so
 * color is never the only way to tell rows apart.
 */
export function StorageBar({ label, sizeBytes, maxBytes, secondary }: StorageBarProps) {
  const pct = maxBytes > 0 ? Math.min(100, Math.max((sizeBytes / maxBytes) * 100, sizeBytes > 0 ? 1.5 : 0)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="min-w-0 truncate text-text">
          {label}
          {secondary && <span className="ml-1.5 text-text-faint">{secondary}</span>}
        </span>
        <span className="shrink-0 tabular-nums text-text-faint">{formatBytes(sizeBytes)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export { formatBytes }
