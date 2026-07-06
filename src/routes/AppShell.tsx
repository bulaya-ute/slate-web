import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'

/**
 * Placeholder for the workspace shell (sidebar / editor tabs / right
 * panel from the design spec). Later tasks fill this in; for now it
 * proves the authenticated route is reachable and gives sign-out /
 * theme / server-switch access so the flow is actually usable
 * end-to-end.
 */
export function AppShell() {
  const user = useAuth((s) => s.user)
  const clearAuth = useAuth((s) => s.clear)
  const current = useServer((s) => s.current)

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold tracking-tight text-text">Slate</span>
          {current && <span className="text-[12px] text-text-faint">{current}</span>}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <span className="text-[13px] text-text-muted">{user.displayName}</span>
              <Button size="sm" variant="ghost" onClick={() => clearAuth()}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-accent">
              <path
                d="M5 4.5h9L18 8.5v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M13.5 4.5v4a1 1 0 0 0 1 1H18" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[16px] font-semibold text-text">Your workspace is warming up</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            Vault browsing, the note editor, and search land in the next milestone. You&apos;re signed in
            {user ? ` as ${user.displayName}` : ''} and connected — everything else builds on top of this.
          </p>
        </div>
      </main>
    </div>
  )
}
