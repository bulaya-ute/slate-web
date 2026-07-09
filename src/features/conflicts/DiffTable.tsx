import type { DiffRow } from './diffHunks'

export interface DiffTableProps {
  rows: DiffRow[]
  leftLabel: string
  rightLabel: string
}

const ROW_BG: Record<DiffRow['type'], string> = {
  unchanged: '',
  added: 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)]',
  removed: 'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)]',
  modified: 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)]',
}

/**
 * Side-by-side line diff, driven by `buildDiffRows`' output — left is
 * head (this vault's current server copy), right is the conflicting
 * blob. Row background communicates the change kind; text stays in the
 * normal ink color (not color-only) so it's readable without relying on
 * hue perception.
 */
export function DiffTable({ rows, leftLabel, rightLabel }: DiffTableProps) {
  return (
    <table className="w-full table-fixed border-collapse text-[12px]">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr>
          <th className="w-1/2 border-b border-border px-3 py-1.5 text-left font-medium text-text-faint">
            {leftLabel}
          </th>
          <th className="w-1/2 border-b border-border px-3 py-1.5 text-left font-medium text-text-faint">
            {rightLabel}
          </th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {rows.map((row, i) => (
          <tr key={i}>
            <td
              className={`whitespace-pre-wrap break-words border-b border-border/40 px-3 py-0.5 align-top text-text ${ROW_BG[row.type]}`}
            >
              {row.left ?? ''}
            </td>
            <td
              className={`whitespace-pre-wrap break-words border-b border-border/40 px-3 py-0.5 align-top text-text ${ROW_BG[row.type]}`}
            >
              {row.right ?? ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
