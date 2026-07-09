import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePanelRef } from 'react-resizable-panels'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Tooltip } from '../components/ui/Tooltip'
import { GraphView } from '../features/graph/GraphView'
import { CommandPalette } from '../features/palette/CommandPalette'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import { SyncProvider } from '../features/sync/SyncProvider'
import { useSidebarControl } from '../features/workspace/sidebarControl'
import { WorkspaceLayout } from '../features/workspace/WorkspaceLayout'
import { useActiveVault } from '../stores/activeVault'
import { useAuth } from '../stores/auth'
import { useOverlay } from '../stores/overlay'
import { useServer } from '../stores/servers'

function SidebarToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.2 3v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 5.1 10.5 4.9M5.3 5.6 6.3 10.5M9.7 6.1 7.6 10.4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.8v1.5M8 12.7v1.5M14.2 8h-1.5M3.3 8H1.8M12.1 3.9l-1 1.1M4.9 11l-1 1.1M12.1 12.1l-1-1.1M4.9 5l-1-1.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 13.5 3.5v3.8c0 3.5-2.3 6.2-5.5 7.2-3.2-1-5.5-3.7-5.5-7.2V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
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
  const activeVaultId = useActiveVault((s) => s.activeVaultId)
  const overlay = useOverlay((s) => s.active)
  const openGraph = useOverlay((s) => s.openGraph)
  const openSettings = useOverlay((s) => s.openSettings)
  const closeOverlay = useOverlay((s) => s.close)

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
        <div className="flex items-center gap-1">
          <Tooltip content="Graph view">
            <button
              type="button"
              onClick={openGraph}
              disabled={!activeVaultId}
              aria-label="Open graph view"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-40"
            >
              <GraphIcon />
            </button>
          </Tooltip>
          {user?.role === 'Admin' && (
            <Tooltip content="Admin panel">
              <Link
                to="/admin"
                aria-label="Admin panel"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <ShieldIcon />
              </Link>
            </Tooltip>
          )}
          <Tooltip content="Settings">
            <button
              type="button"
              onClick={openSettings}
              aria-label="Open settings"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <SettingsIcon />
            </button>
          </Tooltip>
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

      {overlay === 'graph' && activeVaultId && <GraphView vaultId={activeVaultId} onClose={closeOverlay} />}
      {overlay === 'settings' && <SettingsPanel onClose={closeOverlay} />}
    </div>
  )
}
