import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Tooltip } from '../components/ui/Tooltip'
import { CommandPalette } from '../features/palette/CommandPalette'
import { SyncProvider } from '../features/sync/SyncProvider'
import { useSidebarControl } from '../features/workspace/sidebarControl'
import { WorkspaceLayout } from '../features/workspace/WorkspaceLayout'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'

function SidebarToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.2 3v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/**
 * The real workspace shell: header (branding, sign-out, theme) above a
 * resizable/collapsible two-pane layout (`WorkspaceLayout` — sidebar
 * explorer + tabbed main pane). Replaces the W1 placeholder.
 */
export function AppShell() {
  const user = useAuth((s) => s.user)
  const clearAuth = useAuth((s) => s.clear)
  const current = useServer((s) => s.current)
  const sidebarPanelRef = usePanelRef()

  function toggleSidebar() {
    const panel = sidebarPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  // Lets the command palette's "Open vault switcher" command reach this
  // panel's imperative ref without prop-drilling it — see
  // `sidebarControl`'s doc comment.
  useEffect(() => {
    useSidebarControl.getState().setExpandSidebar(() => {
      const panel = sidebarPanelRef.current
      if (panel?.isCollapsed()) panel.expand()
    })
    return () => useSidebarControl.getState().setExpandSidebar(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col bg-bg">
      <SyncProvider />
      <CommandPalette />
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1">
          <Tooltip content="Toggle sidebar">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <SidebarToggleIcon />
            </button>
          </Tooltip>
          <span className="text-[14px] font-semibold tracking-tight text-text">Slate</span>
          {current && <span className="hidden text-[12px] text-text-faint sm:inline">{current}</span>}
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

      <main className="min-h-0 flex-1">
        <WorkspaceLayout sidebarPanelRef={sidebarPanelRef} />
      </main>
    </div>
  )
}
