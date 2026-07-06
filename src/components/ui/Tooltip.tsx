import { type ReactNode, useId, useState } from 'react'

export interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

/**
 * Hover/focus-triggered label for icon-only controls. Shows on both
 * mouse hover and keyboard focus so it never hides information from
 * keyboard-only users.
 */
export function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      <span
        role="tooltip"
        id={id}
        className={
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm ' +
          'bg-bg-inset px-2 py-1 text-[12px] text-text shadow-md border border-border-strong ' +
          'transition-opacity duration-150 ease-out ' +
          (side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5') +
          (visible ? ' opacity-100' : ' opacity-0')
        }
      >
        {content}
      </span>
    </span>
  )
}
