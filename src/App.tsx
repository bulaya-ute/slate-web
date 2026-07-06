import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ToastViewport } from './components/ui/Toast'
import { AppShell } from './routes/AppShell'
import { Connect } from './routes/Connect'
import { RequireAuth, RequireServer } from './routes/guards'
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
            <Route path="/*" element={<AppShell />} />
          </Route>
        </Route>
      </Routes>
      <ToastViewport />
    </BrowserRouter>
  )
}
