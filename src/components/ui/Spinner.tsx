export type SpinnerSize = 'sm' | 'md' | 'lg'

const sizes: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  /** Visible label for screen readers; the spinner itself is decorative. */
  label?: string
}

/** Indeterminate progress indicator — "checking server", "loading vaults", etc. */
export function Spinner({ size = 'md', className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent text-text-faint ${sizes[size]} ${className}`}
    >
      <span className="sr-only">{label}</span>
    </span>
  )
}
