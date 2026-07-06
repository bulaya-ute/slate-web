import { type InputHTMLAttributes, forwardRef, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Shown below the field in the danger color; also sets aria-invalid. */
  error?: string
  /** Shown below the field when there's no error — hints, format examples. */
  hint?: string
}

/** Text input with label/error/hint slots — the single field primitive forms build on. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={
          'h-10 rounded-md border bg-surface px-3 text-[14px] text-text placeholder:text-text-faint ' +
          'transition duration-150 ease-out outline-none ' +
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ' +
          (error
            ? 'border-danger focus-visible:outline-danger'
            : 'border-border hover:border-border-strong focus:border-border-strong') +
          ' disabled:opacity-50 disabled:cursor-not-allowed ' +
          className
        }
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-[12px] text-text-faint">
          {hint}
        </p>
      )}
    </div>
  )
})
