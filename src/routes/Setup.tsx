import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthScreenLayout } from '../components/AuthScreenLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { toast } from '../components/ui/Toast'
import { api } from '../lib/api/client'
import type { LoginResponse, SetupRequest } from '../lib/api/types'
import { ApiError } from '../lib/api/types'
import { useServerCheckQuery } from '../lib/queries'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'

const MIN_PASSWORD_LENGTH = 8

export function Setup() {
  const navigate = useNavigate()
  const current = useServer((s) => s.current)
  const check = useServerCheckQuery(current)
  const setSession = useAuth((s) => s.setSession)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkedInfo = check.data?.status === 'ok' ? check.data.info : null

  if (checkedInfo && !checkedInfo.setupRequired) {
    // Someone already completed setup (e.g. reopened this tab) — nothing to do here.
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const body: SetupRequest = {
        username: username.trim(),
        password,
        displayName: displayName.trim() || username.trim(),
      }
      await api.post<void>('/api/system/setup', body, { parseAs: 'none' })
      // Setup doesn't return a session itself — sign the new admin in immediately.
      const login = await api.post<LoginResponse>('/api/auth/login', {
        username: body.username,
        password: body.password,
      })
      setSession(login)
      toast.success('Slate is set up', `Signed in as ${login.user.displayName}`)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (check.isLoading) {
    return (
      <AuthScreenLayout subtitle="Preparing setup">
        <div className="flex flex-col gap-4" role="status" aria-label="Loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthScreenLayout>
    )
  }

  if (!checkedInfo) {
    return (
      <AuthScreenLayout subtitle="Preparing setup">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-[14px] font-medium text-text">Can&apos;t reach this server</p>
          <p className="text-[13px] text-text-muted">
            Check that it&apos;s running, then try again.
          </p>
          <Button type="button" variant="secondary" onClick={() => check.refetch()}>
            Retry
          </Button>
        </div>
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout subtitle="Create the first admin account to finish setting up this server">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Display name"
          autoComplete="name"
          autoFocus
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Shown to other users, e.g. in shared vault activity."
        />
        <Input
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={error ?? undefined}
          required
        />
        <Button type="submit" loading={submitting}>
          Create admin account
        </Button>
      </form>
    </AuthScreenLayout>
  )
}
