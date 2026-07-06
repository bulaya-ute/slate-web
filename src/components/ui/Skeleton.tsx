import type { HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Tailwind width/height utilities, e.g. "w-32 h-4". Defaults to a full-width text line. */
  className?: string
}

/**
 * Loading placeholder — a pulsing block shaped like the content it
 * stands in for. Compose several to build list/row/card skeletons.
 */
export function Skeleton({ className = 'h-4 w-full', ...rest }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-surface-active ${className}`}
      {...rest}
    />
  )
}
