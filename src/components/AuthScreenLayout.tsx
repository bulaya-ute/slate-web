import type { ReactNode } from 'react'
import { Wordmark } from './Wordmark'

export interface AuthScreenLayoutProps {
  subtitle?: string
  children: ReactNode
  /** Rendered below the card — "no account? ask an admin", "change server", etc. */
  footer?: ReactNode
}

/**
 * Shared chrome for the Connect/Login/Setup screens: the slate-strata
 * background, the wordmark, and a centered card. Keeps the three
 * screens visually cohesive as one flow.
 */
export function AuthScreenLayout({ subtitle, children, footer }: AuthScreenLayoutProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-strata px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <Wordmark />
          {subtitle && <p className="text-[13px] text-text-muted">{subtitle}</p>}
        </div>
        <div
          key={typeof children}
          className="animate-[modalIn_180ms_ease-out] rounded-lg border border-border bg-surface p-6 shadow-lg"
        >
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-text-muted">{footer}</div>}
      </div>
    </div>
  )
}
