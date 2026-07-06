import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui/Spinner'
import { resolveActiveServer } from '../lib/config'
import { useConfigQuery } from '../lib/queries'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'

function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <Spinner size="lg" label="Starting Slate" />
    </div>
  )
}

/**
 * "No server → /connect unless config pins one."
 *
 * Resolves `public/config.json` against the remembered/current server
 * (see `resolveActiveServer`) and either lets the pinned/remembered
 * server through or bounces to /connect. Wraps every route except
 * /connect itself.
 */
export function RequireServer() {
  const { data: config, isLoading } = useConfigQuery()
  const current = useServer((s) => s.current)
  const setCurrent = useServer((s) => s.setCurrent)

  const resolved = config ? resolveActiveServer(config, current) : null

  useEffect(() => {
    if (resolved?.serverUrl && resolved.serverUrl !== current) {
      setCurrent(resolved.serverUrl, config?.serverName ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.serverUrl])

  if (isLoading || !config) return <FullScreenLoader />
  if (resolved?.requiresConnect) return <Navigate to="/connect" replace />
  return <Outlet />
}

/** "No auth → /login." Requires both tokens (an access token alone can't be refreshed). */
export function RequireAuth() {
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  const location = useLocation()

  if (!accessToken || !refreshToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
