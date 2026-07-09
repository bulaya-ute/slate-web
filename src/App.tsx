import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ToastViewport } from './components/ui/Toast'
import { AdminShell } from './features/admin/AdminShell'
import { AppShell } from './routes/AppShell'
import { Connect } from './routes/Connect'
import { RequireAdmin, RequireAuth, RequireServer } from './routes/guards'
import { Login } from './routes/Login'
import { Setup } from './routes/Setup'

/**
 * Route tree per the design spec's connection model:
 * Connect → Login → (first-run Setup) → Workspace.
 *
 * `/connect` is reachable unconditionally (it's the only way out of a
 * bad/no server). Everything else sits behind `RequireServer`
 * ("no server → /connect unless config pins one"); the workspace
 * additionally sits behind `RequireAuth` ("no auth → /login").
 * `setupRequired → /setup` is handled inside Login/Setup themselves,
 * since both already need the server's system-info response to render.
 *
 * `/admin/*` (Task W5) is a sibling of the workspace's `/*` catch-all,
 * not nested inside it — the admin panel is its own full layout
 * (`AdminShell`), not a view living inside the three-pane workspace
 * shell. It sits behind `RequireAdmin` (role gate) in addition to
 * `RequireAuth`. Route order matters here: `/admin/*` must be listed
 * before the workspace's `/*` so it isn't shadowed by it.
 */
export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/connect" element={<Connect />} />
        <Route element={<RequireServer />}>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />
          <Route element={<RequireAuth />}>
            <Route element={<RequireAdmin />}>
              <Route path="/admin/*" element={<AdminShell />} />
            </Route>
            <Route path="/*" element={<AppShell />} />
          </Route>
        </Route>
      </Routes>
      <ToastViewport />
    </BrowserRouter>
  )
}
