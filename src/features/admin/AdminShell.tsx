import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../stores/auth'
import { HealthPage } from './HealthPage'
import { InvitesPage } from './InvitesPage'
import { StoragePage } from './StoragePage'
import { UsersPage } from './UsersPage'

const NAV = [
  { to: 'users', label: 'Users' },
  { to: 'invites', label: 'Invites' },
  { to: 'storage', label: 'Storage' },
  { to: 'health', label: 'Health' },
]

/**
 * The admin panel's own layout — a sidebar-nav'd shell, not nested
 * inside the three-pane workspace (`AppShell`/`WorkspaceLayout`); see
 * `App.tsx`'s doc comment on why `/admin/*` is a sibling route rather
 * than a view living inside the workspace. Owns its own nested
 * `<Routes>` for the four sections (role-gated as a whole by
 * `RequireAdmin`, one level up in the route tree).
 */
export function AdminShell() {
  const user = useAuth((s) => s.user)

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-[13px] text-text-muted transition duration-150 ease-out hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            ← Back to workspace
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-text">Admin</span>
        </div>
        {user && <span className="text-[13px] text-text-muted">{user.displayName}</span>}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Admin sections" className="w-48 shrink-0 border-r border-border bg-bg-inset p-2">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    'block rounded-md px-3 py-2 text-[13px] transition duration-150 ease-out ' +
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] ' +
                    (isActive
                      ? 'bg-surface-active text-text'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text')
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <Routes>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="invites" element={<InvitesPage />} />
            <Route path="storage" element={<StoragePage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="*" element={<Navigate to="users" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
