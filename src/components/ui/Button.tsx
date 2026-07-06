import { type ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner in place of the icon slot and disables the button. */
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition duration-150 ease-out ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--color-focus-ring)]'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover active:bg-accent-active border border-transparent',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface-hover active:bg-surface-active',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-hover hover:text-text border border-transparent',
  danger: 'bg-danger text-danger-contrast hover:bg-danger-hover border border-transparent',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
}

/** The one clickable-action primitive — every button in the app renders through this. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
})
