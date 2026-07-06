import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthScreenLayout } from '../components/AuthScreenLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { toast } from '../components/ui/Toast'
import { api, CLIENT_API_VERSION } from '../lib/api/client'
import type { LoginRequest, LoginResponse } from '../lib/api/types'
import { ApiError } from '../lib/api/types'
import { useConfigQuery, useServerCheckQuery } from '../lib/queries'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'
import { resolveLoginServerState } from './loginServerState'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const current = useServer((s) => s.current)
  const { data: config } = useConfigQuery()
  const check = useServerCheckQuery(current)
  const setSession = useAuth((s) => s.setSession)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const body: LoginRequest = { username: username.trim(), password }
      const res = await api.post<LoginResponse>('/api/auth/login', body)
      setSession(res)
      toast.success(`Welcome back, ${res.user.displayName}`)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Still resolving whether this server needs first-run setup.
  if (check.isLoading) {
    return (
      <AuthScreenLayout subtitle="Signing in">
        <div className="flex flex-col gap-4" role="status" aria-label="Loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthScreenLayout>
    )
  }

  const { info: checkedInfo, incompatibleInfo, unreachable } = resolveLoginServerState(check.data)

  if (checkedInfo?.setupRequired) {
    // Intentionally inline rather than a third route guard — Login/Setup already
    // need the server-check result to render, so branching here avoids a
    // RequireSetup wrapper that would just re-fetch the same query.
    return <Navigate to="/setup" replace />
  }

  const serverLabel = config?.serverName ?? checkedInfo?.serverName ?? null

  return (
    <AuthScreenLayout
      subtitle={serverLabel ? `Sign in to ${serverLabel}` : 'Sign in to your Slate server'}
      footer={
        config?.allowServerSelection !== false && (
          <button
            type="button"
            onClick={() => navigate('/connect')}
            className="text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Change server
          </button>
        )
      }
    >
      {incompatibleInfo ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-[14px] font-medium text-text">Server version mismatch</p>
          <p className="text-[13px] text-text-muted">
            This server speaks API v{incompatibleInfo.apiVersion}; this client needs v{CLIENT_API_VERSION}.
            Update the server or the client, then try again.
          </p>
          <Button type="button" variant="secondary" onClick={() => check.refetch()}>
            Retry
          </Button>
        </div>
      ) : unreachable ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-[14px] font-medium text-text">Can&apos;t reach this server</p>
          <p className="text-[13px] text-text-muted">
            {current ? `${current} isn't responding right now.` : 'No server is configured.'} Check that
            it&apos;s running, then try again.
          </p>
          <Button type="button" variant="secondary" onClick={() => check.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" loading={submitting}>
            Sign in
          </Button>
        </form>
      )}
    </AuthScreenLayout>
  )
}
